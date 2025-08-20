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
        *,
        product:products(*),
        location:locations(*)
      `)
      .order('created_at', { ascending: false })

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

    // 카테고리 필터링 (클라이언트에서 처리하던 것을 서버에서 처리)
    let filteredMovements = movements || []
    
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