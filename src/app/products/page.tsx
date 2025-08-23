'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Category, Product } from '@/types'
import { Package, Plus, Edit, Trash2, Image as ImageIcon, Download, Upload, Check } from 'lucide-react'
import ProductRegistrationModal from '@/components/ProductRegistrationModal'
import { downloadExcelTemplate, parseExcelFile, ExcelProductData } from '@/lib/excel-template'

export default function ProductsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showExcelUpload, setShowExcelUpload] = useState(false)
  const [excelData, setExcelData] = useState<ExcelProductData[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/inventory')
      if (!response.ok) {
        throw new Error('Failed to load data')
      }
      
      const { data } = await response.json()
      setProducts(data.products || [])
      setCategories(data.categories || [])
      
    } catch (error) {
      console.error('데이터 로드 중 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`${product.name} 제품을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/products/${product.name}?delete_all=true`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '삭제에 실패했습니다.')
      }

      const result = await response.json()
      alert(result.message)
      loadData()

    } catch (error) {
      console.error('Delete product error:', error)
      alert('삭제 중 오류가 발생했습니다: ' + (error as Error).message)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const data = await parseExcelFile(file)
      setExcelData(data)
      setShowExcelUpload(true)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleBulkRegister = async () => {
    if (excelData.length === 0) {
      alert('등록할 데이터가 없습니다.')
      return
    }

    if (!confirm(`총 ${excelData.length}개의 제품을 등록하시겠습니까?`)) {
      return
    }

    setIsUploading(true)
    try {
      console.log('일괄 등록 데이터:', excelData) // 디버깅용

      const response = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ products: excelData })
      })

      const responseData = await response.json()
      console.log('서버 응답:', responseData) // 디버깅용

      if (!response.ok) {
        throw new Error(responseData.error || '일괄 등록에 실패했습니다.')
      }

      alert(`성공적으로 ${responseData.count}개의 제품이 등록되었습니다.`)
      setShowExcelUpload(false)
      setExcelData([])
      loadData()

    } catch (error) {
      console.error('Bulk register error:', error)
      alert('일괄 등록 중 오류가 발생했습니다: ' + (error as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-primary-600">로딩 중...</div>
      </div>
    )
  }

  if (!user || (user.role !== 'master' && user.role !== 'readonly')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h2>
          <p className="text-gray-600">마스터 또는 읽기전용 계정만 제품 관리 페이지에 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-primary-600" />
                제품 관리
              </h1>
              <p className="text-gray-600 mt-1">제품 기본 정보를 등록하고 관리합니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadExcelTemplate}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                템플릿 다운로드
              </button>
              {user.role === 'master' && (
                <>
                  <label className="btn-secondary flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    엑셀 업로드
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowRegistrationModal(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    새 제품 등록
                  </button>
                </>
              )}
              {user.role === 'readonly' && (
                <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-md">
                  📖 읽기 전용 - 조회만 가능
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 제품 목록 */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              등록된 제품 목록 ({products.length}개)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    이미지
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    제품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    카테고리
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    제품코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    등록일
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      등록된 제품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  products.map((product, index) => (
                    <tr key={product.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {product.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {product.category?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                        {product.code || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(product.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.role === 'master' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedProduct(product)
                                setShowRegistrationModal(true)
                              }}
                              className="text-primary-600 hover:text-primary-900"
                              title="수정"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product)}
                              className="text-red-600 hover:text-red-900"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">조회만 가능</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 제품 등록/수정 모달 */}
      <ProductRegistrationModal
        isOpen={showRegistrationModal}
        onClose={() => {
          setShowRegistrationModal(false)
          setSelectedProduct(null)
        }}
        product={selectedProduct}
        categories={categories}
        onProductSaved={loadData}
      />

      {/* 엑셀 데이터 확인 모달 */}
      {showExcelUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">엑셀 데이터 확인</h2>
              <button
                onClick={() => {
                  setShowExcelUpload(false)
                  setExcelData([])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  총 <span className="font-semibold text-primary-600">{excelData.length}개</span>의 제품이 감지되었습니다.
                  데이터를 확인하고 일괄 등록을 진행하세요.
                </p>
              </div>

              <div className="overflow-x-auto max-h-96 border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        제품명
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        카테고리
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        제품코드
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        설명
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {excelData.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.제품명}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.카테고리}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.제품코드 || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.설명 || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowExcelUpload(false)
                    setExcelData([])
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={handleBulkRegister}
                  disabled={isUploading}
                  className="btn-primary flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      등록 중...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      일괄 등록하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}