import { Inventory } from '@/types'

// 상품별로 재고를 그룹화하는 인터페이스
export interface GroupedInventoryItem {
  product_id: string
  location_id: string
  product?: { name: string; category?: { name: string } | null; image_url?: string; code?: string }
  location?: { name: string }
  total_stock: number
  batch_count: number
  latest_updated: string
  batches: Inventory[]
  expanded?: boolean
}

// 같은 상품의 다른 배치코드들을 그룹화하는 함수
export function groupInventoryByProduct(inventory: Inventory[]): GroupedInventoryItem[] {
  const grouped = new Map<string, GroupedInventoryItem>()

  inventory.forEach(item => {
    const key = `${item.product_id}-${item.location_id}`
    
    if (grouped.has(key)) {
      const existing = grouped.get(key)!
      existing.total_stock += item.current_stock
      existing.batch_count++
      existing.batches.push(item)
      
      // 최신 업데이트 날짜 비교
      if (new Date(item.last_updated) > new Date(existing.latest_updated)) {
        existing.latest_updated = item.last_updated
      }
    } else {
      grouped.set(key, {
        product_id: item.product_id,
        location_id: item.location_id,
        product: item.product,
        location: item.location,
        total_stock: item.current_stock,
        batch_count: 1,
        latest_updated: item.last_updated,
        batches: [item],
        expanded: false
      })
    }
  })

  return Array.from(grouped.values()).sort((a, b) => a.product_id.localeCompare(b.product_id))
}

// 배치코드별 상세 정보를 정렬하는 함수
export function sortBatchesByExpiry(batches: Inventory[]): Inventory[] {
  return batches.sort((a, b) => {
    // 유통기한이 있는 경우 유통기한 순으로, 없으면 배치코드 순으로
    if (a.expiry_date && b.expiry_date) {
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    }
    return a.batch_code.localeCompare(b.batch_code)
  })
}

// 유통기한 상태 계산
export function getExpiryStatus(expiryDate: string): 'expired' | 'warning' | 'caution' | 'normal' {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const timeDiff = expiry.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

  if (daysDiff < 0) return 'expired'
  if (daysDiff <= 30) return 'warning'
  if (daysDiff <= 90) return 'caution'
  return 'normal'
}

// 유통기한 상태별 색상 클래스
export const EXPIRY_STATUS_STYLES = {
  expired: 'text-red-600 bg-red-50 border-red-200',
  warning: 'text-orange-600 bg-orange-50 border-orange-200',
  caution: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  normal: 'text-green-600 bg-green-50 border-green-200'
} as const

// 유통기한 상태별 텍스트
export const EXPIRY_STATUS_TEXT = {
  expired: '만료',
  warning: '30일 이내',
  caution: '90일 이내', 
  normal: '정상'
} as const