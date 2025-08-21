import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const {
      product_id,
      from_location_id,
      to_location_id,
      batch_code,
      quantity,
      reason,
      requested_by
    } = await request.json()

    // 입력 유효성 검사
    if (!product_id || !from_location_id || !to_location_id || !batch_code || !quantity || !requested_by) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: '수량은 0보다 커야 합니다.' },
        { status: 400 }
      )
    }

    // 재고 확인
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', from_location_id)
      .eq('batch_code', batch_code)
      .single()

    if (inventoryError || !inventory) {
      return NextResponse.json(
        { error: '해당 위치에 재고가 존재하지 않습니다.' },
        { status: 400 }
      )
    }

    if (inventory.current_stock < quantity) {
      return NextResponse.json(
        { error: '요청 수량이 현재 재고보다 큽니다.' },
        { status: 400 }
      )
    }

    // 이동 요청 생성
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .insert({
        product_id,
        from_location_id,
        to_location_id,
        batch_code,
        quantity,
        reason: reason || null,
        requested_by,
        status: 'pending',
        requested_at: new Date().toISOString()
      })
      .select()
      .single()

    if (transferError) {
      console.error('Transfer request creation error:', transferError)
      return NextResponse.json(
        { error: '이동 요청 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transfer_request: transferRequest,
      message: '이동 요청이 생성되었습니다. 마스터 승인을 기다리세요.'
    })

  } catch (error) {
    console.error('Transfer requests API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    const { data: requests, error } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        product:products(*),
        from_location:locations!transfer_requests_from_location_id_fkey(*),
        to_location:locations!transfer_requests_to_location_id_fkey(*)
      `)
      .eq('status', status)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Transfer requests fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transfer requests' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requests: requests || []
    })

  } catch (error) {
    console.error('Transfer requests API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}