'use client'

import { useState } from 'react'
import { X, Settings, AlertTriangle } from 'lucide-react'
import { User } from '@/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user: User
  onSettingsUpdate: (updatedUser: User) => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  onSettingsUpdate
}: SettingsModalProps) {
  const [alertThreshold, setAlertThreshold] = useState(user.alert_threshold)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    console.log('Settings submit - Current user:', user)

    try {
      if (alertThreshold < 0) {
        throw new Error('임계치는 0 이상이어야 합니다.')
      }

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: user.username,
          alert_threshold: alertThreshold
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '설정 저장에 실패했습니다.')
      }

      const { user: updatedUser } = await response.json()
      onSettingsUpdate(updatedUser)
      
      // localStorage 업데이트
      localStorage.setItem('evelom-user', JSON.stringify(updatedUser))
      
      onClose()

    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">설정</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 사용자 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">사용자 정보</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div><strong>아이디:</strong> {user.username}</div>
              <div><strong>역할:</strong> {user.role === 'master' ? '마스터' : '일반'}</div>
              {user.location && <div><strong>담당 위치:</strong> {user.location}</div>}
            </div>
          </div>

          {/* 재고 부족 알림 임계치 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning-500" />
                재고 부족 알림 임계치
              </div>
            </label>
            <div className="space-y-2">
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                min="0"
                className="input-field"
                placeholder="알림을 받을 최소 재고량"
              />
              <div className="text-xs text-gray-500">
                재고가 이 값 이하로 떨어지면 경고 표시됩니다.
                현재 설정: <strong>{alertThreshold}개 이하</strong>
              </div>
            </div>
          </div>

          {/* 알림 미리보기 */}
          <div className="bg-warning-50 border border-warning-200 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-warning-700">미리보기</div>
                <div className="text-sm text-warning-600 mt-1">
                  재고가 {alertThreshold}개 이하인 품목들이 이렇게 표시됩니다.
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={isLoading}
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}