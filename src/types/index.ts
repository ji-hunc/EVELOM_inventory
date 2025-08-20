export interface User {
  id: string
  username: string
  role: 'master' | 'general'
  location?: string
  alert_threshold: number
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  code?: string
  category_id: string
  category?: Category
  image_url?: string
  description?: string
  unit: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

export interface Inventory {
  id: string
  product_id: string
  product?: Product
  location_id: string
  location?: Location
  current_stock: number
  last_updated: string
  updated_by?: string
}

export interface InventoryMovement {
  id: string
  product_id: string
  product?: Product
  location_id: string
  location?: Location
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  previous_stock: number
  new_stock: number
  movement_date: string
  notes?: string
  created_at: string
  created_by?: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
}

export interface InventoryFormData {
  product_id: string
  location_id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  movement_date: string
  notes?: string
}

export interface ProductFormData {
  name: string
  code?: string
  category_id: string
  image_url?: string
  description?: string
  unit: string
}