# EVELOM 재고관리 시스템

EVELOM 화장품 재고관리를 위한 웹 애플리케이션입니다.

## 주요 기능

### 🏬 다중 위치 관리

- 창고, 청량리, AK 등 여러 위치 지원
- 위치별 탭으로 쉬운 전환
- 확장 가능한 위치 추가

### 📊 재고 관리

- 실시간 재고 현황 조회
- 촘촘한 스프레드시트 스타일 테이블
- 제품별 이미지 표시/숨김 기능
- 카테고리별 분류 (정제품, 샘플, 사셰, 테스터)

### 📈 입출고 관리

- 입고, 출고, 재고 조정 기능
- 날짜별 이동 내역 기록
- 상세한 검색 및 필터링
- 메모 기능으로 추가 정보 관리

### 📅 월간 현황

- 월별 입출고 현황 달력 뷰
- 일별 상세 이동 내역
- 색상 코딩 (입고: 파란색, 출고: 빨간색)

### 📊 통계 대시보드

- 실시간 재고 통계
- 위치별/카테고리별 분포 차트
- 입출고 트렌드 분석
- 재고 부족 알림

### 🚨 알림 시스템

- 사용자별 재고 부족 임계치 설정
- 재고 부족 품목 시각적 표시
- 설정 가능한 알림 기준

### 👥 권한 관리

- 마스터 계정: 모든 권한
- 일반 계정: 수정만 가능 (추가/삭제 불가)
- 위치별 사용자 관리

### 📁 데이터 내보내기

- 엑셀 형식 다운로드
- 재고 현황, 입출고 내역 등 다양한 형태
- 날짜 범위별 필터링 지원

## 기술 스택

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: 커스텀 인증 시스템
- **Charts**: Recharts
- **Excel Export**: xlsx
- **Icons**: Lucide React

## 설치 방법

### 1. 프로젝트 클론

```bash
git clone <repository-url>
cd evelom-inventory
```

### 2. 의존성 설치

```bash
npm install
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 데이터베이스 비밀번호 설정
3. Project Settings > API에서 URL과 키 복사

### 4. 환경 변수 설정

`.env.local` 파일에 다음 값들을 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 5. 데이터베이스 스키마 생성

Supabase 대시보드의 SQL 편집기에서 `supabase-schema.sql` 파일의 내용을 실행하세요.

### 6. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000에서 애플리케이션에 접속할 수 있습니다.

## 기본 계정

시스템에는 다음 계정들이 미리 설정되어 있습니다:

| 계정           | 비밀번호   | 권한   | 담당 위치 |
| -------------- | ---------- | ------ | --------- |
| master         | evelom2024 | 마스터 | 전체      |
| 창고\_evelom   | evelom2024 | 일반   | 창고      |
| 청량리\_evelom | evelom2024 | 일반   | 청량리    |
| AK_evelom      | evelom2024 | 일반   | AK        |

## 사용법

### 1. 로그인

- 브라우저에서 http://localhost:3000 접속
- 위 계정 중 하나로 로그인

### 2. 재고 관리

- 대시보드에서 위치별 탭 선택
- "재고 이동" 버튼으로 입출고 등록
- 이미지 보기/숨기기로 표시 방식 조절

### 3. 검색 및 필터링

- "입출고내역" 탭에서 상세 검색
- 날짜 범위, 제품, 카테고리별 필터링
- 엑셀 다운로드로 데이터 백업

### 4. 통계 확인

- 상단 네비게이션의 "통계" 클릭
- 다양한 차트로 현황 분석
- 기간별 필터링 지원

### 5. 설정 관리

- 상단 "설정" 버튼 클릭
- 재고 부족 알림 임계치 조정

## 배포

### Vercel 배포

```bash
npm run build
vercel --prod
```

### 기타 플랫폼

```bash
npm run build
npm start
```

## 프로젝트 구조

```
src/
├── app/                    # Next.js 앱 라우터
│   ├── dashboard/         # 메인 대시보드
│   ├── stats/            # 통계 페이지
│   └── api/              # API 엔드포인트
├── components/            # React 컴포넌트
├── contexts/             # React 컨텍스트
├── lib/                  # 유틸리티 함수
├── types/               # TypeScript 타입 정의
└── styles/              # 스타일 파일
```

## 데이터베이스 스키마

주요 테이블:

- `users`: 사용자 계정 관리
- `locations`: 재고 위치 관리
- `categories`: 제품 카테고리
- `products`: 제품 정보
- `inventory`: 현재 재고 현황
- `inventory_movements`: 입출고 이동 내역

## 라이센스

이 프로젝트는 EVELOM 전용으로 개발되었습니다.

## 지원

문제가 있거나 기능 요청이 있으시면 개발팀에 연락해주세요.

---

🚀 **EVELOM 재고관리 시스템** - 효율적이고 직관적인 재고 관리를 위해
