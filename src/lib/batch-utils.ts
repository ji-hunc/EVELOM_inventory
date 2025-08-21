// 배치코드 관련 유틸리티 함수들

// 배치코드에서 생산일자를 계산하는 함수
export function parseBatchCodeToDate(batchCode: string): Date {
  // 배치코드 유효성 검사
  if (!batchCode || batchCode.length < 4) {
    throw new Error(`잘못된 배치코드 형식: ${batchCode}`);
  }

  const firstFourDigits = batchCode.substring(0, 4);
  if (!/^\d{4}$/.test(firstFourDigits)) {
    throw new Error(`배치코드 첫 4자리는 숫자여야 합니다: ${batchCode}`);
  }

  // 첫 번째 자리: 연도의 마지막 자리 (4 = 2024)
  const yearDigit = parseInt(batchCode.charAt(0));
  
  // 2-4번째 자리: 해당 연도의 일자 (001-366)
  const dayOfYear = parseInt(batchCode.substring(1, 4));
  
  // 기준 연도 (현재는 2020년대)
  const baseYear = 2020;
  const productionYear = baseYear + yearDigit;
  
  // 일자 범위 확인
  if (dayOfYear < 1 || dayOfYear > 366) {
    throw new Error(`잘못된 일자: ${dayOfYear}`);
  }
  
  // 생산일자 계산
  const productionDate = new Date(productionYear, 0, 1); // 해당 년도 1월 1일
  productionDate.setDate(dayOfYear); // 해당 년도의 n번째 날
  
  return productionDate;
}

// 생산일자에서 유통기한을 계산하는 함수 (3년 후)
export function calculateExpiryDate(productionDate: Date): Date {
  const expiryDate = new Date(productionDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 3);
  return expiryDate;
}

// 배치코드 유효성 검사
export function validateBatchCode(batchCode: string): boolean {
  if (!batchCode || batchCode.length < 4) {
    return false;
  }

  const firstFourDigits = batchCode.substring(0, 4);
  if (!/^\d{4}$/.test(firstFourDigits)) {
    return false;
  }

  try {
    parseBatchCodeToDate(batchCode);
    return true;
  } catch {
    return false;
  }
}

// 유통기한 상태 계산
export function getExpiryStatus(expiryDate: Date): '만료' | '30일 이내 만료' | '90일 이내 만료' | '정상' {
  const today = new Date();
  const timeDiff = expiryDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (daysDiff < 0) {
    return '만료';
  } else if (daysDiff <= 30) {
    return '30일 이내 만료';
  } else if (daysDiff <= 90) {
    return '90일 이내 만료';
  } else {
    return '정상';
  }
}

// 유통기한까지 남은 일수 계산
export function getDaysUntilExpiry(expiryDate: Date): number {
  const today = new Date();
  const timeDiff = expiryDate.getTime() - today.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

// 배치코드에서 연도 추출
export function getYearFromBatchCode(batchCode: string): number {
  if (!validateBatchCode(batchCode)) {
    throw new Error(`잘못된 배치코드: ${batchCode}`);
  }
  
  const yearDigit = parseInt(batchCode.charAt(0));
  return 2020 + yearDigit;
}

// 배치코드에서 일자 추출
export function getDayOfYearFromBatchCode(batchCode: string): number {
  if (!validateBatchCode(batchCode)) {
    throw new Error(`잘못된 배치코드: ${batchCode}`);
  }
  
  return parseInt(batchCode.substring(1, 4));
}

// 날짜에서 배치코드 생성 (역변환)
export function generateBatchCodeFromDate(productionDate: Date, suffix?: string): string {
  const year = productionDate.getFullYear();
  const yearDigit = year % 10; // 연도의 마지막 자리
  
  // 해당 년도의 몇 번째 날인지 계산
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((productionDate.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24)) + 1;
  
  // 3자리로 패딩
  const dayOfYearString = dayOfYear.toString().padStart(3, '0');
  
  const batchCode = `${yearDigit}${dayOfYearString}`;
  
  return suffix ? `${batchCode}${suffix}` : batchCode;
}

// 배치코드 형식 설명 텍스트
export const BATCH_CODE_FORMAT_DESCRIPTION = `
배치코드 형식:
- 4자리 숫자 + 선택적 알파벳 (예: 4030, 4030A)
- 첫 번째 자리: 생산 연도의 마지막 자리 (4 = 2024년)
- 2-4번째 자리: 해당 연도의 일자 (001-366)
- 예시: 4030 = 2024년 1월 30일 생산
- 유통기한: 생산일로부터 3년
`;

// 유통기한 상태별 색상 클래스
export const EXPIRY_STATUS_COLORS = {
  '만료': 'text-red-600 bg-red-50',
  '30일 이내 만료': 'text-orange-600 bg-orange-50',
  '90일 이내 만료': 'text-yellow-600 bg-yellow-50',
  '정상': 'text-green-600 bg-green-50'
} as const;