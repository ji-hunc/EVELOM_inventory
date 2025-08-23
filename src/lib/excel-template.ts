import * as XLSX from 'xlsx'

export interface ExcelProductData {
  제품명: string
  카테고리: string
  제품코드?: string
  단위?: string
  설명?: string
}

export function downloadExcelTemplate() {
  // 예시 데이터
  const templateData: ExcelProductData[] = [
    {
      제품명: '클렌징 밤 100g',
      카테고리: '정제품',
      제품코드: 'CB100',
      단위: 'EA',
      설명: '메이크업 제거용 클렌징 밤'
    },
    {
      제품명: '토너 30ml',
      카테고리: '샘플',
      제품코드: 'T30',
      단위: 'EA',
      설명: '수분 공급 토너 샘플'
    },
    {
      제품명: '립밤 4g',
      카테고리: '사셰',
      제품코드: '',
      단위: 'EA',
      설명: ''
    }
  ]

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(templateData)
  const workbook = XLSX.utils.book_new()

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { width: 20 }, // 제품명
    { width: 15 }, // 카테고리
    { width: 15 }, // 제품코드
    { width: 10 }, // 단위
    { width: 30 }  // 설명
  ]

  XLSX.utils.book_append_sheet(workbook, worksheet, '제품목록')

  // 파일 다운로드
  XLSX.writeFile(workbook, '제품등록_템플릿.xlsx')
}

export interface ExcelStockData {
  카테고리: string
  제품명: string
  위치: string
  배치코드: string
  수량: number
}

export function downloadStockInputTemplate() {
  // 재고입력 템플릿 데이터
  const templateData: ExcelStockData[] = [
    {
      카테고리: '정제품',
      제품명: '클렌징 밤 100g',
      위치: '창고',
      배치코드: '2412A001',
      수량: 50
    },
    {
      카테고리: '샘플',
      제품명: '토너 30ml',
      위치: '창고',
      배치코드: '2412B001',
      수량: 100
    },
    {
      카테고리: '사셰',
      제품명: '립밤 4g',
      위치: '창고',
      배치코드: '2412C001',
      수량: 25
    }
  ]

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(templateData)
  const workbook = XLSX.utils.book_new()

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { width: 15 }, // 카테고리
    { width: 20 }, // 제품명
    { width: 15 }, // 위치
    { width: 15 }, // 배치코드
    { width: 10 }  // 수량
  ]

  XLSX.utils.book_append_sheet(workbook, worksheet, '재고입력')

  // 파일 다운로드
  XLSX.writeFile(workbook, '재고입력_템플릿.xlsx')
}

export function parseStockExcelFile(file: File): Promise<ExcelStockData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('파일 데이터를 읽을 수 없습니다.'))
          return
        }

        const workbook = XLSX.read(data, { type: 'binary' })
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('엑셀 파일에 시트가 없습니다.'))
          return
        }

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        if (!worksheet) {
          reject(new Error('첫 번째 시트를 읽을 수 없습니다.'))
          return
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelStockData[]
        
        console.log('파싱된 엑셀 데이터:', jsonData) // 디버깅용
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('엑셀 파일에 데이터가 없습니다.'))
          return
        }

        // 필수 컬럼 확인
        const firstRow = jsonData[0]
        const requiredColumns = ['카테고리', '제품명', '위치', '배치코드', '수량']
        const missingColumns = requiredColumns.filter(col => !(col in firstRow))
        
        if (missingColumns.length > 0) {
          reject(new Error(`필수 컬럼이 없습니다: ${missingColumns.join(', ')}`))
          return
        }

        // 데이터 유효성 검사 및 타입 변환
        const validData = jsonData.filter(row => {
          return row.카테고리 && String(row.카테고리).trim() !== '' &&
                 row.제품명 && String(row.제품명).trim() !== '' && 
                 row.위치 && String(row.위치).trim() !== '' &&
                 row.배치코드 && String(row.배치코드).trim() !== '' &&
                 row.수량 !== undefined && row.수량 !== null && !isNaN(Number(row.수량)) && Number(row.수량) >= 0
        }).map(row => ({
          카테고리: String(row.카테고리).trim(),
          제품명: String(row.제품명).trim(),
          위치: String(row.위치).trim(),
          배치코드: String(row.배치코드).trim(),
          수량: Number(row.수량)
        }))

        if (validData.length === 0) {
          reject(new Error('유효한 데이터가 없습니다. 필수 항목(카테고리, 제품명, 위치, 배치코드, 수량)을 확인해주세요.'))
          return
        }

        console.log('유효한 데이터:', validData) // 디버깅용

        resolve(validData)
      } catch (error) {
        console.error('파싱 오류 상세:', error) // 디버깅용
        reject(new Error(`엑셀 파일 파싱 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'))
    }

    reader.readAsBinaryString(file)
  })
}

export function parseExcelFile(file: File): Promise<ExcelProductData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelProductData[]
        
        // 데이터 유효성 검사
        const validData = jsonData.filter(row => {
          return row.제품명 && row.제품명.trim() !== '' && 
                 row.카테고리 && row.카테고리.trim() !== ''
        })

        resolve(validData)
      } catch (error) {
        reject(new Error('엑셀 파일 파싱 중 오류가 발생했습니다.'))
      }
    }

    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'))
    }

    reader.readAsBinaryString(file)
  })
}