'use client'

import { useState } from 'react'
import { X, Plus, Upload, Image as ImageIcon } from 'lucide-react'
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
    description: '',
    image_url: '',
    initial_stock: {} as Record<string, number>
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

  const handleStockChange = (locationId: string, value: string) => {
    const numValue = parseInt(value) || 0
    setFormData(prev => ({
      ...prev,
      initial_stock: {
        ...prev.initial_stock,
        [locationId]: numValue
      }
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
          description: formData.description.trim(),
          image_url: imageUrl,
          initial_stock: formData.initial_stock
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
        description: '',
        image_url: '',
        initial_stock: {}
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
      description: '',
      image_url: '',
      initial_stock: {}
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
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              위치별 초기 재고
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {locations.map(location => (
                <div key={location.id}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {location.name}
                  </label>
                  <input
                    type="number"
                    value={formData.initial_stock[location.id] || 0}
                    onChange={(e) => handleStockChange(location.id, e.target.value)}
                    className="input-field"
                    min="0"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              각 위치별 초기 재고량을 설정하세요. 0으로 두면 재고 없음으로 시작됩니다.
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