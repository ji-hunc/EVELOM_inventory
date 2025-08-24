'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, Package } from 'lucide-react'
import { Product, Location, Inventory } from '@/types'

interface StockTransferModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  locations: Location[]
  inventory: Inventory[]
  onTransferCompleted: () => void
}

export default function StockTransferModal({
  isOpen,
  onClose,
  products,
  locations,
  inventory,
  onTransferCompleted
}: StockTransferModalProps) {
  const [formData, setFormData] = useState({
    fromLocation: '',
    toLocation: '',
    product: '',
    batchCode: '',
    quantity: ''
  })
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [availableBatchCodes, setAvailableBatchCodes] = useState<{code: string, stock: number}[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFormData({
        fromLocation: '',
        toLocation: '',
        product: '',
        batchCode: '',
        quantity: ''
      })
      setAvailableProducts([])
      setAvailableBatchCodes([])
      setError('')
    }
  }, [isOpen])

  // 발송 장소가 선택되면 해당 장소에 있는 제품들을 필터링
  useEffect(() => {
    if (formData.fromLocation) {
      const productsInLocation = inventory
        .filter(item => item.location_id === formData.fromLocation && item.current_stock > 0)
        .map(item => item.product_id)
        .filter((productId, index, self) => self.indexOf(productId) === index)

      const filteredProducts = products.filter(product => 
        productsInLocation.includes(product.name)
      )
      
      setAvailableProducts(filteredProducts)
      setFormData(prev => ({ ...prev, product: '', batchCode: '', quantity: '' }))
      setAvailableBatchCodes([])
    } else {
      setAvailableProducts([])
    }
  }, [formData.fromLocation, inventory, products])

  // 제품이 선택되면 해당 제품의 배치코드들을 필터링
  useEffect(() => {
    if (formData.fromLocation && formData.product) {
      const batchCodesInLocation = inventory
        .filter(item => 
          item.location_id === formData.fromLocation && 
          item.product_id === formData.product &&
          item.current_stock > 0
        )
        .map(item => ({
          code: item.batch_code,
          stock: item.current_stock
        }))

      setAvailableBatchCodes(batchCodesInLocation)
      setFormData(prev => ({ ...prev, batchCode: '', quantity: '' }))
    } else {
      setAvailableBatchCodes([])
    }
  }, [formData.fromLocation, formData.product, inventory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!formData.fromLocation) {
        throw new Error('발송 장소를 선택해주세요.')
      }
      
      if (!formData.toLocation) {
        throw new Error('도착 장소를 선택해주세요.')
      }

      if (formData.fromLocation === formData.toLocation) {
        throw new Error('발송 장소와 도착 장소는 달라야 합니다.')
      }

      if (!formData.product) {
        throw new Error('제품을 선택해주세요.')
      }

      if (!formData.batchCode) {
        throw new Error('배치코드를 선택해주세요.')
      }

      const quantity = parseInt(formData.quantity)
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('올바른 수량을 입력해주세요.')
      }

      // 재고 확인
      const selectedBatch = availableBatchCodes.find(batch => batch.code === formData.batchCode)
      if (!selectedBatch || quantity > selectedBatch.stock) {
        throw new Error(`재고가 부족합니다. 현재고: ${selectedBatch?.stock || 0}개`)
      }

      const response = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_location: formData.fromLocation,
          to_location: formData.toLocation,
          product_id: formData.product,
          batch_code: formData.batchCode,
          quantity: quantity
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '재고 이동에 실패했습니다.')
      }

      onTransferCompleted()
      handleClose()

    } catch (err) {
      setError(err instanceof Error ? err.message : '재고 이동 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      fromLocation: '',
      toLocation: '',
      product: '',
      batchCode: '',
      quantity: ''
    })
    setAvailableProducts([])
    setAvailableBatchCodes([])
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              재고 이동
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 이동 경로 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">이동 경로</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  발송 장소 *
                </label>
                <select
                  value={formData.fromLocation}
                  onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
                  className="select-field text-sm"
                  required
                >
                  <option value="">발송 장소 선택</option>
                  {locations.map((location, index) => (
                    <option key={location.name || `from-location-${index}`} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-center">
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  도착 장소 *
                </label>
                <select
                  value={formData.toLocation}
                  onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                  className="select-field text-sm"
                  required
                >
                  <option value="">도착 장소 선택</option>
                  {locations
                    .filter(location => location.name !== formData.fromLocation)
                    .map((location, index) => (
                    <option key={location.name || `to-location-${index}`} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 제품 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제품 선택 *
            </label>
            <select
              value={formData.product}
              onChange={(e) => setFormData({ ...formData, product: e.target.value })}
              className="select-field"
              required
              disabled={!formData.fromLocation}
            >
              <option value="">
                {!formData.fromLocation 
                  ? "먼저 발송 장소를 선택하세요" 
                  : availableProducts.length === 0
                  ? "선택한 장소에 재고가 없습니다"
                  : "제품을 선택하세요"
                }
              </option>
              {availableProducts.map((product, index) => (
                <option key={product.name || `product-${index}`} value={product.name}>
                  {product.name} {product.category?.name && `(${product.category.name})`}
                </option>
              ))}
            </select>
          </div>

          {/* 배치코드 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              배치코드 선택 *
            </label>
            <select
              value={formData.batchCode}
              onChange={(e) => setFormData({ ...formData, batchCode: e.target.value })}
              className="select-field"
              required
              disabled={!formData.product}
            >
              <option value="">
                {!formData.product 
                  ? "먼저 제품을 선택하세요" 
                  : availableBatchCodes.length === 0
                  ? "선택한 제품에 재고가 없습니다"
                  : "배치코드를 선택하세요"
                }
              </option>
              {availableBatchCodes.map((batch, index) => (
                <option key={batch.code || `batch-${index}`} value={batch.code}>
                  {batch.code} (재고: {batch.stock}개)
                </option>
              ))}
            </select>
          </div>

          {/* 이동 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이동 수량 *
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input-field"
              placeholder="이동할 수량을 입력하세요"
              min="1"
              max={availableBatchCodes.find(b => b.code === formData.batchCode)?.stock || 0}
              disabled={!formData.batchCode}
              required
            />
            {formData.batchCode && (
              <p className="text-xs text-gray-500 mt-1">
                최대 이동 가능 수량: {availableBatchCodes.find(b => b.code === formData.batchCode)?.stock || 0}개
              </p>
            )}
          </div>

          {error && (
            <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
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
              {isLoading ? '이동 중...' : '재고 이동'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}