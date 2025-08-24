'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { InventoryMovement, Inventory } from '@/types'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts'
import { 
  TrendingUp, 
  Package, 
  BarChart3, 
  AlertTriangle,
  Clock,
  DollarSign,
  Target,
  Zap
} from 'lucide-react'
import Header from '@/components/Header'

interface StatsData {
  dailyInbound: { date: string; count: number; value: number }[]
  dailyOutbound: { date: string; count: number; value: number }[]
  locationStats: { name: string; totalStock: number; itemCount: number; value: number }[]
  categoryStats: { name: string; totalStock: number; itemCount: number; turnoverRate: number }[]
  topMovingProducts: { name: string; category: string; totalMovement: number; locations: string[] }[]
  slowMovingProducts: { name: string; category: string; lastMovement: string; daysIdle: number; currentStock: number; location: string; daysSinceLastMovement: number }[]
  stockTurnoverAnalysis: { category: string; turnoverRate: number; avgDaysToTurn: number }[]
  expiryAlerts: { name: string; batchCode: string; location: string; estimatedExpiry: string; daysLeft: number }[]
  seasonalTrends: { month: string; totalMovement: number; avgDaily: number }[]
  profitabilityAnalysis: { location: string; totalValue: number; movementRate: number; efficiency: number }[]
}


