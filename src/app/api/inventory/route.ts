import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    // 위치 데이터 로드
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

    // 재고 데이터 로드
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        product:products(*),
        location:locations(*)
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