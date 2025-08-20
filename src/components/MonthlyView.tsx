'use client'

import { useState, useEffect } from 'react'
import { InventoryMovement, Product, Location } from '@/types'
// import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface MonthlyViewProps {
  selectedLocation: string
  products: Product[]
  locations: Location[]
}

interface DailyData {
  date: string
  movements: InventoryMovement[]
  inTotal: number
  outTotal: number
}

export default function MonthlyView({ selectedLocation, products, locations }: MonthlyViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [monthlyData, setMonthlyData] = useState<DailyData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [productStocks, setProductStocks] = useState<Record<string, number>>({})

  useEffect(() => {
    loadMonthlyData()
  }, [currentDate, selectedLocation])

  const loadMonthlyData = async () => {
    try {
      setIsLoading(true)
      
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0)
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

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

      // 현재 재고는 대시보드에서 가져온 데이터 사용 (간단하게)
      const inventory = []

      const stocksMap: Record<string, number> = {}
      inventory?.forEach(item => {
        stocksMap[item.product_id] = item.current_stock
      })
      setProductStocks(stocksMap)

      // 일별 데이터 그룹화
      const dailyDataMap: Record<string, DailyData> = {}
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        dailyDataMap[dateStr] = {
          date: dateStr,
          movements: [],
          inTotal: 0,
          outTotal: 0
        }
      }

      movements?.forEach(movement => {
        const dateStr = movement.movement_date
        if (dailyDataMap[dateStr]) {
          dailyDataMap[dateStr].movements.push(movement)
          
          if (movement.movement_type === 'in') {
            dailyDataMap[dateStr].inTotal += movement.quantity
          } else if (movement.movement_type === 'out') {
            dailyDataMap[dateStr].outTotal += Math.abs(movement.quantity)
          }
        }
      })

      setMonthlyData(Object.values(dailyDataMap))
      
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

  const getProductCurrentStock = (productId: string) => {
    return productStocks[productId] || 0
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const getWeekday = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    return weekdays[date.getDay()]
  }

  const isWeekend = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDay()
    return day === 0 || day === 6
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
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월 입출고 현황
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="text-sm text-gray-500">
            선택된 위치: {locations.find(l => l.id === selectedLocation)?.name || '전체'}
          </div>
        </div>
      </div>

      {/* 월간 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-sm font-medium text-gray-500 mb-1">월 총 입고</div>
          <div className="text-2xl font-bold text-inbound-600">
            +{monthlyData.reduce((sum, day) => sum + day.inTotal, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-sm font-medium text-gray-500 mb-1">월 총 출고</div>
          <div className="text-2xl font-bold text-outbound-600">
            -{monthlyData.reduce((sum, day) => sum + day.outTotal, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-sm font-medium text-gray-500 mb-1">활동 일수</div>
          <div className="text-2xl font-bold text-gray-900">
            {monthlyData.filter(day => day.movements.length > 0).length}일
          </div>
        </div>
      </div>

      {/* 일별 상세 데이터 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h4 className="text-lg font-semibold text-gray-900">일별 상세 내역</h4>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  날짜
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  요일
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  입고
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  출고
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상세 내역
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyData.map((dayData) => {
                const hasMovements = dayData.movements.length > 0
                
                return (
                  <tr 
                    key={dayData.date} 
                    className={`${
                      isWeekend(dayData.date) ? 'bg-red-50' : hasMovements ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatDate(dayData.date)}
                    </td>
                    <td className={`px-4 py-3 text-sm ${
                      isWeekend(dayData.date) ? 'text-red-600 font-medium' : 'text-gray-500'
                    }`}>
                      {getWeekday(dayData.date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {dayData.inTotal > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-inbound-100 text-inbound-800">
                          +{dayData.inTotal.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {dayData.outTotal > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-outbound-100 text-outbound-800">
                          -{dayData.outTotal.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {dayData.movements.length > 0 ? (
                        <div className="space-y-1">
                          {dayData.movements.slice(0, 3).map((movement, index) => (
                            <div key={index} className="text-xs text-gray-600 flex items-center gap-2">
                              <span className={`inline-flex px-1 rounded text-white text-xs ${
                                movement.movement_type === 'in' 
                                  ? 'bg-inbound-500' 
                                  : movement.movement_type === 'out'
                                  ? 'bg-outbound-500'
                                  : 'bg-yellow-500'
                              }`}>
                                {movement.movement_type === 'in' ? '입' : movement.movement_type === 'out' ? '출' : '조'}
                              </span>
                              <span className="truncate">
                                {movement.product?.name}
                              </span>
                              <span className="text-gray-400">
                                ({Math.abs(movement.quantity).toLocaleString()})
                              </span>
                              <span className="text-gray-900 font-medium">
                                → {movement.new_stock.toLocaleString()}
                              </span>
                            </div>
                          ))}
                          {dayData.movements.length > 3 && (
                            <div className="text-xs text-gray-400">
                              외 {dayData.movements.length - 3}건
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">이동 없음</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}