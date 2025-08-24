import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'
import { getKoreanTime } from '@/lib/date-utils'

export async function POST(request: NextRequest) {
  try {
    const { 
      product_id, 
      from_location_id_id, 
      to_location_id_id, 
      batch_code,
      quantity, 
      movement_date, 
      notes,
      username 
    } = await request.json()

    // 입력 유효성 검사
    if (!product_id || !from_location_id_id || !to_location_id_id || !batch_code || !quantity) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (from_location_id_id === to_location_id_id) {
      return NextResponse.json(
        { error: '발송 장소와 도착 장소는 달라야 합니다.' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: '수량은 1 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // Transfer Group ID 생성 (출고와 입고를 묶기 위함)
    const transferGroupId = uuidv4()

    // 1. 발송 장소의 재고 확인
    const { data: fromInventory, error: fromInventoryError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('product_id', product_id)
      .eq('location_id', from_location_id_id)
      .eq('batch_code', batch_code)
      .single()

    if (fromInventoryError || !fromInventory) {
      return NextResponse.json(
        { error: '발송 장소에 해당 제품의 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (fromInventory.current_stock < quantity) {
      return NextResponse.json(
        { error: `재고가 부족합니다. 현재고: ${fromInventory.current_stock}개` },
        { status: 400 }
      )
    }

    // 2. 도착 장소의 재고 확인 (없으면 생성)
    const { data: toInventoryResult, error: toInventoryError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('product_id', product_id)
      .eq('location_id', to_location_id_id)
      .eq('batch_code', batch_code)
      .single()

    let toInventory = toInventoryResult

    if (toInventoryError && toInventoryError.code === 'PGRST116') {
      // 도착 장소에 해당 제품의 재고가 없으면 생성
      const { data: newInventory, error: createError } = await supabaseAdmin
        .from('inventory')
        .insert({
          product_id,
          location_id: to_location_id_id,
          batch_code,
          current_stock: 0,
          last_updated: getKoreanTime(),
          last_modified_by: username,
          production_date: fromInventory.production_date,
          expiry_date: fromInventory.expiry_date
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json(
          { error: '도착 장소 재고 생성에 실패했습니다.' },
          { status: 500 }
        )
      }

      toInventory = newInventory
    } else if (toInventoryError) {
      return NextResponse.json(
        { error: '도착 장소 재고 확인에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 3. 발송 장소 재고 차감
    const { error: updateFromError } = await supabaseAdmin
      .from('inventory')
      .update({
        current_stock: fromInventory.current_stock - quantity,
        last_updated: getKoreanTime(),
        last_modified_by: username
      })
      .eq('id', fromInventory.id)

    if (updateFromError) {
      return NextResponse.json(
        { error: '발송 장소 재고 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 4. 도착 장소 재고 증가
    const { error: updateToError } = await supabaseAdmin
      .from('inventory')
      .update({
        current_stock: toInventory.current_stock + quantity,
        last_updated: getKoreanTime(),
        last_modified_by: username
      })
      .eq('id', toInventory.id)

    if (updateToError) {
      return NextResponse.json(
        { error: '도착 장소 재고 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    const movementDate = movement_date || getKoreanTime().split('T')[0]

    // 5. 이동 기록 생성 (출발지 - 마이너스)
    const { error: outMovementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert({
        product_id,
        location_id: from_location_id_id,
        batch_code,
        movement_type: 'transfer',
        quantity: -quantity, // 음수로 출발지 차감 표시
        previous_stock: fromInventory.current_stock,
        new_stock: fromInventory.current_stock - quantity,
        movement_date: movementDate,
        notes: notes || `${to_location_id_id}로 이동`,
        modified_by: username,
        transfer_group_id: transferGroupId,
        to_location_id: to_location_id_id
      })

    if (outMovementError) {
      console.error('Out movement creation error:', outMovementError)
    }

    // 6. 이동 기록 생성 (도착지 - 플러스)
    const { error: inMovementError } = await supabaseAdmin
      .from('inventory_movements')
      .insert({
        product_id,
        location_id: to_location_id_id,
        batch_code,
        movement_type: 'transfer',
        quantity, // 양수로 도착지 증가 표시
        previous_stock: toInventory.current_stock,
        new_stock: toInventory.current_stock + quantity,
        movement_date: movementDate,
        notes: notes || `${from_location_id_id}에서 이동`,
        modified_by: username,
        transfer_group_id: transferGroupId,
        from_location_id: from_location_id_id
      })

    if (inMovementError) {
      console.error('In movement creation error:', inMovementError)
    }

    return NextResponse.json({
      success: true,
      message: `${product_id} ${quantity}개가 ${from_location_id_id}에서 ${to_location_id_id}로 이동되었습니다.`
    })

  } catch (error) {
    console.error('Stock transfer error:', error)
    return NextResponse.json(
      { error: '재고 이동 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}