'use client'

import { useState } from 'react'
import { X, Plus, Upload, Image as ImageIcon, Package } from 'lucide-react'
import { Category, Location } from '@/types'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  locations: Location[]
  onProductAdded: () => void
}

export default function AddProductModal({
  isOpen,
  onClose,
  categories,
  locations,
  onProductAdded
}: AddProductModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    code: '',
    unit: 'EA',
    description: '',
    image_url: '',
    initial_stocks: [] as { location_id: string; batch_code: string; quantity: number }[]
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB 제한
        setError('이미지 파일 크기는 5MB 이하여야 합니다.')
        return
      }
      
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.')
        return
      }

      setImageFile(file)
      setError('')
      
      // 미리보기 생성
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const addStockEntry = () => {
    setFormData(prev => ({
      ...prev,
      initial_stocks: [...prev.initial_stocks, { location_id: '', batch_code: '', quantity: 0 }]
    }))
  }

  const removeStockEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      initial_stocks: prev.initial_stocks.filter((_, i) => i !== index)
    }))
  }

  const updateStockEntry = (index: number, field: keyof typeof formData.initial_stocks[0], value: string | number) => {
    setFormData(prev => ({
      ...prev,
      initial_stocks: prev.initial_stocks.map((stock, i) => 
        i === index ? { ...stock, [field]: value } : stock
      )
    }))
  }

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return ''

    const formData = new FormData()
    formData.append('file', imageFile)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('이미지 업로드에 실패했습니다.')
    }

    const { url } = await response.json()
    return url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!formData.name.trim()) {
        throw new Error('제품명을 입력해주세요.')
      }
      
      if (!formData.category_id) {
        throw new Error('카테고리를 선택해주세요.')
      }

      // 이미지 업로드 (선택사항)
      let imageUrl = formData.image_url
      if (imageFile) {
        imageUrl = await uploadImage()
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          category_id: formData.category_id,
          code: formData.code.trim(),
          unit: formData.unit,
          description: formData.description.trim(),
          image_url: imageUrl,
          initial_stocks: formData.initial_stocks.filter(stock => 
            stock.location_id && stock.batch_code && stock.quantity > 0
          )
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '제품 추가에 실패했습니다.')
      }

      // 성공 시 폼 초기화
      setFormData({
        name: '',
        category_id: '',
        code: '',
        unit: 'EA',
        description: '',
        image_url: '',
        initial_stocks: []
      })
      setImageFile(null)
      setImagePreview('')
      
      onProductAdded()
      onClose()

    } catch (err) {
      setError(err instanceof Error ? err.message : '제품 추가 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      category_id: '',
      code: '',
      unit: 'EA',
      description: '',
      image_url: '',
      initial_stocks: []
    })
    setImageFile(null)
    setImagePreview('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">새 제품 추가</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제품명 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="제품명을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리 *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="select-field"
                required
              >
                <option value="">카테고리 선택</option>
                {categories.map((category, index) => (
                  <option key={category.id || `category-${index}`} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제품 코드
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="input-field"
                placeholder="제품 코드 (선택사항)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                단위 *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="select-field"
                required
              >
                <option value="EA">개</option>
                <option value="KG">kg</option>
                <option value="L">L</option>
                <option value="ML">ml</option>
                <option value="G">g</option>
                <option value="BOX">박스</option>
                <option value="SET">세트</option>
              </select>
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제품 설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="제품에 대한 설명을 입력하세요 (선택사항)"
            />
          </div>

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제품 이미지
            </label>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">클릭하여 업로드</span> 또는 드래그 앤 드롭
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF (최대 5MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
              
              {/* 이미지 미리보기 */}
              {imagePreview && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="relative w-20 h-20">
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{imageFile?.name}</p>
                    <p className="text-xs text-gray-500">
                      {imageFile && (imageFile.size / 1024 / 1024).toFixed(2)}MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 초기 재고 설정 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                초기 재고 설정 (배치별)
              </label>
              <button
                type="button"
                onClick={addStockEntry}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                배치 추가
              </button>
            </div>
            
            {formData.initial_stocks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>초기 재고가 없습니다.</p>
                <p className="text-sm">필요시 &quot;배치 추가&quot; 버튼을 클릭하세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.initial_stocks.map((stock, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border border-gray-200 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        위치
                      </label>
                      <select
                        value={stock.location_id}
                        onChange={(e) => updateStockEntry(index, 'location_id', e.target.value)}
                        className="select-field text-sm"
                        required
                      >
                        <option value="">위치 선택</option>
                        {locations.map(location => (
                          <option key={location.id} value={location.name}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        배치코드
                      </label>
                      <input
                        type="text"
                        value={stock.batch_code}
                        onChange={(e) => updateStockEntry(index, 'batch_code', e.target.value)}
                        className="input-field text-sm"
                        placeholder="예: 4030, 4030A"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        수량
                      </label>
                      <input
                        type="number"
                        value={stock.quantity}
                        onChange={(e) => updateStockEntry(index, 'quantity', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                        className="input-field text-sm"
                        min="0"
                        placeholder="0"
                        required
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeStockEntry(index)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              배치코드 형식: 첫 자리(생산연도) + 3자리(일련번호) + 선택적 알파벳 (예: 4030, 4030A)
            </p>
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
              {isLoading ? '추가 중...' : '제품 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}