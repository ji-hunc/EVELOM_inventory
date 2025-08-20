import * as XLSX from 'xlsx'
import { Inventory, InventoryMovement, Product, Location, Category } from '@/types'

export interface ExcelExportData {
  inventory?: Inventory[]
  movements?: InventoryMovement[]
  products?: Product[]
  locations?: Location[]
  categories?: Category[]
}

export function exportToExcel(data: ExcelExportData, filename: string = 'evelom_inventory') {
  const workbook = XLSX.utils.book_new()

  // 재고 현황 시트
  if (data.inventory && data.inventory.length > 0) {
    const inventoryData = data.inventory.map(item => ({
      '제품명': item.product?.name || '',
      '제품코드': item.product?.code || '',
      '카테고리': item.product?.category?.name || '',
      '위치': item.location?.name || '',
      '현재고': item.current_stock,
      '단위': item.product?.unit || '개',
      '최종수정일': new Date(item.last_updated).toLocaleDateString('ko-KR'),
      '이미지URL': item.product?.image_url || '',
      '설명': item.product?.description || ''
    }))
    
    const inventorySheet = XLSX.utils.json_to_sheet(inventoryData)
    
    // 컬럼 너비 설정
    const inventoryColWidths = [
      { wch: 20 }, // 제품명
      { wch: 15 }, // 제품코드
      { wch: 12 }, // 카테고리
      { wch: 10 }, // 위치
      { wch: 10 }, // 현재고
      { wch: 8 },  // 단위
      { wch: 12 }, // 최종수정일
      { wch: 30 }, // 이미지URL
      { wch: 25 }  // 설명
    ]
    inventorySheet['!cols'] = inventoryColWidths
    
    XLSX.utils.book_append_sheet(workbook, inventorySheet, '재고현황')
  }

  // 입출고 내역 시트
  if (data.movements && data.movements.length > 0) {
    const movementsData = data.movements.map(item => ({
      '이동일자': new Date(item.movement_date).toLocaleDateString('ko-KR'),
      '이동타입': getMovementTypeName(item.movement_type),
      '제품명': item.product?.name || '',
      '위치': item.location?.name || '',
      '이동수량': item.movement_type === 'in' ? item.quantity : item.movement_type === 'out' ? -item.quantity : item.quantity,
      '이전재고': item.previous_stock,
      '이후재고': item.new_stock,
      '메모': item.notes || '',
      '등록일시': new Date(item.created_at).toLocaleString('ko-KR')
    }))
    
    const movementsSheet = XLSX.utils.json_to_sheet(movementsData)
    
    const movementsColWidths = [
      { wch: 12 }, // 이동일자
      { wch: 10 }, // 이동타입
      { wch: 20 }, // 제품명
      { wch: 10 }, // 위치
      { wch: 10 }, // 이동수량
      { wch: 10 }, // 이전재고
      { wch: 10 }, // 이후재고
      { wch: 25 }, // 메모
      { wch: 16 }  // 등록일시
    ]
    movementsSheet['!cols'] = movementsColWidths
    
    XLSX.utils.book_append_sheet(workbook, movementsSheet, '입출고내역')
  }

  // 제품 목록 시트
  if (data.products && data.products.length > 0) {
    const productsData = data.products.map(item => ({
      '제품명': item.name,
      '제품코드': item.code || '',
      '카테고리': item.category?.name || '',
      '단위': item.unit,
      '이미지URL': item.image_url || '',
      '설명': item.description || '',
      '활성상태': item.is_active ? '활성' : '비활성',
      '등록일': new Date(item.created_at).toLocaleDateString('ko-KR')
    }))
    
    const productsSheet = XLSX.utils.json_to_sheet(productsData)
    
    const productsColWidths = [
      { wch: 20 }, // 제품명
      { wch: 15 }, // 제품코드
      { wch: 12 }, // 카테고리
      { wch: 8 },  // 단위
      { wch: 30 }, // 이미지URL
      { wch: 25 }, // 설명
      { wch: 10 }, // 활성상태
      { wch: 12 }  // 등록일
    ]
    productsSheet['!cols'] = productsColWidths
    
    XLSX.utils.book_append_sheet(workbook, productsSheet, '제품목록')
  }

  // 위치 목록 시트
  if (data.locations && data.locations.length > 0) {
    const locationsData = data.locations.map(item => ({
      '위치명': item.name,
      '위치코드': item.code,
      '설명': item.description || '',
      '활성상태': item.is_active ? '활성' : '비활성',
      '등록일': new Date(item.created_at).toLocaleDateString('ko-KR')
    }))
    
    const locationsSheet = XLSX.utils.json_to_sheet(locationsData)
    const locationsColWidths = [
      { wch: 15 }, // 위치명
      { wch: 10 }, // 위치코드
      { wch: 25 }, // 설명
      { wch: 10 }, // 활성상태
      { wch: 12 }  // 등록일
    ]
    locationsSheet['!cols'] = locationsColWidths
    
    XLSX.utils.book_append_sheet(workbook, locationsSheet, '위치목록')
  }

  // 카테고리 목록 시트
  if (data.categories && data.categories.length > 0) {
    const categoriesData = data.categories.map(item => ({
      '카테고리명': item.name,
      '카테고리코드': item.code,
      '설명': item.description || '',
      '활성상태': item.is_active ? '활성' : '비활성',
      '등록일': new Date(item.created_at).toLocaleDateString('ko-KR')
    }))
    
    const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData)
    const categoriesColWidths = [
      { wch: 15 }, // 카테고리명
      { wch: 12 }, // 카테고리코드
      { wch: 25 }, // 설명
      { wch: 10 }, // 활성상태
      { wch: 12 }  // 등록일
    ]
    categoriesSheet['!cols'] = categoriesColWidths
    
    XLSX.utils.book_append_sheet(workbook, categoriesSheet, '카테고리목록')
  }

  // 파일 다운로드
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const fullFilename = `${filename}_${timestamp}.xlsx`
  
  XLSX.writeFile(workbook, fullFilename)
}

export function exportInventoryToExcel(
  inventory: Inventory[],
  locationName: string = '전체',
  filename?: string
) {
  const data: ExcelExportData = { inventory }
  const defaultFilename = `evelom_재고현황_${locationName}`
  
  exportToExcel(data, filename || defaultFilename)
}

export function exportMovementsToExcel(
  movements: InventoryMovement[],
  dateRange?: string,
  filename?: string
) {
  const data: ExcelExportData = { movements }
  const defaultFilename = dateRange 
    ? `evelom_입출고내역_${dateRange}`
    : 'evelom_입출고내역'
  
  exportToExcel(data, filename || defaultFilename)
}

export function exportAllDataToExcel(
  inventory: Inventory[],
  movements: InventoryMovement[],
  products: Product[],
  locations: Location[],
  categories: Category[],
  filename?: string
) {
  const data: ExcelExportData = {
    inventory,
    movements,
    products,
    locations,
    categories
  }
  
  exportToExcel(data, filename || 'evelom_전체데이터')
}

function getMovementTypeName(type: string): string {
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