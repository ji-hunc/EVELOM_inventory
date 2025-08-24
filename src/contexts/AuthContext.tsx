'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthState } from '@/types'

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (updatedUser: User) => void
  alertEnabled: boolean
  toggleAlert: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [alertEnabled, setAlertEnabled] = useState(true)

  useEffect(() => {
    // 페이지 로드 시 localStorage에서 사용자 정보 및 알림 설정 복원
    const storedUser = localStorage.getItem('evelom-user')
    const storedAlertEnabled = localStorage.getItem('evelom-alert-enabled')
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error('Failed to parse stored user:', error)
        localStorage.removeItem('evelom-user')
      }
    }
    
    if (storedAlertEnabled !== null) {
      setAlertEnabled(storedAlertEnabled === 'true')
    }
    
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData.user)
        localStorage.setItem('evelom-user', JSON.stringify(userData.user))
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('evelom-user')
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem('evelom-user', JSON.stringify(updatedUser))
  }

  const toggleAlert = () => {
    const newAlertEnabled = !alertEnabled
    setAlertEnabled(newAlertEnabled)
    localStorage.setItem('evelom-alert-enabled', newAlertEnabled.toString())
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser, alertEnabled, toggleAlert }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}