import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface UpdateItem {
  itemId: string
  productId: string
  locationId: string
  batchCode?: string
  oldStock: number
  newStock: number
  difference: number
}

export async function PUT(request: NextRequest) {
  try {
    const { updates, username }: { updates: UpdateItem[]; username: string } = await request.json()

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: '업데이트할 항목이 없습니다.' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 처리하기 위해 각 업데이트를 순차적으로 실행
    for (const update of updates) {
      // 1. 재고 업데이트
      const { error: inventoryError } = await supabaseAdmin
        .from('inventory')
        .update({
          current_stock: update.newStock,
          last_updated: new Date().toISOString(),
          last_modified_by: username
        })
        .eq('id', update.itemId)

      if (inventoryError) {
        console.error('Inventory update error:', inventoryError)
        return NextResponse.json(
          { error: `재고 업데이트에 실패했습니다: ${inventoryError.message}` },
          { status: 500 }
        )
      }

      // 2. 재고 이동 기록 추가 (배치코드 포함)
      const movementType = update.difference > 0 ? 'in' : update.difference < 0 ? 'out' : 'adjustment'
      const { error: movementError } = await supabaseAdmin
        .from('inventory_movements')
        .insert({
          product_id: update.productId,
          location_id: update.locationId,
          batch_code: update.batchCode || null,
          movement_type: movementType,
          quantity: Math.abs(update.difference),
          previous_stock: update.oldStock,
          new_stock: update.newStock,
          movement_date: new Date().toISOString().split('T')[0],
          notes: '일괄 재고 수정',
          modified_by: username
        })

      if (movementError) {
        console.error('Movement creation error:', movementError)
        // 이동 기록 실패는 로그만 남기고 계속 진행
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updates.length}개 항목이 성공적으로 업데이트되었습니다.`,
      updatedCount: updates.length
    })

  } catch (error) {
    console.error('Bulk update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}