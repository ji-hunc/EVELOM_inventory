import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PUT(request: NextRequest) {
  try {
    const { username, alert_threshold, alert_enabled } = await request.json()
    console.log('Settings API - Received data:', { username, alert_threshold, alert_enabled })

    if (!username || alert_threshold === undefined) {
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

    // 먼저 사용자가 존재하는지 확인
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('username, alert_threshold, alert_enabled')
      .eq('username', username)
      .single()

    console.log('Existing user check:', { existingUser, checkError })

    if (checkError && checkError.code === 'PGRST116') {
      // 사용자가 존재하지 않으면 생성
      console.log('User not found, creating new user:', username)
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          username,
          role: username.includes('admin') ? 'master' : 'general',
          alert_threshold,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('User creation error:', createError)
        return NextResponse.json(
          { error: 'Failed to create user', details: createError },
          { status: 500 }
        )
      }

      const { password_hash, ...userWithoutPassword } = newUser
      return NextResponse.json({
        success: true,
        user: userWithoutPassword
      })
    } else if (checkError || !existingUser) {
      console.error('User lookup error:', { username, checkError })
      return NextResponse.json(
        { error: 'User lookup failed', username, details: checkError },
        { status: 500 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ alert_threshold })
      .eq('username', username)
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