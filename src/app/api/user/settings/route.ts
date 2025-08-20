import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PUT(request: NextRequest) {
  try {
    const { userId, alert_threshold } = await request.json()

    if (!userId || alert_threshold === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (alert_threshold < 0) {
      return NextResponse.json(
        { error: 'Alert threshold must be 0 or greater' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ alert_threshold })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Settings update error:', error)
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    // 비밀번호 해시는 클라이언트에 반환하지 않음
    const { password_hash, ...userWithoutPassword } = data
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    })

  } catch (error) {
    console.error('Settings API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}