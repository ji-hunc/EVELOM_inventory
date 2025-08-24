import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: productId } = await params
    const { name, category_id, description, image_url, code, cost_price } = await request.json()

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

    // 제품 정보 업데이트
    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        name: name.trim(),
        category_id,
        code: code?.trim() || null,
        description: description?.trim() || null,
        image_url: image_url || null,
        cost_price: cost_price || null,
        updated_at: new Date().toISOString()
      })
      .eq('name', productId) // name을 PK로 사용
      .select()
      .single()

    if (updateError) {
      console.error('Product update error:', updateError)
      return NextResponse.json(
        { error: '제품 수정에 실패했습니다.', details: updateError.message },
        { status: 500 }
      )
    }

    // 제품명이 변경된 경우, 관련 재고와 이동 기록의 product_id도 업데이트
    if (productId !== name.trim()) {
      // 재고 데이터의 product_id 업데이트
      const { error: inventoryUpdateError } = await supabaseAdmin
        .from('inventory')
        .update({ product_id: name.trim() })
        .eq('product_id', productId)

      if (inventoryUpdateError) {
        console.error('Inventory product_id update error:', inventoryUpdateError)
      }

      // 재고 이동 기록의 product_id 업데이트
      const { error: movementUpdateError } = await supabaseAdmin
        .from('inventory_movements')
        .update({ product_id: name.trim() })
        .eq('product_id', productId)

      if (movementUpdateError) {
        console.error('Movement product_id update error:', movementUpdateError)
      }
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      message: '제품 정보가 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Product update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: productId } = await params
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')
    const batchCode = searchParams.get('batch_code')
    const deleteAll = searchParams.get('delete_all') === 'true'

    if (!productId) {
      return NextResponse.json(
        { error: '제품 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (deleteAll) {
      // 전체 제품 삭제 (모든 위치)
      // 1. 먼저 해당 제품의 재고 이동 기록 삭제
      const { error: movementError } = await supabaseAdmin
        .from('inventory_movements')
        .delete()
        .eq('product_id', productId)

      if (movementError) {
        console.error('Movement deletion error:', movementError)
        return NextResponse.json(
          { error: '재고 이동 기록 삭제에 실패했습니다.' },
          { status: 500 }
        )
      }

      // 2. 재고 데이터 삭제
      const { error: inventoryError } = await supabaseAdmin
        .from('inventory')
        .delete()
        .eq('product_id', productId)

      if (inventoryError) {
        console.error('Inventory deletion error:', inventoryError)
        return NextResponse.json(
          { error: '재고 데이터 삭제에 실패했습니다.' },
          { status: 500 }
        )
      }

      // 3. 제품 삭제
      const { error: productError } = await supabaseAdmin
        .from('products')
        .delete()
        .eq('name', productId) // name을 FK로 사용

      if (productError) {
        console.error('Product deletion error:', productError)
        return NextResponse.json(
          { error: '제품 삭제에 실패했습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: '제품이 모든 위치에서 삭제되었습니다.'
      })
    } else {
      // 특정 위치의 재고만 삭제
      if (!locationId) {
        return NextResponse.json(
          { error: '위치 정보가 필요합니다.' },
          { status: 400 }
        )
      }

      let inventoryQuery = supabaseAdmin
        .from('inventory')
        .delete()
        .eq('product_id', productId)
        .eq('location_id', locationId)

      // 배치코드가 있는 경우 배치별 삭제
      if (batchCode) {
        inventoryQuery = inventoryQuery.eq('batch_code', batchCode)
      }

      const { error: inventoryError } = await inventoryQuery

      if (inventoryError) {
        console.error('Inventory deletion error:', inventoryError)
        return NextResponse.json(
          { error: '재고 삭제에 실패했습니다.' },
          { status: 500 }
        )
      }

      // 해당 배치의 재고 이동 기록도 삭제
      let movementQuery = supabaseAdmin
        .from('inventory_movements')
        .delete()
        .eq('product_id', productId)
        .eq('location_id', locationId)

      if (batchCode) {
        movementQuery = movementQuery.eq('batch_code', batchCode)
      }

      const { error: movementError } = await movementQuery

      if (movementError) {
        console.error('Movement deletion error:', movementError)
        // 이동 기록 삭제 실패는 치명적이지 않으므로 경고만
        console.warn('Movement deletion failed but continuing')
      }

      return NextResponse.json({
        success: true,
        message: batchCode 
          ? `${locationId}의 ${batchCode} 배치가 삭제되었습니다.`
          : `${locationId}의 재고가 삭제되었습니다.`
      })
    }

  } catch (error) {
    console.error('Product deletion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}