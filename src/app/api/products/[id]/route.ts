import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id

    if (!productId) {
      return NextResponse.json(
        { error: '제품 ID가 필요합니다.' },
        { status: 400 }
      )
    }

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
      .eq('id', productId)

    if (productError) {
      console.error('Product deletion error:', productError)
      return NextResponse.json(
        { error: '제품 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '제품이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Product deletion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}