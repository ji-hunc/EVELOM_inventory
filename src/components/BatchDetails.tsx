'use client'

import React from 'react'
import { Inventory, User } from '@/types'
import { Edit, AlertTriangle, Package, Trash2 } from 'lucide-react'
import { getExpiryStatus, sortBatchesByExpiry } from '@/lib/inventory-utils'
import { formatKoreanDate } from '@/lib/date-utils'
import Image from 'next/image'

interface BatchDetailsProps {
  batches: Inventory[]
  isExpanded: boolean
  showImages: boolean
  user: User
  isAllSelected: boolean
  canEditLocation: (locationId: string) => boolean
  onEditInventory: (item: Inventory) => void
  onDeleteProduct: (item: Inventory) => void
  isEditMode: boolean
  editValues: Record<string, number | string>
  onStockChange: (itemId: string, value: string) => void
  isLowStock: (stock: number) => boolean
  showCategoryColumn?: boolean
  sortBy?: 'name' | 'category' | 'stock' | 'batch_code'
  sortOrder?: 'asc' | 'desc'
}

export default function BatchDetails({ 
  batches, 
  isExpanded, 
  showImages, 
  user,
  isAllSelected,
  canEditLocation,
  onEditInventory,
  onDeleteProduct,
  isEditMode,
  editValues,
  onStockChange,
  isLowStock,
  showCategoryColumn = true,
  sortBy,
  sortOrder
}: BatchDetailsProps) {
  // 배치코드에서 숫자 4자리 추출 (정렬용)
  const extractBatchNumber = (batchCode: string | null | undefined): number => {
    if (!batchCode) return 0
    const match = batchCode.match(/^(\d{4})/)
    return match ? parseInt(match[1], 10) : 0
  }

  // 부모 컴포넌트의 정렬 기준에 따라 배치 정렬
  const sortedBatches = sortBy && sortOrder ? [...batches].sort((a, b) => {
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
      case 'batch_code':
        aValue = extractBatchNumber(a.batch_code)
        bValue = extractBatchNumber(b.batch_code)
        break
      default:
        // 기본적으로는 유통기한순으로 정렬
        return sortBatchesByExpiry(batches).indexOf(a) - sortBatchesByExpiry(batches).indexOf(b)
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
  }) : sortBatchesByExpiry(batches)

  if (!isExpanded) {
    return null
  }

  return (
    <>
      {sortedBatches.map((batch, index) => {
        const expiryStatus = batch.expiry_date ? getExpiryStatus(batch.expiry_date) : 'normal'
        
        return (
          <tr 
            key={batch.id} 
            className={`${
              isLowStock(batch.current_stock) 
                ? 'bg-red-50 hover:bg-red-100' 
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            {showImages && (
              <td className="px-4 py-3" style={showImages ? {width: '100px'} : undefined}></td>
            )}
            <td className="px-4 py-3" style={showImages ? {width: '250px'} : undefined}>
              <div className="flex items-center">
                <div>
                  <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    {batch.product?.name}
                  </div>
                  {batch.product?.code && (
                    <div className="text-xs text-gray-500">
                      {batch.product.code}
                    </div>
                  )}
                </div>
              </div>
            </td>
            {showCategoryColumn && (
              <td className="px-4 py-3 text-sm text-gray-500" style={showImages ? {width: '130px'} : undefined}>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {batch.product?.category?.name}
                </span>
              </td>
            )}
            <td className="px-4 py-3" style={showImages ? {width: '90px'} : undefined}>
              {isEditMode ? (
                <input
                  type="number"
                  value={editValues[batch.id] ?? batch.current_stock}
                  onChange={(e) => onStockChange(batch.id, e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm font-semibold"
                  min="0"
                />
              ) : (
                <div className={`text-sm font-semibold ${
                  isLowStock(batch.current_stock) ? 'text-red-400' : 'text-gray-900'
                }`}>
                  {batch.current_stock.toLocaleString()}
                </div>
              )}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500" style={showImages ? {width: '110px'} : undefined}>
              <span className="font-mono text-xs">
                {batch.batch_code || '-'}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500" style={showImages ? {width: '130px'} : undefined}>
              {batch.expiry_date ? (
                <div className="flex flex-col">
                  <span>{formatKoreanDate(batch.expiry_date)}</span>
                  {(() => {
                    const today = new Date()
                    const expiry = new Date(batch.expiry_date)
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
            <td className="px-4 py-3 text-sm text-gray-500" style={showImages ? {width: '110px'} : undefined}>
              {formatKoreanDate(batch.last_updated)}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500" style={showImages ? {width: '110px'} : undefined}>
              {batch.last_modified_user?.username || '-'}
            </td>
            <td className="px-4 py-3 text-right" style={showImages ? {width: '90px'} : undefined}>
              <div className="flex items-center justify-end gap-2">
                {!isAllSelected && canEditLocation(batch.location_id) && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditInventory(batch)
                    }}
                    className="text-primary-600 hover:text-primary-900"
                    title="재고 이동"
                    disabled={isEditMode}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {/* 삭제 버튼 제거됨 */}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}