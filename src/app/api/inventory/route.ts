import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getKoreanTime, getKoreanDateString } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    // 위치 데이터 로드 (모든 사용자가 볼 수 있도록)
    const { data: locations, error: locationsError } = await supabaseAdmin
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (locationsError) {
      throw locationsError
    }

    // 카테고리 데이터 로드
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (categoriesError) {
      throw categoriesError
    }

    // 제품 데이터 로드
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('is_active', true)
      .order('name')

    if (productsError) {
      throw productsError
    }

    // 재고 데이터 로드 (모든 재고 반환, 프론트엔드에서 필터링)
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        product:products(
          *,
          category:categories(*)
        ),
        location:locations(*),
        last_modified_user:users!inventory_last_modified_by_fkey(username)
      `)
      .order('current_stock')

    if (inventoryError) {
      throw inventoryError
    }

    return NextResponse.json({
      success: true,
      data: {
        locations: locations || [],
        categories: categories || [],
        products: products || [],
        inventory: inventory || []
      }
    })

  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to load inventory data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { product_id, location_id, batch_code, quantity, movement_type, notes } = await request.json()

    // 입력 검증
    if (!product_id || !location_id || !batch_code || quantity === undefined) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: '수량은 0 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 기존 재고 확인 (이동 기록 생성 전에)
    const { data: existingInventory, error: inventoryCheckError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('product_id', product_id)
      .eq('location_id', location_id)
      .eq('batch_code', batch_code)
      .single()

    // PGRST116은 "no rows returned" 에러이므로 정상적인 경우 (새 재고)
    if (inventoryCheckError && inventoryCheckError.code !== 'PGRST116') {
      console.error('Inventory check error:', inventoryCheckError)
      return NextResponse.json(
        { error: '재고 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const previousStock = existingInventory ? existingInventory.current_stock : 0

    // 재고 이동 기록 추가
    const { data: movement, error: movementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert([
        {
          product_id,
          location_id,
          batch_code,
          movement_type: movement_type || 'in',
          quantity: Math.abs(quantity),
          previous_stock: previousStock,
          new_stock: previousStock + quantity,
          movement_date: getKoreanDateString(),
          notes: notes || '재고 입력'
        }
      ])
      .select()
      .single()

    if (movementError) {
      console.error('Movement creation error:', movementError)
      return NextResponse.json(
        { error: '재고 이동 기록 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 재고 처리 (이미 위에서 existingInventory를 확인했으므로 에러 체크만)

    if (existingInventory) {
      // 기존 재고 업데이트
      const newStock = existingInventory.current_stock + quantity
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({
          current_stock: newStock,
          last_updated: getKoreanTime()
        })
        .eq('id', existingInventory.id)

      if (updateError) {
        console.error('Inventory update error:', updateError)
        return NextResponse.json(
          { error: '재고 업데이트에 실패했습니다.' },
          { status: 500 }
        )
      }
    } else {
      // 새 재고 생성
      const { error: insertError } = await supabaseAdmin
        .from('inventory')
        .insert([
          {
            product_id,
            location_id,
            batch_code,
            current_stock: quantity,
            last_updated: getKoreanTime()
          }
        ])

      if (insertError) {
        console.error('Inventory insert error:', insertError)
        return NextResponse.json(
          { error: '재고 생성에 실패했습니다.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: '재고가 성공적으로 입력되었습니다.',
      movement
    })

  } catch (error) {
    console.error('Stock input error:', error)
    return NextResponse.json(
      { error: '재고 입력 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}