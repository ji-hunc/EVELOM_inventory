'use client'

import { Location, Inventory, User } from '@/types'

interface LocationTabsProps {
  locations: Location[]
  selectedLocation: string
  onLocationSelect: (locationId: string) => void
  inventory: Inventory[]
  user: User
}

export default function LocationTabs({
  locations,
  selectedLocation,
  onLocationSelect,
  inventory,
  user
}: LocationTabsProps) {
  const getLocationStats = (locationId: string) => {
    const locationInventory = inventory.filter(item => item.location_id === locationId)
    const totalItems = locationInventory.length
    const totalStock = locationInventory.reduce((sum, item) => sum + item.current_stock, 0)
    return { totalItems, totalStock }
  }

  const getAllStats = () => {
    const uniqueProducts = new Set(inventory.map(item => item.product_id))
    const totalItems = uniqueProducts.size
    const totalStock = inventory.reduce((sum, item) => sum + item.current_stock, 0)
    return { totalItems, totalStock }
  }

  // 일반 계정은 자신의 위치만, 마스터는 모든 위치 
  const allowedLocations = user.role === 'master' 
    ? locations 
    : locations.filter(loc => loc.name === user.assigned_location_id)

  // 원하는 순서대로 위치 정렬: 창고, 청량리, AK
  const sortedLocations = [...allowedLocations].sort((a, b) => {
    const order = { '창고': 1, '청량리': 2, 'AK': 3 }
    const orderA = order[a.name as keyof typeof order] || 999
    const orderB = order[b.name as keyof typeof order] || 999
    return orderA - orderB
  })

  const allStats = getAllStats()

  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8 px-6" aria-label="위치 탭">
        {/* 개별 위치 탭들 */}
        {sortedLocations.map((location) => {
          const stats = getLocationStats(location.name)
          const isSelected = selectedLocation === location.name
          
          return (
            <button
              key={location.name}
              onClick={() => onLocationSelect(location.name)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isSelected
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="font-semibold">{location.name}</span>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-gray-600">{stats.totalItems}개 품목</span>
                  <span className="text-gray-400">|</span>
                  <span className="font-medium text-primary-600">{stats.totalStock}개 재고</span>
                </div>
              </div>
            </button>
          )
        })}
        
        {/* 전체 탭 - 마스터만 */}
        {user.role === 'master' && (
          <button
            onClick={() => onLocationSelect('all')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedLocation === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="font-semibold">전체</span>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="text-gray-600">{allStats.totalItems}개 품목</span>
                <span className="text-gray-400">|</span>
                <span className="font-medium text-primary-600">{allStats.totalStock}개 총재고</span>
              </div>
            </div>
          </button>
        )}
      </nav>
    </div>
  )
}