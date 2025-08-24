'use client'

import { useState, useEffect, useRef } from 'react'
import { InventoryMovement, Product, Location, Category, Inventory } from '@/types'
import { ChevronLeft, ChevronRight, Calendar, ArrowUp, ArrowDown, Layout, Grid3X3, Package } from 'lucide-react'

interface MonthlyViewProps {
  selectedLocation: string
  products: Product[]
  locations: Location[]
  categories: Category[]
  inventory: Inventory[]
}

interface DailyMovementData {
  date: string
  inQuantity: number
  outQuantity: number
  movements: InventoryMovement[]
  finalStock: number
}

interface ProductDailyData {
  product: Product & { currentStock?: number }
  dailyData: Record<string, DailyMovementData>
}

export default function MonthlyView({ selectedLocation, products, locations, categories, inventory }: MonthlyViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [productDailyData, setProductDailyData] = useState<ProductDailyData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [monthDates, setMonthDates] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'single' | 'category-separated'>('category-separated')
  const [sortBy, setSortBy] = useState<'name' | 'stock'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [categorySortStates, setCategorySortStates] = useState<Record<string, {
    sortBy: 'name' | 'stock'
    sortOrder: 'asc' | 'desc'
  }>>({})
  const [showDatePicker, setShowDatePicker] = useState(false)
  const singleTableRef = useRef<HTMLDivElement>(null)
  const categoryTablesRef = useRef<Record<string, HTMLDivElement>>({})

  // 현재 날짜로 스크롤 함수
  const scrollToCurrentDate = () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    // 현재 월의 데이터에 오늘 날짜가 있는지 확인
    const todayIndex = monthDates.findIndex(date => date === todayStr)
    
    if (todayIndex !== -1) {
      const scrollContainer = singleTableRef.current
      if (scrollContainer) {
        // 오늘 날짜 열까지 스크롤 (고정된 제품명, 현재고 컬럼 너비 + 날짜 컬럼들)
        const scrollPosition = 360 + (todayIndex * 80) // 제품명(240px) + 현재고(120px) = 360px + 날짜컬럼들(80px each)
        scrollContainer.scrollLeft = scrollPosition
      }
      
      // 카테고리 테이블들도 같이 스크롤
      Object.values(categoryTablesRef.current).forEach(container => {
        if (container) {
          const scrollPosition = 360 + (todayIndex * 80)
          container.scrollLeft = scrollPosition
        }
      })
    }
  }

  useEffect(() => {
    loadMonthlyData()
  }, [currentDate, selectedLocation])

  // 데이터 로딩 완료 후 현재 날짜로 스크롤
  useEffect(() => {
    if (!isLoading && monthDates.length > 0) {
      // 약간의 지연을 주고 스크롤 (DOM 렌더링 완료 후)
      setTimeout(scrollToCurrentDate, 100)
    }
  }, [isLoading, monthDates])

  const loadMonthlyData = async () => {
    try {
      setIsLoading(true)
      
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      
      // 전월 마지막 날부터 현재 월 마지막 날까지
      const prevMonthLastDay = new Date(year, month, 0)
      const currentMonthLastDay = new Date(year, month + 1, 0)
      
      const startDate = prevMonthLastDay
      const endDate = currentMonthLastDay
      
      // 로컬 타임존으로 날짜 문자열 생성
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      const startDateStr = formatLocalDate(startDate)
      const endDateStr = formatLocalDate(endDate)

      // 전월 마지막 날부터 현재 월 마지막 날까지의 모든 날짜 생성
      const dates: string[] = []
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(formatLocalDate(d))
      }
      setMonthDates(dates)

      // API를 통해 월간 데이터 가져오기
      const params = new URLSearchParams({
        start_date: startDateStr,
        end_date: endDateStr
      })
      
      if (selectedLocation !== 'all') {
        params.append('location_id', selectedLocation)
      }
      
      const response = await fetch(`/api/movements?${params}`)
      if (!response.ok) {
        throw new Error('Failed to load monthly data')
      }
      
      const { movements } = await response.json()

      // 디버그: inventory 구조 확인
      console.log('Inventory 데이터:', inventory)
      console.log('선택된 위치:', selectedLocation)
      console.log('제품 목록:', products)

      // 제품별로 일별 데이터 구성
      const productDataMap: Record<string, ProductDailyData> = {}
      
      // 선택된 위치에 재고가 있는 제품만 필터링
      let filteredProducts = products
      if (selectedLocation !== 'all' && inventory && Array.isArray(inventory)) {
        console.log('첫 번째 inventory 아이템:', inventory[0])
        const productsInLocation = new Set(
          inventory
            .filter(item => item.location_id === selectedLocation)
            .map(item => item.product_id)
        )
        console.log('해당 위치의 제품들:', Array.from(productsInLocation))
        filteredProducts = products.filter(product => productsInLocation.has(product.name))
        console.log('필터링된 제품들:', filteredProducts.map(p => p.name))
      }
      
      // 필터링된 제품에 대해 초기화
      filteredProducts.forEach(product => {
        const dailyData: Record<string, DailyMovementData> = {}
        
        // 제품의 현재 재고 계산 (선택된 위치 또는 전체)
        let currentStock = 0
        if (inventory && Array.isArray(inventory)) {
          if (selectedLocation === 'all') {
            const productInventory = inventory.filter(item => item.product_id === product.name)
            currentStock = productInventory.reduce((sum, item) => sum + item.current_stock, 0)
          } else {
            const productInventory = inventory.filter(item => item.product_id === product.name && item.location_id === selectedLocation)
            currentStock = productInventory.reduce((sum, item) => sum + item.current_stock, 0)
          }
          
          console.log(`제품 ${product.name}, 위치 ${selectedLocation}, 현재고: ${currentStock}`, {
            productInventory: inventory.filter(item => 
              selectedLocation === 'all' 
                ? item.product_id === product.name 
                : item.product_id === product.name && item.location_id === selectedLocation
            )
          })
        }
        
        dates.forEach(date => {
          dailyData[date] = {
            date,
            inQuantity: 0,
            outQuantity: 0,
            movements: [],
            finalStock: currentStock // 초기값으로 현재 재고 설정, 나중에 역산으로 계산
          }
        })
        
        productDataMap[product.name] = {
          product: {
            ...product,
            currentStock // 현재고 정보 추가
          },
          dailyData
        }
      })

      // 실제 이동 데이터 매핑
      movements?.forEach((movement: InventoryMovement) => {
        const productName = movement.product_id
        const dateStr = movement.movement_date
        
        if (productDataMap[productName] && productDataMap[productName].dailyData[dateStr]) {
          const dayData = productDataMap[productName].dailyData[dateStr]
          dayData.movements.push(movement)
          
          if (movement.movement_type === 'in') {
            dayData.inQuantity += movement.quantity
          } else if (movement.movement_type === 'out') {
            dayData.outQuantity += Math.abs(movement.quantity)
          }
        }
      })

      // 일별 최종 재고 계산 (현재고에서 역산)
      Object.values(productDataMap).forEach(productData => {
        const sortedDates = dates.slice().reverse() // 최신 날짜부터 역순으로
        let runningStock = productData.product.currentStock
        
        // 최신 날짜부터 역순으로 계산
        sortedDates.forEach((date, index) => {
          const dayData = productData.dailyData[date]
          
          if (index === 0) {
            // 가장 최신 날짜는 현재고
            dayData.finalStock = runningStock || 0
          } else {
            // 이전 날짜의 최종 재고 = 다음 날 최종 재고 - 다음 날 입고 + 다음 날 출고
            const nextDate = sortedDates[index - 1]
            const nextDayData = productData.dailyData[nextDate]
            dayData.finalStock = nextDayData.finalStock - nextDayData.inQuantity + nextDayData.outQuantity
          }
          
          runningStock = dayData.finalStock
        })
      })

      setProductDailyData(Object.values(productDataMap))
      
    } catch (error) {
      console.error('Error loading monthly data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const handleSort = (column: 'name' | 'stock') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const handleCategorySort = (categoryName: string, column: 'name' | 'stock') => {
    const currentState = categorySortStates[categoryName] || { sortBy: 'name', sortOrder: 'asc' }
    
    if (currentState.sortBy === column) {
      setCategorySortStates(prev => ({
        ...prev,
        [categoryName]: {
          ...currentState,
          sortOrder: currentState.sortOrder === 'asc' ? 'desc' : 'asc'
        }
      }))
    } else {
      setCategorySortStates(prev => ({
        ...prev,
        [categoryName]: {
          sortBy: column,
          sortOrder: 'asc'
        }
      }))
    }
  }

  const sortedProductData = [...productDailyData].sort((a, b) => {
    let compareValue = 0
    if (sortBy === 'name') {
      compareValue = a.product.name.localeCompare(b.product.name)
    } else if (sortBy === 'stock') {
      compareValue = (a.product.currentStock || 0) - (b.product.currentStock || 0)
    }
    return sortOrder === 'desc' ? -compareValue : compareValue
  })

  const handleDateSelect = (year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1)
    setCurrentDate(newDate)
    setShowDatePicker(false)
  }

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr)
    const currentMonth = currentDate.getMonth()
    const dateMonth = date.getMonth()
    const isPrevMonth = dateMonth !== currentMonth
    
    return {
      day: date.getDate(),
      weekday: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isPrevMonth
    }
  }

  const getDayCellContent = (productData: ProductDailyData, dateStr: string) => {
    const dayData = productData.dailyData[dateStr]
    const hasInbound = dayData.inQuantity > 0
    const hasOutbound = dayData.outQuantity > 0
    const hasMovement = hasInbound || hasOutbound
    
    // 현재 날짜 확인 (로컬 타임존)
    const today = (() => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    })()
    const isFuture = dateStr > today
    
    return (
      <div className="space-y-1">
        {hasInbound && (
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              <ArrowUp className="w-3 h-3 mr-1" />
              +{dayData.inQuantity}
            </span>
          </div>
        )}
        {hasOutbound && (
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
              <ArrowDown className="w-3 h-3 mr-1" />
              -{dayData.outQuantity}
            </span>
          </div>
        )}
        {/* 최종 재고 표시 - 오늘까지만 표시, 미래는 빈칸 */}
        {!isFuture && (
          <div className="flex items-center justify-center">
            <span className={`text-xs font-bold ${hasMovement ? 'text-blue-700' : 'text-gray-500'}`}>
              {dayData.finalStock}
            </span>
          </div>
        )}
      </div>
    )
  }

  const getMonthSummary = () => {
    let totalIn = 0
    let totalOut = 0
    const activeDays = new Set<string>()

    productDailyData.forEach(productData => {
      Object.values(productData.dailyData).forEach(dayData => {
        totalIn += dayData.inQuantity
        totalOut += dayData.outQuantity
        if (dayData.inQuantity > 0 || dayData.outQuantity > 0) {
          activeDays.add(dayData.date)
        }
      })
    })

    return { totalIn, totalOut, activeDays: activeDays.size }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-primary-600">데이터 로딩 중...</div>
      </div>
    )
  }

  const summary = getMonthSummary()

  // 카테고리 정렬 순서 정의
  const categoryOrder = ['정제품', '샘플', '사셰', '테스터']
  
  // 카테고리별로 분리된 데이터
  const productDataByCategory = viewMode === 'category-separated' 
    ? categoryOrder.reduce((acc, categoryName) => {
        const category = categories.find(cat => cat.name === categoryName)
        if (!category) return acc
        
        // 각 카테고리별로 독립적인 정렬 적용
        const categoryProducts = productDailyData.filter(productData => 
          productData.product.category?.name === categoryName
        )
        
        // 해당 카테고리의 정렬 상태 가져오기
        const categorySort = categorySortStates[categoryName] || { sortBy: 'name', sortOrder: 'asc' }
        
        // 카테고리별 정렬 적용
        const sortedCategoryProducts = [...categoryProducts].sort((a, b) => {
          let compareValue = 0
          if (categorySort.sortBy === 'name') {
            compareValue = a.product.name.localeCompare(b.product.name)
          } else if (categorySort.sortBy === 'stock') {
            compareValue = (a.product.currentStock || 0) - (b.product.currentStock || 0)
          }
          return categorySort.sortOrder === 'desc' ? -compareValue : compareValue
        })
        
        if (sortedCategoryProducts.length > 0) {
          acc[categoryName] = {
            category,
            products: sortedCategoryProducts
          }
        }
        return acc
      }, {} as Record<string, { 
        category: Category; 
        products: ProductDailyData[]
      }>)
    : null

  return (
    <div className="space-y-6">
      {/* 월 선택 헤더 */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </h3>
              <button
                onClick={() => setShowDatePicker(true)}
                className="p-1 hover:bg-gray-100 rounded-md"
                title="월 선택"
              >
                <Calendar className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('category-separated')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                viewMode === 'category-separated' 
                  ? 'bg-white text-primary-600 shadow' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              카테고리
            </button>
            <button
              onClick={() => setViewMode('single')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                viewMode === 'single' 
                  ? 'bg-white text-primary-600 shadow' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Layout className="w-4 h-4" />
              통합
            </button>
          </div>
        </div>
      </div>

      {/* 월간 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-sm font-medium text-gray-500 mb-1">월 총 입고</div>
          <div className="text-2xl font-bold text-green-600">
            +{summary.totalIn.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-sm font-medium text-gray-500 mb-1">월 총 출고</div>
          <div className="text-2xl font-bold text-red-600">
            -{summary.totalOut.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-sm font-medium text-gray-500 mb-1">활동 일수</div>
          <div className="text-2xl font-bold text-gray-900">
            {summary.activeDays}일
          </div>
        </div>
      </div>

      {/* 제품별 일별 입출고 테이블 */}
      {viewMode === 'single' ? (
        // 통합 테이블 모드
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h4 className="text-lg font-semibold text-gray-900">제품별 일일 입출고 현황</h4>
            <p className="text-sm text-gray-500 mt-1">가로로 스크롤하여 전체 월간 데이터를 확인하세요</p>
          </div>
          
          <div className="overflow-x-auto" ref={singleTableRef}>
            <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: `${384 + monthDates.length * 80}px` }}>
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th 
                    className="sticky left-0 z-20 bg-gray-50 border-r border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      제품명
                      {sortBy === 'name' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="sticky z-20 bg-gray-50 border-r border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    style={{ left: '240px', width: '120px', minWidth: '120px', maxWidth: '120px' }}
                    onClick={() => handleSort('stock')}
                  >
                    <div className="flex items-center gap-1">
                      현재고
                      {sortBy === 'stock' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  {monthDates.map(dateStr => {
                    const dateInfo = formatDateHeader(dateStr)
                    return (
                      <th 
                        key={dateStr} 
                        className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wider min-w-20 ${
                          dateInfo.isPrevMonth 
                            ? 'bg-gray-100 text-gray-400'
                            : dateInfo.isWeekend 
                            ? 'bg-red-50 text-red-600' 
                            : 'text-gray-500'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className={`font-bold ${dateInfo.isPrevMonth ? 'text-gray-400' : ''}`}>
                            {dateInfo.day}
                          </span>
                          <span className="text-xs">{dateInfo.weekday}</span>
                          {dateInfo.isPrevMonth && (
                            <span className="text-xs text-gray-400">전월</span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedProductData.map((productData, index) => (
                  <tr key={productData.product.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td 
                      className="sticky left-0 z-10 bg-inherit border-r border-gray-300 px-4 py-3"
                      style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {productData.product.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {productData.product.category?.name}
                      </div>
                    </td>
                    <td 
                      className="sticky z-10 bg-inherit border-r border-gray-300 px-4 py-3"
                      style={{ left: '240px', width: '120px', minWidth: '120px', maxWidth: '120px' }}
                    >
                      <div className="text-sm font-semibold text-blue-600">
                        {productData.product.currentStock?.toLocaleString() || 0}
                      </div>
                    </td>
                    {monthDates.map(dateStr => {
                      const dateInfo = formatDateHeader(dateStr)
                      const cellContent = getDayCellContent(productData, dateStr)
                      
                      return (
                        <td 
                          key={dateStr} 
                          className={`px-2 py-3 text-center min-w-20 ${
                            dateInfo.isPrevMonth 
                              ? 'bg-gray-100' 
                              : dateInfo.isWeekend 
                              ? 'bg-red-50' 
                              : ''
                          }`}
                        >
                          {cellContent}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {productDailyData.length === 0 && (
                  <tr>
                    <td colSpan={monthDates.length + 1} className="px-4 py-12 text-center text-gray-500">
                      해당 월의 제품 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // 카테고리별 분리 테이블 모드
        <div className="space-y-6">
          {productDataByCategory && Object.keys(productDataByCategory).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">데이터가 없습니다</h3>
              <p className="mt-2 text-sm text-gray-500">
                해당 월에 입출고 데이터가 없습니다.
              </p>
            </div>
          ) : (
            productDataByCategory && Object.entries(productDataByCategory).map(([categoryName, categoryData]) => (
              <div key={categoryName} className="bg-white rounded-lg border overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {categoryData.category.name} 
                    <span className="text-sm font-normal text-gray-600">
                      ({categoryData.products.length}개 제품)
                    </span>
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">가로로 스크롤하여 전체 월간 데이터를 확인하세요</p>
                </div>
                
                <div 
                  className="overflow-x-auto"
                  ref={(el) => {
                    if (el) {
                      categoryTablesRef.current[categoryName] = el
                    }
                  }}
                >
                  <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: `${384 + monthDates.length * 80}px` }}>
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th 
                          className="sticky left-0 z-20 bg-gray-50 border-r border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}
                          onClick={() => handleCategorySort(categoryName, 'name')}
                        >
                          <div className="flex items-center gap-1">
                            제품명
                            {(categorySortStates[categoryName]?.sortBy === 'name' || !categorySortStates[categoryName]) && (
                              (categorySortStates[categoryName]?.sortOrder || 'asc') === 'asc' ? 
                              <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        <th 
                          className="sticky z-20 bg-gray-50 border-r border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          style={{ left: '240px', width: '120px', minWidth: '120px', maxWidth: '120px' }}
                          onClick={() => handleCategorySort(categoryName, 'stock')}
                        >
                          <div className="flex items-center gap-1">
                            현재고
                            {categorySortStates[categoryName]?.sortBy === 'stock' && (
                              categorySortStates[categoryName].sortOrder === 'asc' ? 
                              <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </div>
                        </th>
                        {monthDates.map(dateStr => {
                          const dateInfo = formatDateHeader(dateStr)
                          return (
                            <th 
                              key={dateStr} 
                              className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wider min-w-20 ${
                                dateInfo.isPrevMonth 
                                  ? 'bg-gray-100 text-gray-400'
                                  : dateInfo.isWeekend 
                                  ? 'bg-red-50 text-red-600' 
                                  : 'text-gray-500'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className={`font-bold ${dateInfo.isPrevMonth ? 'text-gray-400' : ''}`}>
                                  {dateInfo.day}
                                </span>
                                <span className="text-xs">{dateInfo.weekday}</span>
                                {dateInfo.isPrevMonth && (
                                  <span className="text-xs text-gray-400">전월</span>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categoryData.products.map((productData, index) => (
                        <tr key={productData.product.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td 
                            className="sticky left-0 z-10 bg-inherit border-r border-gray-300 px-4 py-3"
                            style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {productData.product.name}
                            </div>
                          </td>
                          <td 
                            className="sticky z-10 bg-inherit border-r border-gray-300 px-4 py-3"
                            style={{ left: '240px', width: '120px', minWidth: '120px', maxWidth: '120px' }}
                          >
                            <div className="text-sm font-semibold text-blue-600">
                              {productData.product.currentStock?.toLocaleString() || 0}
                            </div>
                          </td>
                          {monthDates.map(dateStr => {
                            const dateInfo = formatDateHeader(dateStr)
                            const cellContent = getDayCellContent(productData, dateStr)
                            
                            return (
                              <td 
                                key={dateStr} 
                                className={`px-2 py-3 text-center min-w-20 ${
                                  dateInfo.isPrevMonth 
                                    ? 'bg-gray-100' 
                                    : dateInfo.isWeekend 
                                    ? 'bg-red-50' 
                                    : ''
                                }`}
                              >
                                {cellContent}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 월 선택 모달 */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                연월 선택
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">연도</label>
                  <select
                    value={currentDate.getFullYear()}
                    onChange={(e) => handleDateSelect(parseInt(e.target.value), currentDate.getMonth() + 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i
                      return (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      )
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">월</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1
                      const isSelected = currentDate.getMonth() + 1 === month
                      return (
                        <button
                          key={month}
                          onClick={() => handleDateSelect(currentDate.getFullYear(), month)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {month}월
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}