import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { 
      product_id, 
      location_id, 
      movement_type, 
      quantity, 
      movement_date, 
      notes 
    } = await request.json()

    // 입력 검증
    if (!product_id || !location_id || !movement_type || quantity <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 현재 재고 정보 가져오기
    const { data: currentInventory } = await supabaseAdmin
      .from('inventory')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', location_id)
      .single()

    const currentStock = currentInventory?.current_stock || 0
    let newStock = currentStock

    // 재고 이동 타입에 따른 계산
    switch (movement_type) {
      case 'in':
        newStock = currentStock + quantity
        break
      case 'out':
        newStock = currentStock - quantity
        if (newStock < 0) {
          return NextResponse.json(
            { error: 'Insufficient stock' },
            { status: 400 }
          )
        }
        break
      case 'adjustment':
        newStock = quantity
        break
      default:
        return NextResponse.json(
          { error: 'Invalid movement type' },
          { status: 400 }
        )
    }

    // 재고 이동 내역 생성
    const { error: movementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert([{
        product_id,
        location_id,
        movement_type,
        quantity: movement_type === 'adjustment' 
          ? quantity - currentStock 
          : quantity,
        previous_stock: currentStock,
        new_stock: newStock,
        movement_date,
        notes: notes || null
      }])

    if (movementError) {
      console.error('Movement creation error:', movementError)
      return NextResponse.json(
        { error: 'Failed to create movement record' },
        { status: 500 }
      )
    }

    // 재고 테이블 업데이트
    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .upsert([{
        product_id,
        location_id,
        current_stock: newStock,
        last_updated: new Date().toISOString()
      }], {
        onConflict: 'product_id,location_id'
      })

    if (inventoryError) {
      console.error('Inventory update error:', inventoryError)
      return NextResponse.json(
        { error: 'Failed to update inventory' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        previous_stock: currentStock,
        new_stock: newStock,
        movement_type,
        quantity
      }
    })

  } catch (error) {
    console.error('Inventory movement API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}