'use client'

import React, { useState } from 'react'
import { Inventory, Category, Product, Location, User } from '@/types'
import { Edit, Plus, AlertTriangle, Package, Download, Trash2, Save, X, ChevronDown, ChevronUp, Layout, Grid3X3 } from 'lucide-react'
import { exportInventoryToExcel } from '@/lib/excel'
import { groupInventoryByProduct, GroupedInventoryItem } from '@/lib/inventory-utils'
import Image from 'next/image'
import InventoryModal from './InventoryModal'
import BatchDetails from './BatchDetails'
import MonthlyView from './MonthlyView'
import TransactionView from './TransactionView'

interface InventoryTableProps {
  inventory: Inventory[]
  categories: Category[]
  products: Product[]
  locations: Location[]
  showImages: boolean
  viewMode: 'current' | 'monthly' | 'transactions'
  user: User
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
  user,
  alertThreshold,
  onInventoryUpdate,
  selectedLocation,
  isAllSelected
}: InventoryTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'stock' | 'batch_code'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [tableViewMode, setTableViewMode] = useState<'single' | 'category-separated'>('single')

  // 사용자가 해당 위치를 수정할 수 있는지 확인
  const canEditLocation = (locationId: string) => {
    if (user.role === 'master') return true
    if (user.role === 'general' && user.assigned_location_id) {
      return user.assigned_location_id === locationId
    }
    return false
  }

  // 현재 선택된 위치를 일반 사용자가 수정할 수 있는지 확인
  const canEditCurrentLocation = () => {
    if (isAllSelected) return false // 전체 탭에서는 수정 불가
    return canEditLocation(selectedLocation)
  }

  // 배치코드에서 숫자 4자리 추출 (정렬용)
  const extractBatchNumber = (batchCode: string | null | undefined): number => {
    if (!batchCode) return 0
    const match = batchCode.match(/^(\d{4})/)
    return match ? parseInt(match[1], 10) : 0
  }

  // 그룹의 배치코드 정렬값 계산 (다중 배치인 경우 정렬 방향에 따라 최소값/최대값 사용)
  const getGroupBatchSortValue = (group: GroupedInventoryItem): number => {
    if (group.batch_count === 1) {
      return extractBatchNumber(group.batches[0]?.batch_code)
    }
    
    // 다중 배치의 경우 정렬 방향에 따라 최소값 또는 최대값을 정렬 기준으로 사용
    const batchNumbers = group.batches
      .map(batch => extractBatchNumber(batch.batch_code))
      .filter(num => num > 0)
    
    if (batchNumbers.length === 0) return 0
    
    // 오름차순이면 최소값, 내림차순이면 최대값을 기준으로 사용
    // 배치코드 정렬이 아닌 경우에는 최소값 사용 (기존 동작 유지)
    if (sortBy === 'batch_code') {
      return sortOrder === 'asc' ? Math.min(...batchNumbers) : Math.max(...batchNumbers)
    } else {
      return Math.min(...batchNumbers)
    }
  }

  const filteredInventory = inventory.filter(item => {
    if (tableViewMode === 'category-separated' || selectedCategory === 'all') return true
    return item.product?.category_id === selectedCategory
  })

  // 상품별로 그룹화된 데이터
  const groupedInventory = groupInventoryByProduct(filteredInventory)

  // 카테고리별로 분리된 데이터 (category-separated 모드용)
  const inventoryByCategory = tableViewMode === 'category-separated' 
    ? categories.reduce((acc, category) => {
        const categoryInventory = filteredInventory.filter(item => 
          item.product?.category_id === category.name
        )
        if (categoryInventory.length > 0) {
          acc[category.name] = {
            category,
            inventory: categoryInventory,
            groupedInventory: groupInventoryByProduct(categoryInventory)
          }
        }
        return acc
      }, {} as Record<string, { 
        category: Category; 
        inventory: Inventory[]; 
        groupedInventory: GroupedInventoryItem[]
      }>)
    : null
  
  const sortedGroupedInventory = [...groupedInventory].sort((a, b) => {
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
        aValue = a.total_stock
        bValue = b.total_stock
        break
      case 'batch_code':
        aValue = getGroupBatchSortValue(a)
        bValue = getGroupBatchSortValue(b)
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

  const handleSort = (field: 'name' | 'category' | 'stock' | 'batch_code') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const isLowStock = (stock: number) => stock <= alertThreshold

  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey)
        setAllExpanded(false) // 하나라도 접으면 전체 펼침 상태 해제
      } else {
        newSet.add(groupKey)
        // 모든 그룹이 펼쳐졌는지 확인
        let totalExpandableGroups = 0
        if (tableViewMode === 'single') {
          totalExpandableGroups = sortedGroupedInventory.filter(group => group.batch_count > 1).length
        } else if (inventoryByCategory) {
          Object.values(inventoryByCategory).forEach(catData => {
            totalExpandableGroups += catData.groupedInventory.filter(group => group.batch_count > 1).length
          })
        }
        if (newSet.size === totalExpandableGroups) {
          setAllExpanded(true)
        }
      }
      return newSet
    })
  }

  const toggleAllGroups = () => {
    if (allExpanded) {
      // 현재 모두 펼쳐진 상태면 모두 접기
      setExpandedGroups(new Set())
      setAllExpanded(false)
    } else {
      // 현재 접힌 상태면 모두 펼치기
      let allGroupKeys: string[] = []
      
      if (tableViewMode === 'single') {
        allGroupKeys = sortedGroupedInventory
          .filter(group => group.batch_count > 1)
          .map(group => `${group.product_id}-${group.location_id}`)
      } else if (inventoryByCategory) {
        Object.values(inventoryByCategory).forEach(catData => {
          const catGroupKeys = catData.groupedInventory
            .filter(group => group.batch_count > 1)
            .map(group => `${group.product_id}-${group.location_id}`)
          allGroupKeys.push(...catGroupKeys)
        })
      }
      
      setExpandedGroups(new Set(allGroupKeys))
      setAllExpanded(true)
    }
  }

  const hasExpandableGroups = tableViewMode === 'single' 
    ? sortedGroupedInventory.some(group => group.batch_count > 1)
    : inventoryByCategory && Object.values(inventoryByCategory).some(catData =>
        catData.groupedInventory.some(group => group.batch_count > 1)
      )

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
      // 현재 재고값들로 초기화 (보기 모드에 따라 처리)
      const initialValues: Record<string, number> = {}
      
      if (tableViewMode === 'single') {
        // 통합 모드: 현재 필터링된 그룹화된 재고
        groupedInventory.forEach(group => {
          group.batches.forEach(item => {
            initialValues[item.id] = item.current_stock
          })
        })
      } else if (inventoryByCategory) {
        // 카테고리별 분리 모드: 모든 카테고리의 재고
        Object.values(inventoryByCategory).forEach(catData => {
          catData.groupedInventory.forEach(group => {
            group.batches.forEach(item => {
              initialValues[item.id] = item.current_stock
            })
          })
        })
      }
      
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
          // 보기 모드에 따라 아이템 찾기
          let item: Inventory | undefined
          
          if (tableViewMode === 'single') {
            // 통합 모드: 현재 그룹화된 재고에서 찾기
            for (const group of groupedInventory) {
              item = group.batches.find(i => i.id === itemId)
              if (item) break
            }
          } else if (inventoryByCategory) {
            // 카테고리별 분리 모드: 모든 카테고리에서 찾기
            for (const catData of Object.values(inventoryByCategory)) {
              for (const group of catData.groupedInventory) {
                item = group.batches.find(i => i.id === itemId)
                if (item) break
              }
              if (item) break
            }
          }
          
          if (!item || item.current_stock === newStock) return null
          
          return {
            itemId,
            productId: item.product_id,
            locationId: item.location_id,
            batchCode: item.batch_code,
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
        body: JSON.stringify({ 
          updates,
          username: user.username 
        })
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
    const isAllTab = isAllSelected
    const confirmMessage = isAllTab 
      ? `${item.product?.name} 제품을 모든 위치에서 삭제하시겠습니까?`
      : `${item.product?.name} 제품을 ${item.location?.name}에서 삭제하시겠습니까?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const params = new URLSearchParams()
      if (isAllTab) {
        params.append('delete_all', 'true')
      } else {
        params.append('location_id', item.location_id)
        if (item.batch_code) {
          params.append('batch_code', item.batch_code)
        }
      }

      const response = await fetch(`/api/products/${item.product_id}?${params.toString()}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '삭제에 실패했습니다.')
      }

      const result = await response.json()
      alert(result.message)
      onInventoryUpdate()

    } catch (error) {
      console.error('Delete product error:', error)
      alert('삭제 중 오류가 발생했습니다: ' + (error as Error).message)
    }
  }

  // 개별 카테고리 테이블 렌더링 함수
  const renderCategoryTable = (
    categoryName: string, 
    categoryData: { 
      category: Category; 
      inventory: Inventory[]; 
      groupedInventory: GroupedInventoryItem[]
    }
  ) => {
    const { category, groupedInventory: categoryGroupedInventory } = categoryData
    // 공통 정렬 함수를 사용하여 카테고리별 정렬 수행
    const sortedCategoryInventory = [...categoryGroupedInventory].sort((a, b) => {
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
          aValue = a.total_stock
          bValue = b.total_stock
          break
        case 'batch_code':
          // 카테고리별 정렬에서도 같은 배치 정렬 로직 사용
          if (a.batch_count === 1) {
            aValue = extractBatchNumber(a.batches[0]?.batch_code)
          } else {
            const aBatchNumbers = a.batches
              .map(batch => extractBatchNumber(batch.batch_code))
              .filter(num => num > 0)
            aValue = aBatchNumbers.length > 0 ? 
              (sortOrder === 'asc' ? Math.min(...aBatchNumbers) : Math.max(...aBatchNumbers)) : 0
          }
          
          if (b.batch_count === 1) {
            bValue = extractBatchNumber(b.batches[0]?.batch_code)
          } else {
            const bBatchNumbers = b.batches
              .map(batch => extractBatchNumber(batch.batch_code))
              .filter(num => num > 0)
            bValue = bBatchNumbers.length > 0 ? 
              (sortOrder === 'asc' ? Math.min(...bBatchNumbers) : Math.max(...bBatchNumbers)) : 0
          }
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

    return (
      <div key={categoryName} className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="bg-primary-50 border-b border-primary-100 px-4 py-3">
          <h3 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            {category.name} 
            <span className="text-sm font-normal text-primary-700">
              ({sortedCategoryInventory.length}개 제품)
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                {showImages && (
                  <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이미지
                  </th>
                )}
                <th className="w-60 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제품명
                </th>
                <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  현재고
                </th>
                <th 
                  className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('batch_code')}
                >
                  <div className="flex items-center gap-1">
                    배치코드
                    {sortBy === 'batch_code' && (
                      <span className="text-primary-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유통기한
                </th>
                <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  최종수정
                </th>
                <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  최종수정자
                </th>
                <th className="w-20 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {sortedCategoryInventory.length === 0 ? (
                <tr>
                  <td 
                    colSpan={showImages ? 8 : 7} 
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {category.name} 카테고리에 재고 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedCategoryInventory.map((group) => {
                  const groupKey = `${group.product_id}-${group.location_id}`
                  const isExpanded = expandedGroups.has(groupKey)
                  const hasMultipleBatches = group.batch_count > 1
                  const firstBatch = group.batches[0]
                  
                  return (
                    <React.Fragment key={groupKey}>
                      <tr 
                        className={`border-b border-gray-200 ${
                          isLowStock(group.total_stock) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                        } ${hasMultipleBatches ? 'cursor-pointer' : ''}`}
                        onClick={hasMultipleBatches ? () => toggleGroupExpansion(groupKey) : undefined}
                      >
                        {showImages && (
                          <td className="px-4 py-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                              {group.product?.image_url ? (
                                <Image
                                  src={group.product.image_url}
                                  alt={group.product.name}
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
                            <div>
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                <span>{group.product?.name}</span>
                                {hasMultipleBatches && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1">
                                    {group.batch_count}개 배치
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </span>
                                )}
                              </div>
                              {group.product?.code && (
                                <div className="text-xs text-gray-500">
                                  {group.product.code}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isEditMode && !hasMultipleBatches ? (
                            <input
                              type="number"
                              value={editValues[firstBatch.id] ?? firstBatch.current_stock}
                              onChange={(e) => handleStockChange(firstBatch.id, e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm font-semibold"
                              min="0"
                            />
                          ) : (
                            <div className={`text-sm font-semibold ${
                              isLowStock(group.total_stock) ? 'text-warning-600' : 'text-gray-900'
                            }`}>
                              {group.total_stock.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {hasMultipleBatches ? (
                            <span className="text-blue-600 font-mono text-xs">
                              다중 배치
                            </span>
                          ) : (
                            <span className="font-mono text-xs">
                              {firstBatch?.batch_code || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {hasMultipleBatches ? (
                            <span className="text-blue-600 text-xs">
                              {group.batch_count}개 배치
                            </span>
                          ) : firstBatch?.expiry_date ? (
                            <div className="flex flex-col">
                              <span>{new Date(firstBatch.expiry_date).toLocaleDateString('ko-KR')}</span>
                              {(() => {
                                const today = new Date()
                                const expiry = new Date(firstBatch.expiry_date)
                                const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24))
                                
                                if (daysDiff < 0) {
                                  return <span className="text-xs text-red-600 font-medium">만료됨</span>
                                } else if (daysDiff <= 30) {
                                  return <span className="text-xs text-orange-600 font-medium">{daysDiff}일 후</span>
                                } else if (daysDiff <= 90) {
                                  return <span className="text-xs text-yellow-600">{daysDiff}일 후</span>
                                } else {
                                  return <span className="text-xs text-green-600">{daysDiff}일 후</span>
                                }
                              })()}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(group.latest_updated).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          -
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isAllSelected && canEditLocation(group.location_id) && user.role === 'master' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditInventory(firstBatch)
                                }}
                                className="text-primary-600 hover:text-primary-900"
                                title="재고 이동"
                                disabled={isEditMode}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {user.role === 'master' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteProduct(firstBatch)
                                }}
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
                      
                      {/* 배치별 상세 정보 */}
                      {hasMultipleBatches && (
                        <BatchDetails
                          batches={group.batches}
                          isExpanded={isExpanded}
                          showImages={showImages}
                          user={user}
                          isAllSelected={isAllSelected}
                          canEditLocation={canEditLocation}
                          onEditInventory={handleEditInventory}
                          onDeleteProduct={handleDeleteProduct}
                          isEditMode={isEditMode}
                          editValues={editValues}
                          onStockChange={handleStockChange}
                          isLowStock={isLowStock}
                          showCategoryColumn={false}
                          sortBy={sortBy}
                          sortOrder={sortOrder}
                        />
                      )}
                    </React.Fragment>
                  )
                })
              )}              
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (viewMode === 'monthly') {
    return (
      <MonthlyView 
        selectedLocation={selectedLocation}
        products={products}
        locations={locations}
        categories={categories}
      />
    )
  }

  if (viewMode === 'transactions') {
    return (
      <TransactionView 
        selectedLocation={selectedLocation}
        products={products}
        locations={locations}
        categories={categories}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 필터 및 정렬 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 보기 모드 토글 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              보기 방식
            </label>
            <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setTableViewMode('single')}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                  tableViewMode === 'single' 
                    ? 'bg-white text-primary-600 shadow' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Layout className="w-4 h-4" />
                통합
              </button>
              <button
                onClick={() => setTableViewMode('category-separated')}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                  tableViewMode === 'category-separated' 
                    ? 'bg-white text-primary-600 shadow' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                카테고리별
              </button>
            </div>
          </div>

          {/* 카테고리 필터 (통합 모드일 때만) */}
          {tableViewMode === 'single' && (
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
                {categories.map((category, index) => (
                  <option key={category.id || `category-${index}`} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasExpandableGroups && (
            <button 
              onClick={toggleAllGroups}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  모두 접기
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  모두 펼치기
                </>
              )}
            </button>
          )}
          
          <button 
            onClick={handleExportExcel}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
          
          {canEditCurrentLocation() && user.role === 'master' && (
            <button 
              onClick={handleAddInventory}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              재고 이동
            </button>
          )}

          {canEditCurrentLocation() && (
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
      {tableViewMode === 'single' ? (
        // 통합 테이블 모드
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  {showImages && (
                    <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이미지
                    </th>
                  )}
                  <th 
                    className="w-60 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                    className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                    className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                  <th 
                    className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('batch_code')}
                  >
                    <div className="flex items-center gap-1">
                      배치코드
                      {sortBy === 'batch_code' && (
                        <span className="text-primary-500">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유통기한
                  </th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    최종수정
                  </th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    최종수정자
                  </th>
                  <th className="w-20 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {sortedGroupedInventory.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={showImages ? 9 : 8} 
                      className="px-4 py-12 text-center text-gray-500"
                    >
                      재고 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedGroupedInventory.map((group) => {
                    const groupKey = `${group.product_id}-${group.location_id}`
                    const isExpanded = expandedGroups.has(groupKey)
                    const hasMultipleBatches = group.batch_count > 1
                    const firstBatch = group.batches[0]
                    
                    return (
                      <React.Fragment key={groupKey}>
                        <tr 
                          className={`border-b border-gray-200 ${
                            isLowStock(group.total_stock) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                          } ${hasMultipleBatches ? 'cursor-pointer' : ''}`}
                          onClick={hasMultipleBatches ? () => toggleGroupExpansion(groupKey) : undefined}
                        >
                          {showImages && (
                            <td className="px-4 py-3">
                              <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                                {group.product?.image_url ? (
                                  <Image
                                    src={group.product.image_url}
                                    alt={group.product.name}
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
                              <div>
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  <span>{group.product?.name}</span>
                                  {hasMultipleBatches && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1">
                                      {group.batch_count}개 배치
                                      {isExpanded ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </span>
                                  )}
                                </div>
                                {group.product?.code && (
                                  <div className="text-xs text-gray-500">
                                    {group.product.code}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {group.product?.category?.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isEditMode && !hasMultipleBatches ? (
                              <input
                                type="number"
                                value={editValues[firstBatch.id] ?? firstBatch.current_stock}
                                onChange={(e) => handleStockChange(firstBatch.id, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm font-semibold"
                                min="0"
                              />
                            ) : (
                              <div className={`text-sm font-semibold ${
                                isLowStock(group.total_stock) ? 'text-warning-600' : 'text-gray-900'
                              }`}>
                                {group.total_stock.toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {hasMultipleBatches ? (
                              <span className="text-blue-600 font-mono text-xs">
                                다중 배치
                              </span>
                            ) : (
                              <span className="font-mono text-xs">
                                {firstBatch?.batch_code || '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {hasMultipleBatches ? (
                              <span className="text-blue-600 text-xs">
                                {group.batch_count}개 배치
                              </span>
                            ) : firstBatch?.expiry_date ? (
                              <div className="flex flex-col">
                                <span>{new Date(firstBatch.expiry_date).toLocaleDateString('ko-KR')}</span>
                                {(() => {
                                  const today = new Date()
                                  const expiry = new Date(firstBatch.expiry_date)
                                  const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24))
                                  
                                  if (daysDiff < 0) {
                                    return <span className="text-xs text-red-600 font-medium">만료됨</span>
                                  } else if (daysDiff <= 30) {
                                    return <span className="text-xs text-orange-600 font-medium">{daysDiff}일 후</span>
                                  } else if (daysDiff <= 90) {
                                    return <span className="text-xs text-yellow-600">{daysDiff}일 후</span>
                                  } else {
                                    return <span className="text-xs text-green-600">{daysDiff}일 후</span>
                                  }
                                })()}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(group.latest_updated).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            -
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isAllSelected && canEditLocation(group.location_id) && user.role === 'master' && (
                                <button 
                                  onClick={() => handleEditInventory(firstBatch)}
                                  className="text-primary-600 hover:text-primary-900"
                                  title="재고 이동"
                                  disabled={isEditMode}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {user.role === 'master' && (
                                <button 
                                  onClick={() => handleDeleteProduct(firstBatch)}
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
                        
                        {/* 배치별 상세 정보 */}
                        {hasMultipleBatches && (
                          <BatchDetails
                            batches={group.batches}
                            isExpanded={isExpanded}
                            showImages={showImages}
                            user={user}
                            isAllSelected={isAllSelected}
                            canEditLocation={canEditLocation}
                            onEditInventory={handleEditInventory}
                            onDeleteProduct={handleDeleteProduct}
                            isEditMode={isEditMode}
                            editValues={editValues}
                            onStockChange={handleStockChange}
                            isLowStock={isLowStock}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                          />
                        )}
                      </React.Fragment>
                    )
                  })
                )}              
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // 카테고리별 분리 테이블 모드
        <div className="space-y-6">
          {inventoryByCategory && Object.keys(inventoryByCategory).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">재고 데이터가 없습니다</h3>
              <p className="mt-2 text-sm text-gray-500">
                제품을 추가하거나 재고를 입고해 주세요.
              </p>
            </div>
          ) : (
            inventoryByCategory && Object.entries(inventoryByCategory).map(([categoryName, categoryData]) =>
              renderCategoryTable(categoryName, categoryData)
            )
          )}
        </div>
      )}


      {/* 재고 이동 모달 */}
      <InventoryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        inventory={selectedInventory}
        products={products}
        locations={locations}
        user={user}
        onSuccess={() => {
          onInventoryUpdate()
          handleModalClose()
        }}
      />
    </div>
  )
}