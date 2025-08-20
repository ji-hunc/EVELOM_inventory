'use client'

import { useState } from 'react'
import { Inventory, Category, Product, Location } from '@/types'
import { Edit, Plus, AlertTriangle, Package, Download, Trash2, Save, X } from 'lucide-react'
import { exportInventoryToExcel } from '@/lib/excel'
import Image from 'next/image'
import InventoryModal from './InventoryModal'

interface InventoryTableProps {
  inventory: Inventory[]
  categories: Category[]
  products: Product[]
  locations: Location[]
  showImages: boolean
  viewMode: 'current' | 'monthly' | 'transactions'
  userRole: 'master' | 'general'
  alertThreshold: number
  onInventoryUpdate: () => void
  selectedLocation: string
  isAllSelected: boolean
}

export default function InventoryTable({
  inventory,
  categories,
  products,
  locations,
  showImages,
  viewMode,
  userRole,
  alertThreshold,
  onInventoryUpdate,
  selectedLocation,
  isAllSelected
}: InventoryTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'stock'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = useState(false)

  const filteredInventory = inventory.filter(item => {
    if (selectedCategory === 'all') return true
    return item.product?.category_id === selectedCategory
  })

  const sortedInventory = [...filteredInventory].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortBy) {
      case 'name':
        aValue = a.product?.name || ''
        bValue = b.product?.name || ''
        break
      case 'category':
        aValue = a.product?.category?.name || ''
        bValue = b.product?.category?.name || ''
        break
      case 'stock':
        aValue = a.current_stock
        bValue = b.current_stock
        break
      default:
        aValue = a.product?.name || ''
        bValue = b.product?.name || ''
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
  })

  const handleSort = (field: 'name' | 'category' | 'stock') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const isLowStock = (stock: number) => stock <= alertThreshold

  const handleEditInventory = (item: Inventory) => {
    setSelectedInventory(item)
    setIsModalOpen(true)
  }

  const handleAddInventory = () => {
    setSelectedInventory(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedInventory(null)
  }

  const handleExportExcel = () => {
    const locationName = locations.find(l => l.id === selectedInventory?.location_id)?.name || '전체'
    exportInventoryToExcel(filteredInventory, locationName)
  }

  const handleEditMode = () => {
    if (isEditMode) {
      setIsEditMode(false)
      setEditValues({})
    } else {
      setIsEditMode(true)
      // 현재 재고값들로 초기화
      const initialValues: Record<string, number> = {}
      sortedInventory.forEach(item => {
        initialValues[item.id] = item.current_stock
      })
      setEditValues(initialValues)
    }
  }

  const handleStockChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0
    setEditValues(prev => ({
      ...prev,
      [itemId]: numValue
    }))
  }

  const handleBulkSave = async () => {
    try {
      setIsSaving(true)
      
      const updates = Object.entries(editValues)
        .map(([itemId, newStock]) => {
          const item = sortedInventory.find(i => i.id === itemId)
          if (!item || item.current_stock === newStock) return null
          
          return {
            itemId,
            productId: item.product_id,
            locationId: item.location_id,
            oldStock: item.current_stock,
            newStock,
            difference: newStock - item.current_stock
          }
        })
        .filter(Boolean)

      if (updates.length === 0) {
        setIsEditMode(false)
        return
      }

      const response = await fetch('/api/inventory/bulk-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates })
      })

      if (!response.ok) {
        throw new Error('일괄 업데이트에 실패했습니다.')
      }

      setIsEditMode(false)
      setEditValues({})
      onInventoryUpdate()

    } catch (error) {
      console.error('Bulk update error:', error)
      alert('재고 업데이트 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProduct = async (item: Inventory) => {
    if (!confirm(`${item.product?.name} 제품을 삭제하시겠습니까? 모든 위치의 재고가 삭제됩니다.`)) {
      return
    }

    try {
      const response = await fetch(`/api/products/${item.product_id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('제품 삭제에 실패했습니다.')
      }

      onInventoryUpdate()

    } catch (error) {
      console.error('Delete product error:', error)
      alert('제품 삭제 중 오류가 발생했습니다.')
    }
  }

  if (viewMode !== 'current') {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">준비 중</h3>
        <p className="mt-2 text-sm text-gray-500">
          {viewMode === 'monthly' ? '월간 현황' : '입출고 내역'} 기능은 곧 추가될 예정입니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 필터 및 정렬 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="select-field text-sm"
            >
              <option value="all">전체</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportExcel}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
          
          {userRole === 'master' && !isAllSelected && (
            <button 
              onClick={handleAddInventory}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              재고 이동
            </button>
          )}

          {userRole === 'master' && (
            <>
              {isEditMode ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleBulkSave}
                    disabled={isSaving}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                  <button 
                    onClick={handleEditMode}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    취소
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleEditMode}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  일괄 수정
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {showImages && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이미지
                  </th>
                )}
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    제품명
                    {sortBy === 'name' && (
                      <span className="text-primary-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1">
                    카테고리
                    {sortBy === 'category' && (
                      <span className="text-primary-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center gap-1">
                    현재고
                    {sortBy === 'stock' && (
                      <span className="text-primary-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  단위
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  최종수정
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedInventory.length === 0 ? (
                <tr>
                  <td 
                    colSpan={showImages ? 7 : 6} 
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    재고 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedInventory.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`${showImages ? 'h-20' : 'h-12'} ${
                      isLowStock(item.current_stock) ? 'table-row-warning' : 'hover:bg-gray-50'
                    }`}
                  >
                    {showImages && (
                      <td className="px-4 py-2">
                        <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                          {item.product?.image_url ? (
                            <Image
                              src={item.product.image_url}
                              alt={item.product.name}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {isLowStock(item.current_stock) && (
                          <AlertTriangle className="w-4 h-4 text-warning-500 mr-2" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.product?.name}
                          </div>
                          {item.product?.code && (
                            <div className="text-xs text-gray-500">
                              {item.product.code}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {item.product?.category?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editValues[item.id] ?? item.current_stock}
                          onChange={(e) => handleStockChange(item.id, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm font-semibold"
                          min="0"
                        />
                      ) : (
                        <div className={`text-sm font-semibold ${
                          isLowStock(item.current_stock) ? 'text-warning-600' : 'text-gray-900'
                        }`}>
                          {item.current_stock.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.product?.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(item.last_updated).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isAllSelected && (
                          <button 
                            onClick={() => handleEditInventory(item)}
                            className="text-primary-600 hover:text-primary-900"
                            title="재고 이동"
                            disabled={isEditMode}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {userRole === 'master' && (
                          <button 
                            onClick={() => handleDeleteProduct(item)}
                            className="text-red-600 hover:text-red-900"
                            title="제품 삭제"
                            disabled={isEditMode}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* 재고 이동 모달 */}
      <InventoryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        inventory={selectedInventory}
        products={products}
        locations={locations}
        userRole={userRole}
        onSuccess={() => {
          onInventoryUpdate()
          handleModalClose()
        }}
      />
    </div>
  )
}