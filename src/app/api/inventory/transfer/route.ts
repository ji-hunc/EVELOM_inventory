import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { 
      product_id, 
      from_location_id, 
      to_location_id, 
      quantity, 
      movement_date, 
      notes,
      username 
    } = await request.json()

    // 입력 유효성 검사
    if (!product_id || !from_location_id || !to_location_id || !quantity || !username) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (from_location_id === to_location_id) {
      return NextResponse.json(
        { error: '출발지와 목적지가 같을 수 없습니다.' },
        { status: 400 }
      )
    }

    // Transfer Group ID 생성 (출고와 입고를 묶기 위함)
    const transferGroupId = uuidv4()

    // 1. 출발지 재고 확인
    const { data: fromInventory, error: fromInventoryError } = await supabaseAdmin
      .from('inventory')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', from_location_id)
      .single()

    if (fromInventoryError || !fromInventory) {
      return NextResponse.json(
        { error: '출발지 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (fromInventory.current_stock < quantity) {
      return NextResponse.json(
        { error: '재고가 부족합니다.' },
        { status: 400 }
      )
    }

    // 2. 목적지 재고 확인 (없으면 생성)
    let { data: toInventory, error: toInventoryError } = await supabaseAdmin
      .from('inventory')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', to_location_id)
      .single()

    if (toInventoryError && toInventoryError.code === 'PGRST116') {
      // 목적지에 해당 제품의 재고가 없으면 생성
      const { data: newInventory, error: createError } = await supabaseAdmin
        .from('inventory')
        .insert({
          product_id,
          location_id: to_location_id,
          current_stock: 0,
          last_modified_by: username
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json(
          { error: '목적지 재고 생성에 실패했습니다.' },
          { status: 500 }
        )
      }

      toInventory = newInventory
    } else if (toInventoryError) {
      return NextResponse.json(
        { error: '목적지 재고 확인에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 3. 출발지 재고 차감
    const { error: updateFromError } = await supabaseAdmin
      .from('inventory')
      .update({
        current_stock: fromInventory.current_stock - quantity,
        last_updated: new Date().toISOString(),
        last_modified_by: username
      })
      .eq('product_id', product_id)
      .eq('location_id', from_location_id)

    if (updateFromError) {
      return NextResponse.json(
        { error: '출발지 재고 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 4. 목적지 재고 증가
    const { error: updateToError } = await supabaseAdmin
      .from('inventory')
      .update({
        current_stock: toInventory.current_stock + quantity,
        last_updated: new Date().toISOString(),
        last_modified_by: username
      })
      .eq('product_id', product_id)
      .eq('location_id', to_location_id)

    if (updateToError) {
      return NextResponse.json(
        { error: '목적지 재고 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 5. 이동 기록 생성 (출고)
    const { error: outMovementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert({
        product_id,
        location_id: from_location_id,
        movement_type: 'transfer',
        quantity: -quantity, // 음수로 출고 표시
        previous_stock: fromInventory.current_stock,
        new_stock: fromInventory.current_stock - quantity,
        movement_date,
        notes: notes || `${to_location_id}로 이동`,
        modified_by: username,
        transfer_group_id: transferGroupId,
        from_location_id,
        to_location_id
      })

    if (outMovementError) {
      console.error('Out movement creation error:', outMovementError)
    }

    // 6. 이동 기록 생성 (입고)
    const { error: inMovementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert({
        product_id,
        location_id: to_location_id,
        movement_type: 'transfer',
        quantity: quantity, // 양수로 입고 표시
        previous_stock: toInventory.current_stock,
        new_stock: toInventory.current_stock + quantity,
        movement_date,
        notes: notes || `${from_location_id}에서 이동`,
        modified_by: username,
        transfer_group_id: transferGroupId,
        from_location_id,
        to_location_id
      })

    if (inMovementError) {
      console.error('In movement creation error:', inMovementError)
    }

    return NextResponse.json({
      success: true,
      message: '재고 이동이 성공적으로 완료되었습니다.',
      transfer_group_id: transferGroupId
    })

  } catch (error) {
    console.error('Transfer API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}