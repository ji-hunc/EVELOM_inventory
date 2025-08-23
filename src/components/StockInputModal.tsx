'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Package, Download, Upload, Check } from 'lucide-react'
import { Product, Location } from '@/types'
import { downloadStockInputTemplate, parseStockExcelFile, ExcelStockData } from '@/lib/excel-template'

interface StockInputModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  locations: Location[]
  onStockAdded: () => void
}

export default function StockInputModal({
  isOpen,
  onClose,
  products,
  locations,
  onStockAdded
}: StockInputModalProps) {
  const [formData, setFormData] = useState({
    category: '',
    product_id: '',
    location_id: '',
    batch_code: '',
    quantity: ''
  })
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showExcelUpload, setShowExcelUpload] = useState(false)
  const [excelData, setExcelData] = useState<ExcelStockData[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        category: '',
        product_id: '',
        location_id: '',
        batch_code: '',
        quantity: ''
      })
      setFilteredProducts([])
      setError('')
      setShowExcelUpload(false)
      setExcelData([])
    }
  }, [isOpen])

  // 카테고리 선택시 해당 카테고리의 제품들로 필터링
  useEffect(() => {
    if (formData.category) {
      const filtered = products.filter(product => 
        product.category?.name === formData.category
      )
      setFilteredProducts(filtered)
      // 카테고리 변경시 제품 선택 초기화
      setFormData(prev => ({ ...prev, product_id: '' }))
    } else {
      setFilteredProducts([])
    }
  }, [formData.category, products])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!formData.product_id.trim()) {
        throw new Error('제품을 선택해주세요.')
      }
      
      if (!formData.location_id.trim()) {
        throw new Error('위치를 선택해주세요.')
      }

      if (!formData.batch_code.trim()) {
        throw new Error('배치코드를 입력해주세요.')
      }

      const quantity = parseInt(formData.quantity)
      if (isNaN(quantity) || quantity < 0) {
        throw new Error('수량은 0 이상이어야 합니다.')
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: formData.product_id,
          location_id: formData.location_id,
          batch_code: formData.batch_code.trim(),
          quantity: quantity,
          movement_type: 'in',
          notes: '초기 재고 입력'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '재고 입력에 실패했습니다.')
      }

      onStockAdded()
      handleClose()

    } catch (err) {
      setError(err instanceof Error ? err.message : '재고 입력 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const data = await parseStockExcelFile(file)
      setExcelData(data)
      setShowExcelUpload(true)
    } catch (error) {
      setError((error as Error).message)
    }
  }

  const handleBulkStockInput = async () => {
    if (excelData.length === 0) {
      setError('등록할 재고 데이터가 없습니다.')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const response = await fetch('/api/inventory/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stocks: excelData })
      })

      const responseData = await response.json()

      if (!response.ok) {
        let errorMessage = responseData.error || '대량 재고 입력에 실패했습니다.'
        
        // 상세 오류 정보가 있으면 추가
        if (responseData.details && Array.isArray(responseData.details)) {
          errorMessage += '\n\n상세 오류:\n' + responseData.details.join('\n')
        }
        
        throw new Error(errorMessage)
      }

      onStockAdded()
      setShowExcelUpload(false)
      setExcelData([])
      handleClose()

    } catch (error) {
      setError((error as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      category: '',
      product_id: '',
      location_id: '',
      batch_code: '',
      quantity: ''
    })
    setFilteredProducts([])
    setError('')
    setShowExcelUpload(false)
    setExcelData([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              재고 입력
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadStockInputTemplate}
              className="btn-secondary text-xs flex items-center gap-1 px-2 py-1"
              title="재고입력 템플릿 다운로드"
            >
              <Download className="w-3 h-3" />
              템플릿
            </button>
            <label className="btn-secondary text-xs flex items-center gap-1 px-2 py-1 cursor-pointer">
              <Upload className="w-3 h-3" />
              엑셀업로드
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {showExcelUpload ? (
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                총 <span className="font-semibold text-primary-600">{excelData.length}개</span>의 재고 데이터가 감지되었습니다.
                데이터를 확인하고 일괄 입력을 진행하세요.
              </p>
            </div>

            <div className="overflow-x-auto max-h-96 border rounded-lg mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">제품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">위치</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">배치코드</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {excelData.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.카테고리}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.제품명}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.위치}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.배치코드}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.수량.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-md text-sm mb-4">
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowExcelUpload(false)
                  setExcelData([])
                  setError('')
                }}
                className="flex-1 btn-secondary"
                disabled={isUploading}
              >
                뒤로
              </button>
              <button
                onClick={handleBulkStockInput}
                disabled={isUploading}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    입력 중...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    일괄 재고입력
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 선택 *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="select-field"
              required
            >
              <option value="">카테고리를 선택하세요</option>
              <option value="정제품">정제품</option>
              <option value="사셰">사셰</option>
              <option value="샘플">샘플</option>
              <option value="테스터">테스터</option>
            </select>
          </div>

          {/* 제품 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제품 선택 *
            </label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="select-field"
              required
              disabled={!formData.category}
            >
              <option value="">
                {formData.category ? '제품을 선택하세요' : '먼저 카테고리를 선택하세요'}
              </option>
              {filteredProducts.map((product, index) => (
                <option key={product.name || `product-${index}`} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* 위치 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              위치 선택 *
            </label>
            <select
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              className="select-field"
              required
            >
              <option value="">위치를 선택하세요</option>
              {locations.map((location, index) => (
                <option key={location.id || `location-${index}`} value={location.name}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          {/* 배치코드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              배치코드 *
            </label>
            <input
              type="text"
              value={formData.batch_code}
              onChange={(e) => setFormData({ ...formData, batch_code: e.target.value })}
              className="input-field"
              placeholder="배치코드를 입력하세요 (예: 2412A)"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              배치코드는 제품의 생산일자나 로트 정보를 나타냅니다
            </p>
          </div>

          {/* 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수량 *
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input-field"
              placeholder="입고 수량을 입력하세요"
              min="0"
              required
            />
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
              {isLoading ? '처리 중...' : '재고 입력'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}