export default function StatsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [statsData, setStatsData] = useState<StatsData>({
    dailyInbound: [],
    dailyOutbound: [],
    locationStats: [],
    categoryStats: [],
    topMovingProducts: [],
    slowMovingProducts: [],
    stockTurnoverAnalysis: [],
    expiryAlerts: [],
    seasonalTrends: [],
    profitabilityAnalysis: []
  })
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30') // 7일, 30일, 90일

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

      const inventory = inventoryData.data?.inventory || []
      const allMovements = movementsData.movements || []

      // 데이터 가공
      const processedData: StatsData = {
        dailyInbound: processDailyData(allMovements.filter((m: InventoryMovement) => m.movement_type === 'in'), days),
        dailyOutbound: processDailyData(allMovements.filter((m: InventoryMovement) => m.movement_type === 'out'), days),
        locationStats: processLocationStats(inventory),
        categoryStats: processCategoryStats(inventory, allMovements),
        topMovingProducts: processTopMovingProducts(allMovements, inventory),
        slowMovingProducts: processSlowMovingProducts(allMovements, inventory),
        stockTurnoverAnalysis: processStockTurnoverAnalysis(inventory, allMovements),
        expiryAlerts: processExpiryAlerts(inventory),
        seasonalTrends: processSeasonalTrends(allMovements),
        profitabilityAnalysis: processProfitabilityAnalysis(inventory, allMovements)
      }

      setStatsData(processedData)

    } catch (error) {
      console.error('통계 데이터 로드 중 오류:', error)
    } finally {
      setIsDataLoading(false)
    }
  }

  const processDailyData = (movements: InventoryMovement[], days: number) => {
    const dailyMap: Record<string, { count: number; value: number }> = {}
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dailyMap[dateStr] = { count: 0, value: 0 }
    }

    movements.forEach(movement => {
      if (dailyMap.hasOwnProperty(movement.movement_date)) {
        const qty = Math.abs(movement.quantity)
        const estimatedPrice = getEstimatedPrice(movement.product_id)
        dailyMap[movement.movement_date].count += qty
        dailyMap[movement.movement_date].value += qty * estimatedPrice
      }
    })

    return Object.entries(dailyMap).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      count: data.count,
      value: Math.round(data.value / 1000) // 천원 단위
    }))
  }

  const getEstimatedPrice = (productName: string): number => {
    if (productName.includes('클렌징') || productName.includes('세럼')) return 50000
    if (productName.includes('토너') || productName.includes('에센스')) return 35000
    if (productName.includes('크림') || productName.includes('로션')) return 45000
    if (productName.includes('마스크') || productName.includes('팩')) return 25000
    if (productName.includes('샘플') || productName.includes('사셰')) return 5000
    if (productName.includes('테스터')) return 1000
    return 30000
  }

  const processLocationStats = (inventory: Inventory[]) => {
    const locationMap: Record<string, { totalStock: number; itemCount: number; value: number }> = {}
    
    inventory.forEach(item => {
      const locationName = item.location?.name || '알 수 없음'
      if (!locationMap[locationName]) {
        locationMap[locationName] = { totalStock: 0, itemCount: 0, value: 0 }
      }
      locationMap[locationName].totalStock += item.current_stock
      locationMap[locationName].itemCount += 1
      locationMap[locationName].value += item.current_stock * getEstimatedPrice(item.product_id)
    })

    return Object.entries(locationMap).map(([name, stats]) => ({
      name,
      ...stats,
      value: Math.round(stats.value / 1000) // 천원 단위
    }))
  }

  const processCategoryStats = (inventory: Inventory[], movements: InventoryMovement[]) => {
    const categoryMap: Record<string, { totalStock: number; itemCount: number; movementCount: number }> = {}
    
    inventory.forEach(item => {
      const categoryName = item.product?.category?.name || item.category?.name || '알 수 없음'
      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = { totalStock: 0, itemCount: 0, movementCount: 0 }
      }
      categoryMap[categoryName].totalStock += item.current_stock
      categoryMap[categoryName].itemCount += 1
    })

    movements.forEach(movement => {
      const category = movement.product?.category?.name || '알 수 없음'
      if (categoryMap[category]) {
        categoryMap[category].movementCount += 1
      }
    })

    return Object.entries(categoryMap).map(([name, stats]) => ({
      name,
      totalStock: stats.totalStock,
      itemCount: stats.itemCount,
      turnoverRate: stats.totalStock > 0 ? Number((stats.movementCount / stats.totalStock * 100).toFixed(1)) : 0
    }))
  }

  const processTopMovingProducts = (movements: InventoryMovement[], inventory: Inventory[]) => {
    const productMap: Record<string, { totalMovement: number; locations: Set<string>; category: string }> = {}
    
    movements.forEach(movement => {
      const productName = movement.product_id
      if (!productMap[productName]) {
        productMap[productName] = { 
          totalMovement: 0, 
          locations: new Set(),
          category: '알 수 없음'
        }
      }
      productMap[productName].totalMovement += Math.abs(movement.quantity)
      productMap[productName].locations.add(movement.location_id)
    })

    return Object.entries(productMap)
      .map(([name, data]) => ({
        name,
        category: data.category,
        totalMovement: data.totalMovement,
        locations: Array.from(data.locations)
      }))
      .sort((a, b) => b.totalMovement - a.totalMovement)
      .slice(0, 8)
  }

  const processSlowMovingProducts = (movements: InventoryMovement[], inventory: Inventory[]) => {
    const now = new Date()
    const slowMoving: { name: string; daysSinceLastMovement: number; currentStock: number; location: string; category: string }[] = []
    
    inventory.forEach(item => {
      const productMovements = movements.filter(m => m.product_id === item.product_id)
      
      if (productMovements.length === 0) {
        slowMoving.push({
          name: item.product_id,
          category: item.product?.category?.name || item.category?.name || '알 수 없음',
          lastMovement: '이동 기록 없음',
          daysIdle: 999,
          currentStock: item.current_stock,
          location: item.location?.name || '알 수 없음',
          daysSinceLastMovement: 999
        })
      } else {
        const lastMovement = productMovements.sort((a: InventoryMovement, b: InventoryMovement) => 
          new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
        )[0]
        
        const daysSinceLastMovement = Math.floor((now.getTime() - new Date(lastMovement.movement_date).getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceLastMovement > 30) {
          slowMoving.push({
            name: item.product_id,
            category: item.product?.category?.name || item.category?.name || '알 수 없음',
            lastMovement: new Date(lastMovement.movement_date).toLocaleDateString('ko-KR'),
            daysIdle: daysSinceLastMovement,
            currentStock: item.current_stock,
            location: item.location?.name || '알 수 없음',
            daysSinceLastMovement
          })
        }
      }
    })

    return slowMoving.sort((a, b) => b.daysIdle - a.daysIdle).slice(0, 8)
  }

  const processStockTurnoverAnalysis = (inventory: Inventory[], movements: InventoryMovement[]) => {
    const categoryAnalysis: Record<string, { totalStock: number; totalMovement: number }> = {}
    
    inventory.forEach(item => {
      const category = item.product?.category?.name || item.category?.name || '알 수 없음'
      if (!categoryAnalysis[category]) {
        categoryAnalysis[category] = { totalStock: 0, totalMovement: 0 }
      }
      categoryAnalysis[category].totalStock += item.current_stock
    })

    movements.forEach(movement => {
      const category = movement.product?.category?.name || '알 수 없음'
      if (categoryAnalysis[category]) {
        categoryAnalysis[category].totalMovement += Math.abs(movement.quantity)
      }
    })

    return Object.entries(categoryAnalysis).map(([category, data]) => ({
      category,
      turnoverRate: Number((data.totalStock > 0 ? (data.totalMovement / data.totalStock) : 0).toFixed(2)),
      avgDaysToTurn: data.totalMovement > 0 ? Math.round(365 * data.totalStock / data.totalMovement) : 999
    }))
  }

  const processExpiryAlerts = (inventory: Inventory[]) => {
    const now = new Date()
    const alerts: { product: string; location: string; batchCode: string; expiryDate: string; daysUntilExpiry: number; currentStock: number; status: string }[] = []
    
    inventory.forEach(item => {
      if (item.batch_code && item.batch_code.length >= 4) {
        const year = 2000 + parseInt(item.batch_code.substring(0, 2))
        const month = parseInt(item.batch_code.substring(2, 4)) - 1
        
        if (!isNaN(year) && !isNaN(month)) {
          const productionDate = new Date(year, month)
          const expiryDate = new Date(productionDate)
          expiryDate.setFullYear(expiryDate.getFullYear() + 3)
          
          const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysLeft <= 180 && daysLeft > 0) {
            alerts.push({
              name: item.product_id,
              batchCode: item.batch_code,
              location: item.location?.name || '알 수 없음',
              estimatedExpiry: expiryDate.toLocaleDateString('ko-KR'),
              daysLeft
            })
          }
        }
      }
    })

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
  }

  const processSeasonalTrends = (movements: InventoryMovement[]) => {
    const monthlyData: Record<string, number> = {}
    
    movements.forEach(movement => {
      const date = new Date(movement.movement_date)
      const monthKey = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0
      }
      monthlyData[monthKey] += Math.abs(movement.quantity)
    })

    return Object.entries(monthlyData).map(([month, totalMovement]) => ({
      month,
      totalMovement,
      avgDaily: Math.round(totalMovement / 30)
    }))
  }

  const processProfitabilityAnalysis = (inventory: Inventory[], movements: InventoryMovement[]) => {
    const locationAnalysis: Record<string, { totalValue: number; movementCount: number }> = {}
    
    inventory.forEach(item => {
      const location = item.location?.name || '알 수 없음'
      if (!locationAnalysis[location]) {
        locationAnalysis[location] = { totalValue: 0, movementCount: 0 }
      }
      locationAnalysis[location].totalValue += item.current_stock * getEstimatedPrice(item.product_id)
    })

    movements.forEach(movement => {
      const location = movement.location_id
      if (locationAnalysis[location]) {
        locationAnalysis[location].movementCount += 1
      }
    })

    return Object.entries(locationAnalysis).map(([location, data]) => ({
      location,
      totalValue: Math.round(data.totalValue / 1000),
      movementRate: data.movementCount,
      efficiency: Number((data.totalValue > 0 ? (data.movementCount / data.totalValue * 1000000) : 0).toFixed(2))
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

  const totalValue = statsData.locationStats.reduce((sum, item) => sum + item.value, 0)
  const avgTurnover = statsData.stockTurnoverAnalysis.length > 0 
    ? statsData.stockTurnoverAnalysis.reduce((sum, item) => sum + item.turnoverRate, 0) / statsData.stockTurnoverAnalysis.length
    : 0

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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 비즈니스 인사이트</h1>
              <p className="text-gray-600 mt-1">실무에 도움이 되는 재고 분석과 인사이트</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">분석 기간:</label>
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

        {/* 핵심 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">총 재고 가치</p>
                <p className="text-2xl font-bold text-gray-900">₩{totalValue.toLocaleString()}천</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">평균 회전율</p>
                <p className="text-2xl font-bold text-green-600">{avgTurnover.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">느린 이동 제품</p>
                <p className="text-2xl font-bold text-orange-600">{statsData.slowMovingProducts.length}개</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">유통기한 경고</p>
                <p className="text-2xl font-bold text-red-600">{statsData.expiryAlerts.length}개</p>
              </div>
            </div>
          </div>
        </div>

        {/* 첫 번째 행 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 일별 가치 이동 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              일별 가치 이동 (천원)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={statsData.dailyInbound.map((inbound, index) => ({
                date: inbound.date,
                입고: inbound.value,
                출고: statsData.dailyOutbound[index]?.value || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}천`, '']} />
                <Area type="monotone" dataKey="입고" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="출고" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 카테고리별 회전율 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              카테고리별 재고 회전율
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statsData.categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, '회전율']} />
                <Bar dataKey="turnoverRate" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 두 번째 행 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* TOP 이동 제품 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              TOP 이동 제품 (활발한 제품)
            </h3>
            <div className="space-y-3">
              {statsData.topMovingProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">{product.totalMovement}</div>
                    <div className="text-xs text-gray-500">{product.locations.length}개 지점</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 느린 이동 제품 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              느린 이동 제품 (재고 정리 필요)
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {statsData.slowMovingProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.category}</div>
                    <div className="text-xs text-orange-600">마지막: {product.lastMovement}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-orange-600">{product.daysIdle}일</div>
                    <div className="text-xs text-gray-500">재고 {product.currentStock}개</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 세 번째 행 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 위치별 효율성 분석 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              위치별 운영 효율성
            </h3>
            <div className="space-y-4">
              {statsData.profitabilityAnalysis.map((item, index) => (
                <div key={index} className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{item.location}</span>
                    <span className="text-sm font-bold text-blue-600">효율성: {item.efficiency}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">재고 가치</div>
                      <div className="font-medium">₩{item.totalValue.toLocaleString()}천</div>
                    </div>
                    <div>
                      <div className="text-gray-500">이동 횟수</div>
                      <div className="font-medium">{item.movementRate}회</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 유통기한 경고 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              유통기한 임박 알림 (6개월 이내)
            </h3>
            {statsData.expiryAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                임박한 유통기한이 없습니다 👍
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {statsData.expiryAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{alert.name}</div>
                      <div className="text-xs text-gray-500">배치: {alert.batchCode} | {alert.location}</div>
                      <div className="text-xs text-red-600">만료일: {alert.estimatedExpiry}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">{alert.daysLeft}일</div>
                      <div className="text-xs text-gray-500">남음</div>
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