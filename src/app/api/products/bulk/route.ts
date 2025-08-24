import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ExcelProductData } from '@/lib/excel-template'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting bulk product registration...')
    console.log('Environment check:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
    
    const { products }: { products: ExcelProductData[] } = await request.json()
    console.log('Received products:', products)

    if (!products || products.length === 0) {
      return NextResponse.json({ error: '등록할 제품 데이터가 없습니다.' }, { status: 400 })
    }

    // 권한 확인은 클라이언트에서 이미 처리되었다고 가정
    // 서버사이드에서는 supabaseAdmin을 사용

    // 카테고리 조회
    console.log('Fetching categories...')
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('categories')
      .select('name')

    if (categoriesError) {
      console.error('Categories fetch error:', categoriesError)
      throw new Error(`카테고리 조회 실패: ${categoriesError.message}`)
    }

    console.log('Available categories:', categories) // 디버깅용

    const categorySet = new Set(categories?.map(cat => cat.name) || [])
    console.log('Category set:', Array.from(categorySet))

    // 제품 데이터 준비
    const productsToInsert = []
    const missingCategories = new Set<string>()

    console.log('Processing products:', products) // 디버깅용

    for (const product of products) {
      console.log('Checking category:', product.카테고리, 'in', Array.from(categorySet)) // 디버깅용
      
      if (!categorySet.has(product.카테고리)) {
        missingCategories.add(product.카테고리)
        continue
      }

      productsToInsert.push({
        name: product.제품명,
        category_id: product.카테고리, // 카테고리 이름을 직접 사용
        code: product.제품코드 || null,
        description: product.설명 || null,
        unit: 'EA', // 기본값 EA 사용
        cost_price: product.원가 || null
      })
    }

    console.log('Products to insert:', productsToInsert) // 디버깅용

    if (missingCategories.size > 0) {
      return NextResponse.json({
        error: `존재하지 않는 카테고리: ${Array.from(missingCategories).join(', ')}`
      }, { status: 400 })
    }

    if (productsToInsert.length === 0) {
      return NextResponse.json({ error: '등록할 수 있는 제품이 없습니다.' }, { status: 400 })
    }

    try {
      // 제품 일괄 등록
      console.log('Inserting products into database...')
      const { data: insertedProducts, error: insertError } = await supabaseAdmin
        .from('products')
        .insert(productsToInsert)
        .select()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`제품 등록 실패: ${insertError.message}`)
      }

      console.log('Products inserted successfully:', insertedProducts)

      return NextResponse.json({
        message: '제품이 성공적으로 등록되었습니다.',
        count: insertedProducts.length
      })
    } catch (insertError) {
      console.error('Error in product insertion:', insertError)
      throw insertError
    }

  } catch (error) {
    console.error('Bulk product registration error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : error)
    return NextResponse.json({
      error: '제품 등록 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : JSON.stringify(error)
    }, { status: 500 })
  }
}