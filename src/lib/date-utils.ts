// 한국 시간 관련 유틸리티

/**
 * 현재 한국 시간을 ISO 문자열로 반환
 */
export function getKoreanTime(): string {
  const now = new Date()
  const koreanTime = new Date(now.toLocaleString('en-US', {
    timeZone: 'Asia/Seoul'
  }))
  return koreanTime.toISOString()
}

/**
 * 한국 시간대로 변환된 날짜 문자열을 반환 (YYYY-MM-DD 형태)
 */
export function getKoreanDateString(): string {
  const now = new Date()
  const koreanTime = new Date(now.toLocaleString('en-US', {
    timeZone: 'Asia/Seoul'
  }))
  const year = koreanTime.getFullYear()
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0')
  const day = String(koreanTime.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 한국 시간대로 날짜를 포맷팅
 */
export function formatKoreanDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul'
  })
}

/**
 * 한국 시간대로 날짜와 시간을 포맷팅
 */
export function formatKoreanDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul'
  })
}