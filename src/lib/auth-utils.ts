import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-admin'

export async function getCurrentUser(request: NextRequest) {
  try {
    // Authorization 헤더에서 사용자 정보 추출
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return null
    
    // 간단한 토큰 기반 인증 (실제 환경에서는 JWT 등 사용)
    const token = authHeader.replace('Bearer ', '')
    const [username] = Buffer.from(token, 'base64').toString().split(':')
    
    if (!username) return null
    
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single()
      
    return user
  } catch (error) {
    return null
  }
}

export function isReadOnlyUser(user: any): boolean {
  return user?.role === 'readonly'
}

export function canWrite(user: any): boolean {
  return user?.role === 'master' || user?.role === 'general'
}

export function isMaster(user: any): boolean {
  return user?.role === 'master'
}