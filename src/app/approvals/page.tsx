'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { CheckCircle, XCircle, Clock, Package2, MapPin, User } from 'lucide-react'

interface TransferRequest {
  id: string
  product_id: string
  from_location_id: string
  to_location_id: string
  batch_code: string
  quantity: number
  reason: string | null
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  processed_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  product: {
    name: string
    code: string | null
  }
  from_location: {
    name: string
  }
  to_location: {
    name: string
  }
}

export default function ApprovalsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'master')) {
      router.push('/dashboard')
      return
    }
    
    if (user && user.role === 'master') {
      loadRequests()
    }
  }, [user, isLoading, router, activeTab])

  const loadRequests = async () => {
    try {
      setIsDataLoading(true)
      const status = activeTab === 'pending' ? 'pending' : 'processed'
      
      const response = await fetch(`/api/transfer-requests?status=${status}`)
      if (!response.ok) throw new Error('Failed to fetch requests')
      
      const { requests: data } = await response.json()
      setRequests(data)
    } catch (error) {
      console.error('Failed to load transfer requests:', error)
    } finally {
      setIsDataLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    try {
      setProcessingId(requestId)
      
      const response = await fetch(`/api/transfer-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approved_by: user?.username
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Approval failed')
      }

      await loadRequests()
    } catch (error) {
      console.error('Approval error:', error)
      alert('승인 중 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string, reason: string) => {
    try {
      setProcessingId(requestId)
      
      const response = await fetch(`/api/transfer-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: reason,
          approved_by: user?.username
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Rejection failed')
      }

      await loadRequests()
    } catch (error) {
      console.error('Rejection error:', error)
      alert('거절 중 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setProcessingId(null)
    }
  }

  const promptReject = (requestId: string) => {
    const reason = prompt('거절 사유를 입력하세요:')
    if (reason !== null) {
      handleReject(requestId, reason)
    }
  }

  if (isLoading || isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary-600 text-lg">로딩 중...</div>
      </div>
    )
  }

  if (!user || user.role !== 'master') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        user={user}
        onLogout={() => router.push('/')}
        viewMode="current"
        onViewModeChange={() => {}}
        showImages={false}
        onToggleImages={() => {}}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">제품 이동 승인 관리</h1>
          <p className="text-gray-600 mt-2">일반 계정의 제품 이동 요청을 승인하거나 거절합니다.</p>
        </div>

        {/* 탭 */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'pending'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  대기 중 요청
                </div>
              </button>
              <button
                onClick={() => setActiveTab('processed')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'processed'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                처리된 요청
              </button>
            </nav>
          </div>

          <div className="p-6">
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <Package2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  {activeTab === 'pending' ? '대기 중인 요청이 없습니다' : '처리된 요청이 없습니다'}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {activeTab === 'pending' 
                    ? '일반 계정에서 제품 이동을 요청하면 여기에 표시됩니다.'
                    : '승인 또는 거절된 요청들이 여기에 표시됩니다.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <Package2 className="w-5 h-5 text-primary-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {request.product.name}
                          </h3>
                          {request.product.code && (
                            <span className="text-sm text-gray-500">({request.product.code})</span>
                          )}
                          <span className="font-mono text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {request.batch_code}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {request.from_location.name} → {request.to_location.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Package2 className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              수량: {request.quantity.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              요청자: {request.requested_by}
                            </span>
                          </div>
                        </div>
                        
                        {request.reason && (
                          <div className="mb-4">
                            <span className="text-sm font-medium text-gray-700">요청 사유: </span>
                            <span className="text-sm text-gray-600">{request.reason}</span>
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          요청 시간: {new Date(request.requested_at).toLocaleString('ko-KR')}
                        </div>

                        {request.status !== 'pending' && (
                          <div className="mt-2 text-xs text-gray-500">
                            처리 시간: {request.processed_at && new Date(request.processed_at).toLocaleString('ko-KR')}
                            {request.approved_by && ` (처리자: ${request.approved_by})`}
                            {request.rejection_reason && (
                              <div className="text-red-600 mt-1">거절 사유: {request.rejection_reason}</div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-6">
                        {request.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                              className="btn-primary flex items-center gap-1 text-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              승인
                            </button>
                            <button
                              onClick={() => promptReject(request.id)}
                              disabled={processingId === request.id}
                              className="btn-secondary flex items-center gap-1 text-sm"
                            >
                              <XCircle className="w-4 h-4" />
                              거절
                            </button>
                          </>
                        ) : (
                          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                            request.status === 'approved' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status === 'approved' ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                승인됨
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                거절됨
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}