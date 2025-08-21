'use client'

import { useState, useEffect } from 'react'
import { InventoryMovement, Product, Location, Category } from '@/types'
// import { supabase } from '@/lib/supabase'
import { Search, Filter, Calendar, ArrowUpCircle, ArrowDownCircle, RotateCcw, Download } from 'lucide-react'
import { exportMovementsToExcel } from '@/lib/excel'

interface TransactionViewProps {
  selectedLocation: string
  products: Product[]
  locations: Location[]
  categories: Category[]
}

export default function TransactionView({ 
  selectedLocation, 
  products, 
  locations, 
  categories 
}: TransactionViewProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [filteredMovements, setFilteredMovements] = useState<InventoryMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    movementType: 'all' as 'all' | 'in' | 'out' | 'adjustment',
    productId: 'all',
    categoryId: 'all',
    dateFrom: '',
    dateTo: '',
    searchQuery: ''
  })

  useEffect(() => {
    loadMovements()
  }, [selectedLocation])

  useEffect(() => {
    applyFilters()
  }, [movements, filters])

  const loadMovements = async () => {
    try {
      setIsLoading(true)
      
      const params = new URLSearchParams()
      if (selectedLocation !== 'all') {
        params.append('location_id', selectedLocation)
      }
      
      const response = await fetch(`/api/movements?${params}`)
      if (!response.ok) {
        throw new Error('Failed to load movements')
      }
      
      const { movements } = await response.json()
      setMovements(movements || [])
    } catch (error) {
      console.error('Error loading movements:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...movements]

    // 이동 타입 필터
    if (filters.movementType !== 'all') {
      filtered = filtered.filter(item => item.movement_type === filters.movementType)
    }

    // 제품 필터
    if (filters.productId !== 'all') {
      filtered = filtered.filter(item => item.product_id === filters.productId)
    }

    // 카테고리 필터
    if (filters.categoryId !== 'all') {
      filtered = filtered.filter(item => item.product?.category_id === filters.categoryId)
    }

    // 날짜 필터
    if (filters.dateFrom) {
      filtered = filtered.filter(item => item.movement_date >= filters.dateFrom)
    }
    if (filters.dateTo) {
      filtered = filtered.filter(item => item.movement_date <= filters.dateTo)
    }

    // 검색어 필터
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.product?.name.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query)
      )
    }

    setFilteredMovements(filtered)
  }

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowUpCircle className="w-4 h-4 text-inbound-500" />
      case 'out':
        return <ArrowDownCircle className="w-4 h-4 text-outbound-500" />
      case 'adjustment':
        return <RotateCcw className="w-4 h-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getMovementTypeName = (type: string) => {
    switch (type) {
      case 'in':
        return '입고'
      case 'out':
        return '출고'
      case 'adjustment':
        return '조정'
      default:
        return type
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'in':
        return 'text-inbound-600 bg-inbound-50'
      case 'out':
        return 'text-outbound-600 bg-outbound-50'
      case 'adjustment':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const exportToExcel = () => {
    const dateRange = filters.dateFrom && filters.dateTo 
      ? `${filters.dateFrom}_${filters.dateTo}`
      : '전체기간'
    
    exportMovementsToExcel(filteredMovements, dateRange)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-primary-600">데이터 로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">입출고 내역 검색</h3>
          <button
            onClick={exportToExcel}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 검색어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              검색어
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                placeholder="제품명, 메모 검색..."
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* 이동 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이동 타입
            </label>
            <select
              value={filters.movementType}
              onChange={(e) => setFilters({ ...filters, movementType: e.target.value as any })}
              className="select-field"
            >
              <option value="all">전체</option>
              <option value="in">입고</option>
              <option value="out">출고</option>
              <option value="adjustment">조정</option>
            </select>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className="select-field"
            >
              <option value="all">전체</option>
              {categories.map((category, index) => (
                <option key={category.id || `category-${index}`} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* 제품 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제품
            </label>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              className="select-field"
            >
              <option value="all">전체</option>
              {products.map((product, index) => (
                <option key={product.id || `product-${index}`} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* 시작 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작 날짜
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="input-field"
            />
          </div>

          {/* 종료 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종료 날짜
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="input-field"
            />
          </div>

          {/* 필터 초기화 */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                movementType: 'all',
                productId: 'all',
                categoryId: 'all',
                dateFrom: '',
                dateTo: '',
                searchQuery: ''
              })}
              className="btn-secondary w-full"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              검색 결과: {filteredMovements.length}건
            </h3>
            <div className="text-sm text-gray-500">
              총 이동량: {filteredMovements.reduce((sum, item) => sum + Math.abs(item.quantity), 0).toLocaleString()}개
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  날짜
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  타입
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  제품명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  위치
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  이동량
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  이전재고
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  이후재고
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  메모
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(movement.movement_date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getMovementTypeIcon(movement.movement_type)}
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMovementTypeColor(movement.movement_type)}`}>
                          {getMovementTypeName(movement.movement_type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {movement.product?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {movement.product?.category?.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {movement.location?.name}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium text-right ${
                      movement.movement_type === 'in' 
                        ? 'text-inbound-600' 
                        : movement.movement_type === 'out'
                        ? 'text-outbound-600'
                        : 'text-yellow-600'
                    }`}>
                      {movement.movement_type === 'in' ? '+' : movement.movement_type === 'out' ? '-' : ''}
                      {Math.abs(movement.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {movement.previous_stock.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {movement.new_stock.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {movement.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}