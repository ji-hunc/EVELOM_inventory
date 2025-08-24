export interface User {
  username: string  // PK
  role: 'master' | 'general' | 'readonly'
  location?: string
  assigned_location_id?: string  // FK to locations.name
  alert_threshold: number
  created_at: string
  updated_at: string
  password_hash?: string
}

export interface Location {
  name: string  // PK
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  name: string  // PK
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  name: string  // PK
  code?: string
  category_id: string  // FK to categories.name
  category?: Category
  image_url?: string
  description?: string
  unit: string
  cost_price?: number  // 원가 (optional)
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Inventory {
  id: string  // UUID 유지
  product_id: string  // FK to products.name
  product?: Product
  location_id: string  // FK to locations.name
  location?: Location
  batch_code: string  // 배치코드 (예: 4030, 4030A)
  current_stock: number
  production_date: string  // 생산일자 (배치코드로부터 자동 계산)
  expiry_date: string  // 유통기한 (생산일 + 3년)
  last_updated: string
  last_modified_by?: string  // FK to users.username
  last_modified_by_user?: User
}

export interface InventoryMovement {
  id: string  // UUID 유지
  product_id: string  // FK to products.name
  product?: Product
  location_id: string  // FK to locations.name
  location?: Location
  batch_code: string  // 배치코드
  movement_type: 'in' | 'out' | 'adjustment' | 'transfer'
  quantity: number
  previous_stock: number
  new_stock: number
  movement_date: string
  notes?: string
  created_at: string
  modified_by?: string  // FK to users.username
  modified_by_user?: User
  transfer_group_id?: string
  from_location_id?: string  // FK to locations.name
  to_location_id?: string  // FK to locations.name
}

export interface AuthState {
  user: User | null
  isLoading: boolean
}

export interface InventoryFormData {
  product_id: string  // products.name
  location_id: string  // locations.name
  batch_code: string  // 배치코드
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  movement_date: string
  notes?: string
}

export interface ProductFormData {
  name: string  // PK
  code?: string
  category_id: string  // categories.name
  image_url?: string
  description?: string
  unit: string
  cost_price?: number  // 원가 (optional)
}

// 배치코드 관련 타입
export interface BatchInfo {
  batch_code: string
  production_date: string
  expiry_date: string
  days_until_expiry: number
}

// 유통기한 상태
export type ExpiryStatus = '만료' | '30일 이내 만료' | '90일 이내 만료' | '정상'

// 확장된 재고 정보 (유통기한 상태 포함)
export interface InventoryWithExpiryStatus extends Inventory {
  category_id: string
  unit: string
  location_code: string
  expiry_status: ExpiryStatus
  days_until_expiry: number
}

// 만료 임박 알림용 재고 정보
export interface ExpiringInventoryAlert {
  product_id: string
  location_id: string
  batch_code: string
  current_stock: number
  production_date: string
  expiry_date: string
  days_until_expiry: number
}