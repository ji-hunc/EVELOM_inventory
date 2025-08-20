'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Minus, RotateCcw } from 'lucide-react'
import { Inventory, Product, Location } from '@/types'

interface InventoryModalProps {
  isOpen: boolean
  onClose: () => void
  inventory: Inventory | null
  products: Product[]
  locations: Location[]
  userRole: 'master' | 'general'
  onSuccess: () => void
}

export default function InventoryModal({
  isOpen,
  onClose,
  inventory,
  products,
  locations,
  userRole,
  onSuccess
}: InventoryModalProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    location_id: '',
    movement_type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: 0,
    movement_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (inventory && isOpen) {
      setFormData({
        product_id: inventory.product_id,
        location_id: inventory.location_id,
        movement_type: 'in',
        quantity: 0,
        movement_date: new Date().toISOString().split('T')[0],
        notes: ''
      })
    }
  }, [inventory, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!formData.product_id || !formData.location_id) {
        throw new Error('제품과 위치를 선택해주세요.')
      }

      if (formData.quantity <= 0) {
        throw new Error('수량은 0보다 커야 합니다.')
      }

      // API 호출
      const response = await fetch('/api/inventory/movement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '재고 이동 중 오류가 발생했습니다.')
      }

      onSuccess()
      onClose()
      
      // 폼 초기화
      setFormData({
        product_id: '',
        location_id: '',
        movement_type: 'in',
        quantity: 0,
        movement_date: new Date().toISOString().split('T')[0],
        notes: ''
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedProduct = products.find(p => p.id === formData.product_id)
  const currentInventoryItem = inventory && inventory.product_id === formData.product_id && inventory.location_id === formData.location_id
    ? inventory
    : null
  const currentStock = currentInventoryItem?.current_stock || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            재고 이동 등록
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
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.category?.name})
                </option>
              ))}
            </select>
          </div>

          {/* 위치 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              위치 <span className="text-red-500">*</span>
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
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
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
            <div className="grid grid-cols-3 gap-2">
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
            </div>
          </div>

          {/* 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.movement_type === 'adjustment' ? '조정 후 수량' : '이동 수량'} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              required
              min="1"
              className="input-field"
              placeholder="수량을 입력하세요"
            />
            {formData.movement_type !== 'adjustment' && selectedProduct && (
              <div className="text-xs text-gray-500 mt-1">
                {formData.movement_type === 'in' ? '입고 후' : '출고 후'} 예상 재고: {' '}
                {formData.movement_type === 'in' 
                  ? (currentStock + formData.quantity).toLocaleString()
                  : (currentStock - formData.quantity).toLocaleString()
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
              disabled={isLoading || !formData.product_id || !formData.location_id || formData.quantity <= 0}
            >
              {isLoading ? '처리 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}