# 데이터베이스 스키마 변경 가이드

## 개요
UUID 기반 Primary Key를 의미있는 name/username 기반 Primary Key로 변경합니다.

## 변경 사항

### Before (UUID PK)
```sql
-- 기존 구조
categories.id (UUID) -> categories.name (VARCHAR)
locations.id (UUID) -> locations.name (VARCHAR)  
products.id (UUID) -> products.name (VARCHAR)
users.id (UUID) -> users.username (VARCHAR)
```

### After (Name PK)
```sql
-- 새로운 구조
categories.name (VARCHAR) PRIMARY KEY
locations.name (VARCHAR) PRIMARY KEY
products.name (VARCHAR) PRIMARY KEY
users.username (VARCHAR) PRIMARY KEY
```

## 마이그레이션 절차

### 1. 기존 데이터 백업
```sql
-- Supabase SQL Editor에서 실행
CREATE TABLE backup_categories AS SELECT * FROM categories;
CREATE TABLE backup_locations AS SELECT * FROM locations;
CREATE TABLE backup_products AS SELECT * FROM products;
CREATE TABLE backup_users AS SELECT * FROM users;
CREATE TABLE backup_inventory AS SELECT * FROM inventory;
CREATE TABLE backup_inventory_movements AS SELECT * FROM inventory_movements;
```

### 2. 마이그레이션 스크립트 실행
Supabase SQL Editor에서 `database-migration.sql` 파일의 내용을 실행합니다.

### 3. 새로운 샘플 데이터 입력
`sample-data-new-schema.sql` 파일의 내용을 실행하여 새로운 스키마에 맞는 샘플 데이터를 입력합니다.

## 코드 변경 사항

### TypeScript 타입 수정
- `src/types/index.ts`: 모든 인터페이스에서 `id` → `name/username` 변경
- FK 참조도 UUID → name/username으로 변경

### API 수정
- `src/app/api/inventory/bulk-update/route.ts`: `userId` → `username`
- `src/app/api/inventory/transfer/route.ts`: `user_id` → `username`
- `src/lib/auth.ts`: `assigned_location_id` 필드 업데이트

### 컴포넌트 수정
- `src/components/InventoryTable.tsx`: `user.id` → `user.username`
- `src/components/InventoryModal.tsx`: `user.id` → `user.username`
- `src/components/LocationTabs.tsx`: `location.id` → `location.name`
- `src/app/dashboard/page.tsx`: 모든 ID 참조를 name 참조로 변경

## 새로운 스키마의 장점

1. **가독성**: UUID 대신 의미있는 이름으로 관계를 파악하기 쉬움
2. **디버깅**: 로그와 쿼리에서 직관적인 식별 가능
3. **성능**: VARCHAR 기반 조인이 UUID보다 효율적일 수 있음
4. **사용자 친화적**: URL이나 API에서 사용자가 이해할 수 있는 식별자

## 주의사항

1. **Name 중복 방지**: 각 테이블에서 name/username이 유니크해야 함
2. **외래키 일관성**: 모든 FK 참조가 올바른 name을 가리키는지 확인
3. **대소문자 민감성**: PostgreSQL은 기본적으로 대소문자를 구분하므로 주의
4. **문자 길이 제한**: VARCHAR 필드의 적절한 길이 설정 필요

## 테스트 방법

1. 마이그레이션 후 애플리케이션 실행
2. 다음 기능들이 정상 작동하는지 확인:
   - 로그인 (username 기반)
   - 재고 조회 (location name 기반 필터링)
   - 재고 수정 (product name 참조)
   - 일괄 수정 (username 추적)
   - 재고 이동 (location name 간 이동)

## 롤백 방법

문제 발생 시 백업 테이블을 사용하여 원래 구조로 롤백:

```sql
-- 백업에서 복구
DROP TABLE IF EXISTS categories, locations, products, users, inventory, inventory_movements;
ALTER TABLE backup_categories RENAME TO categories;
ALTER TABLE backup_locations RENAME TO locations;
ALTER TABLE backup_products RENAME TO products;
ALTER TABLE backup_users RENAME TO users;
ALTER TABLE backup_inventory RENAME TO inventory;
ALTER TABLE backup_inventory_movements RENAME TO inventory_movements;
```