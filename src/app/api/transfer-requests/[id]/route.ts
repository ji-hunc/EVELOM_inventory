import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { action, approved_by, rejection_reason } = await request.json()

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: '올바르지 않은 액션입니다.' },
        { status: 400 }
      )
    }

    // 요청 정보 가져오기
    const { data: transferRequest, error: fetchError } = await supabaseAdmin
      .from('transfer_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !transferRequest) {
      return NextResponse.json(
        { error: '이동 요청을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (transferRequest.status !== 'pending') {
      return NextResponse.json(
        { error: '이미 처리된 요청입니다.' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // 승인 처리
      // 1. 현재 재고 확인
      const { data: fromInventory, error: fromError } = await supabaseAdmin
        .from('inventory')
        .select('current_stock')
        .eq('product_id', transferRequest.product_id)
        .eq('location_id', transferRequest.from_location_id)
        .eq('batch_code', transferRequest.batch_code)
        .single()

      if (fromError || !fromInventory) {
        return NextResponse.json(
          { error: '출발 위치의 재고를 찾을 수 없습니다.' },
          { status: 400 }
        )
      }

      if (fromInventory.current_stock < transferRequest.quantity) {
        return NextResponse.json(
          { error: '재고가 부족합니다.' },
          { status: 400 }
        )
      }

      // 2. 출발 위치 재고 감소
      const { error: updateFromError } = await supabaseAdmin
        .from('inventory')
        .update({
          current_stock: fromInventory.current_stock - transferRequest.quantity,
          last_updated: new Date().toISOString()
        })
        .eq('product_id', transferRequest.product_id)
        .eq('location_id', transferRequest.from_location_id)
        .eq('batch_code', transferRequest.batch_code)

      if (updateFromError) {
        console.error('From inventory update error:', updateFromError)
        return NextResponse.json(
          { error: '출발 위치 재고 업데이트에 실패했습니다.' },
          { status: 500 }
        )
      }

      // 3. 도착 위치 재고 확인/생성
      const { data: toInventory, error: toFetchError } = await supabaseAdmin
        .from('inventory')
        .select('current_stock')
        .eq('product_id', transferRequest.product_id)
        .eq('location_id', transferRequest.to_location_id)
        .eq('batch_code', transferRequest.batch_code)
        .single()

      if (toFetchError && toFetchError.code !== 'PGRST116') {
        console.error('To inventory fetch error:', toFetchError)
        return NextResponse.json(
          { error: '도착 위치 재고 확인에 실패했습니다.' },
          { status: 500 }
        )
      }

      if (toInventory) {
        // 기존 재고 증가
        const { error: updateToError } = await supabaseAdmin
          .from('inventory')
          .update({
            current_stock: toInventory.current_stock + transferRequest.quantity,
            last_updated: new Date().toISOString()
          })
          .eq('product_id', transferRequest.product_id)
          .eq('location_id', transferRequest.to_location_id)
          .eq('batch_code', transferRequest.batch_code)

        if (updateToError) {
          console.error('To inventory update error:', updateToError)
          return NextResponse.json(
            { error: '도착 위치 재고 업데이트에 실패했습니다.' },
            { status: 500 }
          )
        }
      } else {
        // 새 재고 생성
        const { error: createToError } = await supabaseAdmin
          .from('inventory')
          .insert({
            product_id: transferRequest.product_id,
            location_id: transferRequest.to_location_id,
            batch_code: transferRequest.batch_code,
            current_stock: transferRequest.quantity
          })

        if (createToError) {
          console.error('To inventory create error:', createToError)
          return NextResponse.json(
            { error: '도착 위치 재고 생성에 실패했습니다.' },
            { status: 500 }
          )
        }
      }

      // 4. 이동 기록 추가
      const movementDate = new Date().toISOString().split('T')[0]
      const movements = [
        {
          product_id: transferRequest.product_id,
          location_id: transferRequest.from_location_id,
          batch_code: transferRequest.batch_code,
          movement_type: 'out',
          quantity: -transferRequest.quantity,
          previous_stock: fromInventory.current_stock,
          new_stock: fromInventory.current_stock - transferRequest.quantity,
          movement_date: movementDate,
          notes: `${transferRequest.to_location_id}로 이동 (요청 승인)`,
          modifier: approved_by
        },
        {
          product_id: transferRequest.product_id,
          location_id: transferRequest.to_location_id,
          batch_code: transferRequest.batch_code,
          movement_type: 'in',
          quantity: transferRequest.quantity,
          previous_stock: toInventory?.current_stock || 0,
          new_stock: (toInventory?.current_stock || 0) + transferRequest.quantity,
          movement_date: movementDate,
          notes: `${transferRequest.from_location_id}에서 이동 (요청 승인)`,
          modifier: approved_by
        }
      ]

      const { error: movementError } = await supabaseAdmin
        .from('inventory_movements')
        .insert(movements)

      if (movementError) {
        console.error('Movement creation error:', movementError)
      }
    }

    // 5. 요청 상태 업데이트
    const { error: updateRequestError } = await supabaseAdmin
      .from('transfer_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: action === 'approve' ? approved_by : null,
        rejection_reason: action === 'reject' ? rejection_reason : null,
        processed_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateRequestError) {
      console.error('Transfer request update error:', updateRequestError)
      return NextResponse.json(
        { error: '요청 상태 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '이동 요청이 승인되었습니다.' : '이동 요청이 거절되었습니다.'
    })

  } catch (error) {
    console.error('Transfer request process error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}