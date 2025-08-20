import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { name, category_id, description, image_url, initial_stock } = await request.json()

    // 입력 유효성 검사
    if (!name?.trim()) {
      return NextResponse.json(
        { error: '제품명은 필수입니다.' },
        { status: 400 }
      )
    }

    if (!category_id) {
      return NextResponse.json(
        { error: '카테고리는 필수입니다.' },
        { status: 400 }
      )
    }

    // 1. 제품 추가
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        name: name.trim(),
        category_id,
        description: description?.trim() || null,
        image_url: image_url || null
      })
      .select()
      .single()

    if (productError) {
      console.error('Product creation error:', productError)
      return NextResponse.json(
        { error: '제품 추가에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 2. 모든 위치에 재고 항목 생성 (초기값 0 또는 설정된 값)
    // 먼저 모든 위치 목록을 가져옴
    const { data: locations, error: locationsError } = await supabaseAdmin
      .from('locations')
      .select('id')

    if (locationsError) {
      console.error('Locations fetch error:', locationsError)
      return NextResponse.json(
        { error: '위치 정보를 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 모든 위치에 재고 항목 생성
    const inventoryInserts = locations.map(location => ({
      product_id: product.id,
      location_id: location.id,
      current_stock: initial_stock?.[location.id] || 0
    }))

    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .insert(inventoryInserts)

    if (inventoryError) {
      console.error('Inventory creation error:', inventoryError)
      // 제품은 이미 생성되었으므로, 재고만 실패한 경우 경고와 함께 성공 처리
      console.warn('Product created but inventory setup failed')
    }

    // 3. 0보다 큰 재고에 대해서만 초기 이동 기록 추가 (입고)
    const movementInserts = inventoryInserts
      .filter(item => item.current_stock > 0)
      .map(item => ({
        product_id: product.id,
        location_id: item.location_id,
        movement_type: 'in' as const,
        quantity: item.current_stock,
        previous_stock: 0,
        new_stock: item.current_stock,
        movement_date: new Date().toISOString().split('T')[0],
        notes: '신규 제품 등록 - 초기 재고'
      }))

    if (movementInserts.length > 0) {
      const { error: movementError } = await supabaseAdmin
        .from('inventory_movements')
        .insert(movementInserts)

      if (movementError) {
        console.error('Movement creation error:', movementError)
      }
    }

    return NextResponse.json({
      success: true,
      product,
      message: '제품이 성공적으로 추가되었습니다.'
    })

  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Products fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      products: products || []
    })

  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}