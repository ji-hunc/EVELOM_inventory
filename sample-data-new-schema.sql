-- 새로운 스키마로 샘플 데이터 생성
-- 기존 데이터를 모두 삭제하고 새로운 구조로 재생성

-- 기존 데이터 삭제 (외래키 순서 고려)
DELETE FROM inventory_movements;
DELETE FROM inventory;
DELETE FROM products;
DELETE FROM users;
DELETE FROM categories;
DELETE FROM locations;

-- 1. Categories (name이 PK)
INSERT INTO categories (name, code, description, is_active, created_at, updated_at) VALUES
('정제품', 'FG', '완제품 (Finished Goods)', true, NOW(), NOW()),
('샘플', 'SA', '샘플 제품', true, NOW(), NOW()),
('테스터', 'TE', '테스터 제품', true, NOW(), NOW()),
('사셰', 'SC', '사셰 형태 제품', true, NOW(), NOW());

-- 2. Locations (name이 PK)
INSERT INTO locations (name, code, description, is_active, created_at, updated_at) VALUES
('창고', 'WH', '메인 창고', true, NOW(), NOW()),
('청량리', 'CL', '청량리 지점', true, NOW(), NOW()),
('AK', 'AK', 'AK 지점', true, NOW(), NOW());

-- 3. Products (name이 PK, category_id는 categories.name 참조)
INSERT INTO products (name, code, category_id, image_url, description, unit, is_active, created_at, updated_at) VALUES
('클렌징밤 450ml', NULL, '정제품', '/uploads/1755605976012-wsyx92.jpg', '클렌징밤', '개', true, NOW(), NOW()),
('클렌징밤 100ml', NULL, '정제품', 'https://yibcmmqynagubfpcvdkv.supabase.co/storage/v1/object/public/product-images/products/1755607020737-sjjjdh.jpeg', NULL, '개', true, NOW(), NOW()),
('모이스처크림 8ml', NULL, '샘플', 'https://yibcmmqynagubfpcvdkv.supabase.co/storage/v1/object/public/product-images/products/1755607129565-ogdum.jpg', NULL, '개', true, NOW(), NOW());

-- 4. Users (username이 PK, assigned_location_id는 locations.name 참조)
INSERT INTO users (username, password_hash, role, assigned_location_id, alert_threshold, created_at, updated_at) VALUES
('master_admin', 'hashed_password_here', 'master', NULL, 30, NOW(), NOW()),
('청량리_evelom', 'hashed_password_here', 'general', '청량리', 30, NOW(), NOW()),
('AK_evelom', 'hashed_password_here', 'general', 'AK', 30, NOW(), NOW()),
('창고_evelom', 'hashed_password_here', 'general', '창고', 30, NOW(), NOW());

-- 5. Inventory (product_id는 products.name, location_id는 locations.name 참조)
INSERT INTO inventory (id, product_id, location_id, current_stock, last_updated, last_modified_by) VALUES
('c88c27e7-ca88-4bf7-a1aa-f124c8737af8', '클렌징밤 100ml', 'AK', 0, NOW(), 'master_admin'),
('e1b3fecd-94bc-4018-8ea7-1afe98f5caaf', '모이스처크림 8ml', '청량리', 10, NOW(), 'master_admin'),
('f362f639-38a1-488c-b390-d3bab69d59d2', '모이스처크림 8ml', 'AK', 20, NOW(), 'master_admin'),
('1b03f1c4-2fa8-45d4-8230-21fef8f68df8', '클렌징밤 100ml', '청량리', 40, NOW(), 'master_admin'),
('71f7ba01-e51c-432a-bd9b-dd31ad1939f5', '클렌징밤 450ml', '창고', 55, NOW(), 'master_admin'),
('7040d357-f033-4a59-9c72-72eadc4a17fe', '클렌징밤 100ml', '창고', 104, NOW(), 'master_admin'),
('838f47cb-645f-4e15-9f1e-bfbe0bf71116', '모이스처크림 8ml', '창고', 115, NOW(), 'master_admin');