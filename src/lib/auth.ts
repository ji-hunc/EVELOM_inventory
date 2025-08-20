import crypto from 'crypto'
import { supabaseAdmin } from './supabase-admin'
import { User } from '@/types'

export async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password + 'evelom_salt').digest('hex')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = crypto.createHash('sha256').update(password + 'evelom_salt').digest('hex')
  return hashedInput === hash
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !user) {
      return null
    }

    const isValidPassword = await verifyPassword(password, user.password_hash)
    
    if (!isValidPassword) {
      return null
    }

    // 비밀번호 해시는 클라이언트에 반환하지 않음
    const { password_hash, ...userWithoutPassword } = user
    return userWithoutPassword
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

export async function createUser(userData: {
  username: string
  password: string
  role: 'master' | 'general'
  location?: string
  alert_threshold?: number
}): Promise<User | null> {
  try {
    const hashedPassword = await hashPassword(userData.password)
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert([
        {
          username: userData.username,
          password_hash: hashedPassword,
          role: userData.role,
          location: userData.location,
          alert_threshold: userData.alert_threshold || 30
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('User creation error:', error)
      return null
    }

    const { password_hash, ...userWithoutPassword } = user
    return userWithoutPassword
  } catch (error) {
    console.error('User creation error:', error)
    return null
  }
}