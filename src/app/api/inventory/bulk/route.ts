import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ExcelStockData } from '@/lib/excel-template'
import { getKoreanDateString, getKoreanTime } from '@/lib/date-utils'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting bulk stock input...')
    const { stocks }: { stocks: ExcelStockData[] } = await request.json()
    console.log('Received stocks:', stocks)

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ error: '등록할 재고 데이터가 없습니다.' }, { status: 400 })
    }

    // 제품명과 위치명을 실제 ID로 변환하기 위해 데이터베이스에서 조회
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('name')

    if (productsError) {
      throw new Error(`제품 조회 실패: ${productsError.message}`)
    }

    const { data: locations, error: locationsError } = await supabaseAdmin
      .from('locations')
      .select('name')

    if (locationsError) {
      throw new Error(`위치 조회 실패: ${locationsError.message}`)
    }

    const productSet = new Set(products?.map(p => p.name) || [])
    const locationSet = new Set(locations?.map(l => l.name) || [])

    console.log('Available products:', Array.from(productSet))
    console.log('Available locations:', Array.from(locationSet))

    // 데이터 검증 및 변환
    const validStocks = []
    const errors = []

    for (const [index, stock] of stocks.entries()) {
      const rowNumber = index + 1

      // 제품명 검증
      if (!productSet.has(stock.제품명)) {
        errors.push(`${rowNumber}번째 행: 존재하지 않는 제품명 '${stock.제품명}'`)
        continue
      }

      // 위치 검증
      if (!locationSet.has(stock.위치)) {
        errors.push(`${rowNumber}번째 행: 존재하지 않는 위치 '${stock.위치}'`)
        continue
      }

      // 수량 검증
      if (stock.수량 < 0) {
        errors.push(`${rowNumber}번째 행: 수량은 0 이상이어야 합니다.`)
        continue
      }

      // 배치코드 검증
      if (!stock.배치코드 || stock.배치코드.trim() === '') {
        errors.push(`${rowNumber}번째 행: 배치코드는 필수입니다.`)
        continue
      }

      // 기존 재고 확인
      const { data: existingInventory } = await supabaseAdmin
        .from('inventory')
        .select('current_stock')
        .eq('product_id', stock.제품명)
        .eq('location_id', stock.위치)
        .eq('batch_code', stock.배치코드.trim())
        .single()

      const previousStock = existingInventory ? existingInventory.current_stock : 0
      const newStock = previousStock + Number(stock.수량)

      validStocks.push({
        product_id: stock.제품명,
        location_id: stock.위치,
        batch_code: stock.배치코드.trim(),
        movement_type: 'in',
        quantity: Math.abs(Number(stock.수량)),
        previous_stock: previousStock,
        new_stock: newStock,
        movement_date: getKoreanDateString(),
        notes: '엑셀 일괄 입력'
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: '데이터 검증 실패',
        details: errors
      }, { status: 400 })
    }

    if (validStocks.length === 0) {
      return NextResponse.json({ error: '처리할 수 있는 재고 데이터가 없습니다.' }, { status: 400 })
    }

    // 재고 일괄 등록
    console.log('Inserting stocks:', validStocks)
    const { data: insertedStocks, error: insertError } = await supabaseAdmin
      .from('inventory_movements')
      .insert(validStocks)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error(`재고 등록 실패: ${insertError.message}`)
    }

    console.log('Successfully inserted stocks:', insertedStocks)

    // inventory 테이블 업데이트 또는 삽입
    for (const stock of validStocks) {
      // 기존 재고 확인
      const { data: existingInventory } = await supabaseAdmin
        .from('inventory')
        .select('id, current_stock')
        .eq('product_id', stock.product_id)
        .eq('location_id', stock.location_id)
        .eq('batch_code', stock.batch_code)
        .single()

      if (existingInventory) {
        // 기존 재고 업데이트
        const { error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({
            current_stock: stock.new_stock,
            last_updated: getKoreanTime()
          })
          .eq('id', existingInventory.id)

        if (updateError) {
          console.error('Inventory update error:', updateError)
        }
      } else {
        // 새 재고 생성
        const { error: insertError } = await supabaseAdmin
          .from('inventory')
          .insert([
            {
              product_id: stock.product_id,
              location_id: stock.location_id,
              batch_code: stock.batch_code,
              current_stock: stock.quantity,
              last_updated: getKoreanTime()
            }
          ])

        if (insertError) {
          console.error('Inventory insert error:', insertError)
        }
      }
    }

    return NextResponse.json({
      message: '재고가 성공적으로 등록되었습니다.',
      count: insertedStocks.length
    })

  } catch (error) {
    console.error('Bulk stock input error:', error)
    return NextResponse.json({
      error: '재고 일괄 입력 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : JSON.stringify(error)
    }, { status: 500 })
  }
}