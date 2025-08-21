'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
// import { supabase } from '@/lib/supabase'
import { InventoryMovement, Inventory, Product, Location } from '@/types'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts'
import { TrendingUp, TrendingDown, Package, BarChart3 } from 'lucide-react'
import Header from '@/components/Header'

interface StatsData {
  dailyInbound: { date: string; count: number }[]
  dailyOutbound: { date: string; count: number }[]
  locationStats: { name: string; totalStock: number; itemCount: number }[]
  categoryStats: { name: string; totalStock: number; itemCount: number }[]
  recentMovements: InventoryMovement[]
  lowStockItems: Inventory[]
}

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4']

export default function StatsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [statsData, setStatsData] = useState<StatsData>({
    dailyInbound: [],
    dailyOutbound: [],
    locationStats: [],
    categoryStats: [],
    recentMovements: [],
    lowStockItems: []
  })
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7') // 7일, 30일, 90일

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) {
      loadStatsData()
    }
  }, [user, dateRange])

  const loadStatsData = async () => {
    try {
      setIsDataLoading(true)
      
      const days = parseInt(dateRange)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateStr = startDate.toISOString().split('T')[0]

      // API를 통해 데이터 로드
      const [inventoryResponse, movementsResponse] = await Promise.all([
        fetch(`/api/inventory${user ? `?userId=${user.username}` : ''}`),
        fetch(`/api/movements?start_date=${startDateStr}`)
      ])

      if (!inventoryResponse.ok || !movementsResponse.ok) {
        console.error('API 응답 오류:', {
          inventory: inventoryResponse.status,
          movements: movementsResponse.status
        })
        return
      }

      const inventoryData = await inventoryResponse.json()
      const movementsData = await movementsResponse.json()

      const inventory = inventoryData.inventory || []
      const allMovements = movementsData.movements || []
      const inboundMovements = allMovements.filter((m: any) => m.movement_type === 'in')
      const outboundMovements = allMovements.filter((m: any) => m.movement_type === 'out')
      const recentMovements = allMovements.slice(0, 10)
      const lowStockInventory = inventory.filter((item: any) => item.current_stock <= user.alert_threshold)

      // 데이터 가공
      const processedData: StatsData = {
        dailyInbound: processDailyData(inboundMovements || [], days),
        dailyOutbound: processDailyData(outboundMovements || [], days),
        locationStats: processLocationStats(inventory || []),
        categoryStats: processCategoryStats(inventory || []),
        recentMovements: recentMovements || [],
        lowStockItems: lowStockInventory || []
      }

      setStatsData(processedData)

    } catch (error) {
      console.error('통계 데이터 로드 중 오류:', error)
    } finally {
      setIsDataLoading(false)
    }
  }

  const processDailyData = (movements: any[], days: number) => {
    const dailyMap: Record<string, number> = {}
    
    // 지난 n일간의 날짜별 빈 데이터 생성
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dailyMap[dateStr] = 0
    }

    // 실제 데이터로 채우기
    movements.forEach(movement => {
      if (dailyMap.hasOwnProperty(movement.movement_date)) {
        dailyMap[movement.movement_date] += Math.abs(movement.quantity)
      }
    })

    return Object.entries(dailyMap).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      count
    }))
  }

  const processLocationStats = (inventory: any[]) => {
    const locationMap: Record<string, { totalStock: number; itemCount: number }> = {}
    
    inventory.forEach(item => {
      const locationName = item.location?.name || '알 수 없음'
      if (!locationMap[locationName]) {
        locationMap[locationName] = { totalStock: 0, itemCount: 0 }
      }
      locationMap[locationName].totalStock += item.current_stock
      locationMap[locationName].itemCount += 1
    })

    return Object.entries(locationMap).map(([name, stats]) => ({
      name,
      ...stats
    }))
  }

  const processCategoryStats = (inventory: any[]) => {
    const categoryMap: Record<string, { totalStock: number; itemCount: number }> = {}
    
    inventory.forEach(item => {
      const categoryName = item.product?.category?.name || '알 수 없음'
      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = { totalStock: 0, itemCount: 0 }
      }
      categoryMap[categoryName].totalStock += item.current_stock
      categoryMap[categoryName].itemCount += 1
    })

    return Object.entries(categoryMap).map(([name, stats]) => ({
      name,
      ...stats
    }))
  }

  if (isLoading || isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary-600 text-lg">통계 데이터 로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const totalStock = statsData.locationStats.reduce((sum, item) => sum + item.totalStock, 0)
  const totalItems = statsData.locationStats.reduce((sum, item) => sum + item.itemCount, 0)
  const recentInbound = statsData.dailyInbound.reduce((sum, item) => sum + item.count, 0)
  const recentOutbound = statsData.dailyOutbound.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        user={user} 
        onLogout={() => router.push('/')}
        viewMode="current"
        onViewModeChange={() => {}}
        showImages={false}
        onToggleImages={() => {}}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">통계 대시보드</h1>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">기간:</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="select-field text-sm"
              >
                <option value="7">최근 7일</option>
                <option value="30">최근 30일</option>
                <option value="90">최근 90일</option>
              </select>
            </div>
          </div>
        </div>

        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-primary-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">총 재고량</p>
                <p className="text-2xl font-bold text-gray-900">{totalStock.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">총 품목 수</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">최근 입고</p>
                <p className="text-2xl font-bold text-green-600">+{recentInbound.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <TrendingDown className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">최근 출고</p>
                <p className="text-2xl font-bold text-red-600">-{recentOutbound.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 일별 입출고 현황 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 입출고 현황</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statsData.dailyInbound.map((inbound, index) => ({
                date: inbound.date,
                입고: inbound.count,
                출고: statsData.dailyOutbound[index]?.count || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="입고" stroke="#22c55e" strokeWidth={2} />
                <Line type="monotone" dataKey="출고" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 위치별 재고 분포 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">위치별 재고 분포</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statsData.locationStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="totalStock"
                >
                  {statsData.locationStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value.toLocaleString(), '재고량']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 카테고리별 통계 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 재고</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statsData.categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [value.toLocaleString(), '재고량']} />
                <Bar dataKey="totalStock" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 재고 부족 알림 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              재고 부족 알림 ({user.alert_threshold}개 이하)
            </h3>
            {statsData.lowStockItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">재고 부족 품목이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {statsData.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-warning-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{item.product?.name}</div>
                      <div className="text-sm text-gray-500">{item.location?.name}</div>
                    </div>
                    <div className="text-warning-600 font-bold">
                      {item.current_stock.toLocaleString()}개
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}