import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    // users 테이블의 모든 사용자 조회 (테스트용)
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('username, role, alert_threshold, created_at')
      .limit(10)

    if (error) {
      console.error('Users query error:', error)
      return NextResponse.json({
        error: 'Failed to fetch users',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      users,
      count: users?.length || 0
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}