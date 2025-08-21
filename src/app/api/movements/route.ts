import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const movementType = searchParams.get('movement_type')
    const productId = searchParams.get('product_id')
    const categoryId = searchParams.get('category_id')
    const searchQuery = searchParams.get('search')

    let query = supabaseAdmin
      .from('inventory_movements')
      .select(`
        id,
        product_id,
        location_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        movement_date,
        notes,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(1000)

    // 필터 적용
    if (locationId && locationId !== 'all') {
      query = query.eq('location_id', locationId)
    }

    if (startDate) {
      query = query.gte('movement_date', startDate)
    }

    if (endDate) {
      query = query.lte('movement_date', endDate)
    }

    if (movementType && movementType !== 'all') {
      query = query.eq('movement_type', movementType)
    }

    if (productId && productId !== 'all') {
      query = query.eq('product_id', productId)
    }

    const { data: movements, error } = await query

    if (error) {
      console.error('Movements fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch movements' },
        { status: 500 }
      )
    }

    // 제품과 위치 정보를 별도로 조회
    const productIds = [...new Set(movements?.map(m => m.product_id).filter(Boolean))]
    const locationIds = [...new Set(movements?.map(m => m.location_id).filter(Boolean))]

    const [productsResponse, locationsResponse, categoriesResponse] = await Promise.all([
      productIds.length > 0 ? supabaseAdmin
        .from('products')
        .select('name, category_id')
        .in('name', productIds) : { data: [] },
      locationIds.length > 0 ? supabaseAdmin
        .from('locations')
        .select('name')
        .in('name', locationIds) : { data: [] },
      supabaseAdmin
        .from('categories')
        .select('name')
    ])

    const products = productsResponse.data || []
    const locations = locationsResponse.data || []
    const categories = categoriesResponse.data || []

    // 데이터 조합
    const movementsWithDetails = movements?.map(movement => ({
      ...movement,
      product: products.find(p => p.name === movement.product_id),
      location: locations.find(l => l.name === movement.location_id)
    })) || []

    // 카테고리 필터링
    let filteredMovements = movementsWithDetails
    
    if (categoryId && categoryId !== 'all') {
      filteredMovements = filteredMovements.filter(
        movement => movement.product?.category_id === categoryId
      )
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredMovements = filteredMovements.filter(movement =>
        movement.product?.name.toLowerCase().includes(query) ||
        movement.notes?.toLowerCase().includes(query)
      )
    }

    // 카테고리 정보 추가
    filteredMovements = filteredMovements.map(movement => ({
      ...movement,
      product: movement.product ? {
        ...movement.product,
        category: categories.find(c => c.name === movement.product.category_id)
      } : null
    }))

    return NextResponse.json({
      success: true,
      movements: filteredMovements
    })

  } catch (error) {
    console.error('Movements API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}