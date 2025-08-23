'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Minus, RotateCcw, ArrowRightLeft, Trash2 } from 'lucide-react'
import { Inventory, Product, Location, User } from '@/types'
import { getKoreanDateString } from '@/lib/date-utils'

interface InventoryModalProps {
  isOpen: boolean
  onClose: () => void
  inventory: Inventory | null
  products: Product[]
  locations: Location[]
  user: User
  onSuccess: () => void
  onDelete?: (item: Inventory) => void
}

export default function InventoryModal({
  isOpen,
  onClose,
  inventory,
  products,
  locations,
  user,
  onSuccess,
  onDelete
}: InventoryModalProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    location_id: '',
    batch_code: '',
    movement_type: (user?.role === 'master' ? 'in' : 'out') as 'in' | 'out' | 'adjustment' | 'transfer' | 'request',
    quantity: '',
    movement_date: getKoreanDateString(),
    notes: '',
    to_location_id: '', // transfer용
    reason: '' // request용
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 이동 타입에 따른 수량 레이블 반환
  const getQuantityLabel = (movementType: string) => {
    switch (movementType) {
      case 'in': return '입고 수량'
      case 'out': return '출고 수량' 
      case 'adjustment': return '조정 후 수량'
      case 'transfer': return '이동 수량'
      default: return '수량'
    }
  }

  useEffect(() => {
    if (inventory && isOpen) {
      setFormData({
        product_id: inventory.product_id,
        location_id: inventory.location_id,
        batch_code: inventory.batch_code || '',
        movement_type: user.role === 'master' ? 'in' : 'out',
        quantity: '',
        movement_date: getKoreanDateString(),
        notes: '',
        to_location_id: '',
        reason: ''
      })
    }
  }, [inventory, isOpen, user.role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!formData.product_id || !formData.location_id) {
        throw new Error('제품과 위치를 선택해주세요.')
      }

      if (!formData.batch_code) {
        throw new Error('배치코드를 입력해주세요.')
      }

      const quantity = parseInt(formData.quantity.toString())
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('수량은 0보다 커야 합니다.')
      }

      // 요청 타입인 경우 (일반 계정)
      if (formData.movement_type === 'request') {
        if (!formData.to_location_id) {
          throw new Error('이동할 위치를 선택해주세요.')
        }

        const response = await fetch('/api/transfer-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product_id: formData.product_id,
            from_location_id: formData.location_id,
            to_location_id: formData.to_location_id,
            batch_code: formData.batch_code,
            quantity: quantity,
            reason: formData.reason,
            requested_by: user.username
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '요청 생성에 실패했습니다.')
        }

        const result = await response.json()
        alert(result.message || '이동 요청이 생성되었습니다.')
        
      } else if (formData.movement_type === 'transfer' && user.role === 'master') {
        // 마스터 계정의 즉시 이동
        if (!formData.to_location_id) {
          throw new Error('이동할 위치를 선택해주세요.')
        }

        const response = await fetch('/api/inventory/transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product_id: formData.product_id,
            from_location_id: formData.location_id,
            to_location_id: formData.to_location_id,
            batch_code: formData.batch_code,
            quantity: quantity,
            movement_date: formData.movement_date,
            notes: formData.notes,
            username: user.username
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '이동에 실패했습니다.')
        }
      } else {
        // 일반 재고 입출고 (마스터만)
        if (user.role !== 'master') {
          throw new Error('권한이 없습니다.')
        }

        const response = await fetch('/api/inventory/movement', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            username: user.username
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '재고 이동 중 오류가 발생했습니다.')
        }
      }

      onSuccess()
      onClose()
      
      // 폼 초기화
      setFormData({
        product_id: '',
        location_id: '',
        batch_code: '',
        movement_type: user.role === 'master' ? 'in' : 'out',
        quantity: '',
        movement_date: getKoreanDateString(),
        notes: '',
        to_location_id: '',
        reason: ''
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedProduct = products.find(p => p.name === formData.product_id)
  const currentInventoryItem = inventory && inventory.product_id === formData.product_id && inventory.location_id === formData.location_id
    ? inventory
    : null
  const currentStock = currentInventoryItem?.current_stock || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {user.role === 'master' ? '재고 관리' : '제품 이동 요청'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 제품 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제품 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              required
              disabled={!!inventory}
              className="select-field"
            >
              <option value="">제품을 선택하세요</option>
              {products.map((product, index) => (
                <option key={product.id || `product-${index}`} value={product.name}>
                  {product.name} ({product.category?.name})
                </option>
              ))}
            </select>
          </div>

          {/* 위치 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {user.role === 'master' ? '위치' : '출발 위치'} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              required
              disabled={!!inventory}
              className="select-field"
            >
              <option value="">위치를 선택하세요</option>
              {locations.map(location => (
                <option key={location.name} value={location.name}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          {/* 배치코드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              배치코드 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.batch_code}
              onChange={(e) => setFormData({ ...formData, batch_code: e.target.value })}
              required
              disabled={!!inventory}
              className="input-field font-mono"
              placeholder="예: 4030, 4030A"
            />
          </div>

          {/* 현재고 표시 */}
          {selectedProduct && formData.location_id && (
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-600">현재고</div>
              <div className="text-lg font-semibold text-gray-900">
                {currentStock.toLocaleString()} {selectedProduct.unit}
              </div>
            </div>
          )}

          {/* 이동 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이동 타입 <span className="text-red-500">*</span>
            </label>
            {user.role === 'master' ? (
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, movement_type: 'in' })}
                  className={`flex items-center justify-center p-3 rounded-md border text-sm font-medium ${
                    formData.movement_type === 'in'
                      ? 'bg-inbound-500 text-white border-inbound-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  입고
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, movement_type: 'out' })}
                  className={`flex items-center justify-center p-3 rounded-md border text-sm font-medium ${
                    formData.movement_type === 'out'
                      ? 'bg-outbound-500 text-white border-outbound-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Minus className="w-4 h-4 mr-1" />
                  출고
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, movement_type: 'adjustment' })}
                  className={`flex items-center justify-center p-3 rounded-md border text-sm font-medium ${
                    formData.movement_type === 'adjustment'
                      ? 'bg-yellow-500 text-white border-yellow-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  조정
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, movement_type: 'transfer', to_location_id: '' })}
                  className={`flex items-center justify-center p-3 rounded-md border text-sm font-medium ${
                    formData.movement_type === 'transfer'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  이동
                </button>
              </div>
            ) : (
              // 일반 계정은 출고와 조정만 가능
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, movement_type: 'out' })}
                  className={`flex items-center justify-center p-3 rounded-md border text-sm font-medium ${
                    formData.movement_type === 'out'
                      ? 'bg-outbound-500 text-white border-outbound-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Minus className="w-4 h-4 mr-1" />
                  출고
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, movement_type: 'adjustment' })}
                  className={`flex items-center justify-center p-3 rounded-md border text-sm font-medium ${
                    formData.movement_type === 'adjustment'
                      ? 'bg-yellow-500 text-white border-yellow-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  조정
                </button>
              </div>
            )}
          </div>

          {/* Transfer 목적지 위치 선택 */}
          {formData.movement_type === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이동할 위치 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.to_location_id}
                onChange={(e) => setFormData({ ...formData, to_location_id: e.target.value })}
                required={formData.movement_type === 'transfer'}
                className="select-field"
              >
                <option value="">이동할 위치를 선택하세요</option>
                {locations
                  .filter(location => location.name !== formData.location_id)
                  .map(location => (
                    <option key={location.name} value={location.name}>
                      {location.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getQuantityLabel(formData.movement_type)} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
              min="1"
              className="input-field"
              placeholder="수량을 입력하세요"
            />
            {formData.movement_type !== 'adjustment' && selectedProduct && (
              <div className="text-xs text-gray-500 mt-1">
                {formData.movement_type === 'in' ? '입고 후' : '출고 후'} 예상 재고: {' '}
                {formData.movement_type === 'in' 
                  ? (currentStock + (parseInt(formData.quantity.toString()) || 0)).toLocaleString()
                  : (currentStock - (parseInt(formData.quantity.toString()) || 0)).toLocaleString()
                } {selectedProduct.unit}
              </div>
            )}
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이동 날짜 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.movement_date}
              onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
              required
              className="input-field"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input-field"
              placeholder="추가 정보가 있다면 입력하세요"
            />
          </div>

          {error && (
            <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            {/* 삭제 버튼 - 왼쪽 */}
            {inventory && onDelete && user.role === 'master' && (
              <button
                type="button"
                onClick={() => {
                  if (inventory && confirm(`${inventory.product?.name} 제품을 삭제하시겠습니까?`)) {
                    onDelete(inventory)
                    onClose()
                  }
                }}
                className="px-4 py-2 bg-white border-2 border-red-500 text-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
            
            {/* 기본 버튼들 - 오른쪽 */}
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 btn-secondary"
                disabled={isLoading}
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 btn-primary"
                disabled={isLoading || !formData.product_id || !formData.location_id || !formData.quantity || parseInt(formData.quantity.toString()) <= 0}
              >
                {isLoading ? '처리 중...' : '등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}