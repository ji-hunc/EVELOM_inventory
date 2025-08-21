-- 전체 데이터베이스 재생성 (배치코드 포함)
-- 기존 테이블 완전 삭제 후 새로운 구조로 재생성

-- =====================================================
-- 1. 기존 테이블 완전 삭제 (의존성 순서대로)
-- =====================================================
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- =====================================================
-- 2. 새로운 테이블 생성 (배치코드 포함)
-- =====================================================

-- Categories 테이블 (name이 PK)
CREATE TABLE categories (
    name VARCHAR(100) PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations 테이블 (name이 PK)
CREATE TABLE locations (
    name VARCHAR(100) PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products 테이블 (name이 PK)
CREATE TABLE products (
    name VARCHAR(200) PRIMARY KEY,
    code VARCHAR(50),
    category_id VARCHAR(100) NOT NULL,
    image_url TEXT,
    description TEXT,
    unit VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    FOREIGN KEY (category_id) REFERENCES categories(name)
);

-- Users 테이블 (username이 PK)
CREATE TABLE users (
    username VARCHAR(100) PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('master', 'general')),
    assigned_location_id VARCHAR(100),
    alert_threshold INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (assigned_location_id) REFERENCES locations(name)
);

-- Inventory 테이블 (배치코드 포함, 복합키: product_id + location_id + batch_code)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(200) NOT NULL,
    location_id VARCHAR(100) NOT NULL,
    batch_code VARCHAR(10) NOT NULL, -- 배치코드 (예: 4030, 4030A)
    current_stock INTEGER NOT NULL DEFAULT 0,
    production_date DATE NOT NULL, -- 생산일자 (배치코드로부터 계산)
    expiry_date DATE NOT NULL, -- 유통기한 (생산일 + 3년)
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified_by VARCHAR(100),
    FOREIGN KEY (product_id) REFERENCES products(name),
    FOREIGN KEY (location_id) REFERENCES locations(name),
    FOREIGN KEY (last_modified_by) REFERENCES users(username),
    UNIQUE(product_id, location_id, batch_code) -- 복합 유니크 키
);

-- Inventory Movements 테이블 (배치코드 포함)
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(200) NOT NULL,
    location_id VARCHAR(100) NOT NULL,
    batch_code VARCHAR(10) NOT NULL, -- 배치코드
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    movement_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_by VARCHAR(100),
    transfer_group_id UUID, -- 이동 그룹핑용
    from_location_id VARCHAR(100), -- 이동 시 출발지
    to_location_id VARCHAR(100), -- 이동 시 목적지
    FOREIGN KEY (product_id) REFERENCES products(name),
    FOREIGN KEY (location_id) REFERENCES locations(name),
    FOREIGN KEY (modified_by) REFERENCES users(username),
    FOREIGN KEY (from_location_id) REFERENCES locations(name),
    FOREIGN KEY (to_location_id) REFERENCES locations(name)
);

-- =====================================================
-- 3. 배치코드 처리 함수 생성
-- =====================================================

-- 배치코드에서 생산일자를 계산하는 함수
CREATE OR REPLACE FUNCTION parse_batch_code_to_date(batch_code VARCHAR)
RETURNS DATE AS $$
DECLARE
    year_digit INTEGER;
    day_of_year INTEGER;
    base_year INTEGER;
    production_year INTEGER;
BEGIN
    -- 배치코드 길이 확인 (최소 4자리)
    IF LENGTH(batch_code) < 4 OR NOT (SUBSTRING(batch_code, 1, 4) ~ '^[0-9]{4}$') THEN
        RAISE EXCEPTION '잘못된 배치코드 형식: %', batch_code;
    END IF;
    
    -- 첫 번째 자리: 연도의 마지막 자리 (4 = 2024)
    year_digit := SUBSTRING(batch_code, 1, 1)::INTEGER;
    
    -- 2-4번째 자리: 해당 연도의 일자 (001-366)
    day_of_year := SUBSTRING(batch_code, 2, 3)::INTEGER;
    
    -- 기준 연도 (현재는 2020년대)
    base_year := 2020;
    production_year := base_year + year_digit;
    
    -- 일자 범위 확인
    IF day_of_year < 1 OR day_of_year > 366 THEN
        RAISE EXCEPTION '잘못된 일자: %', day_of_year;
    END IF;
    
    -- 생산일자 계산 (연도 + 일자)
    RETURN (production_year || '-01-01')::DATE + (day_of_year - 1);
END;
$$ LANGUAGE plpgsql;

-- 생산일자에서 유통기한을 계산하는 함수 (3년 후)
CREATE OR REPLACE FUNCTION calculate_expiry_date(production_date DATE)
RETURNS DATE AS $$
BEGIN
    RETURN production_date + INTERVAL '3 years';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. 트리거 생성 (자동 날짜 계산)
-- =====================================================

-- inventory 테이블에 데이터 삽입/수정 시 자동으로 날짜 계산
CREATE OR REPLACE FUNCTION update_inventory_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- 배치코드로부터 생산일자 계산
    NEW.production_date := parse_batch_code_to_date(NEW.batch_code);
    
    -- 유통기한 계산 (생산일 + 3년)
    NEW.expiry_date := calculate_expiry_date(NEW.production_date);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_dates
    BEFORE INSERT OR UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_dates();

-- =====================================================
-- 5. 인덱스 생성 (성능 최적화)
-- =====================================================

-- 검색 성능을 위한 인덱스
CREATE INDEX idx_inventory_product_location ON inventory(product_id, location_id);
CREATE INDEX idx_inventory_batch_code ON inventory(batch_code);
CREATE INDEX idx_inventory_expiry_date ON inventory(expiry_date);
CREATE INDEX idx_inventory_production_date ON inventory(production_date);
CREATE INDEX idx_inventory_location_expiry ON inventory(location_id, expiry_date);

CREATE INDEX idx_movements_product_location ON inventory_movements(product_id, location_id);
CREATE INDEX idx_movements_batch_code ON inventory_movements(batch_code);
CREATE INDEX idx_movements_date ON inventory_movements(movement_date);
CREATE INDEX idx_movements_transfer_group ON inventory_movements(transfer_group_id);

-- =====================================================
-- 6. 샘플 데이터 입력
-- =====================================================

-- Categories
INSERT INTO categories (name, code, description, is_active) VALUES
('정제품', 'FG', '완제품 (Finished Goods)', true),
('샘플', 'SA', '샘플 제품', true),
('테스터', 'TE', '테스터 제품', true),
('사셰', 'SC', '사셰 형태 제품', true);

-- Locations
INSERT INTO locations (name, code, description, is_active) VALUES
('창고', 'WH', '메인 창고', true),
('청량리', 'CL', '청량리 지점', true),
('AK', 'AK', 'AK 지점', true);

-- Products
INSERT INTO products (name, code, category_id, image_url, description, unit, is_active) VALUES
('클렌징밤 450ml', 'CB450', '정제품', '/uploads/cleansing-balm-450.jpg', '대용량 클렌징밤', '개', true),
('클렌징밤 100ml', 'CB100', '정제품', '/uploads/cleansing-balm-100.jpg', '휴대용 클렌징밤', '개', true),
('모이스처크림 8ml', 'MC8', '샘플', '/uploads/moisture-cream-8.jpg', '샘플용 모이스처크림', '개', true),
('립밤 4g', 'LB4', '정제품', '/uploads/lip-balm-4.jpg', '보습 립밤', '개', true),
('토너 30ml', 'TN30', '샘플', '/uploads/toner-30.jpg', '샘플용 토너', '개', true);

-- Users (해시된 비밀번호 사용)
INSERT INTO users (username, password_hash, role, assigned_location_id, alert_threshold) VALUES
('master_admin', '9fae4e1142bc035f4e373f9f42dc20ab4c8aa5108a3e22347af9bade4a3c244a', 'master', NULL, 30),
('청량리_evelom', 'a9902ea121923e331e40123e01853b88ee3c101d5e92b547dcb8645b295496af', 'general', '청량리', 30),
('AK_evelom', '75489cb6361ef45becbabbbf9fb1cf4a228eff3883593bcc980835bd4a9324ee', 'general', 'AK', 30),
('창고_evelom', '1ae414dfbec9bc6c6e2391c9737e51fa114ec285d34e8bea59cbf8a2f2c6e54e', 'general', '창고', 30);

-- Inventory (배치코드 포함 - 날짜는 자동 계산됨)
INSERT INTO inventory (product_id, location_id, batch_code, current_stock, last_modified_by) VALUES
-- 2024년도 생산품 (4 = 2024)
('클렌징밤 450ml', '창고', '4030', 50, 'master_admin'),      -- 2024-01-30 생산
('클렌징밤 450ml', '창고', '4045A', 25, 'master_admin'),     -- 2024-02-14 생산
('클렌징밤 100ml', '창고', '4030', 100, 'master_admin'),     -- 2024-01-30 생산
('클렌징밤 100ml', '청량리', '4030', 40, 'master_admin'),    -- 2024-01-30 생산
('클렌징밤 100ml', 'AK', '4045A', 20, 'master_admin'),      -- 2024-02-14 생산
('모이스처크림 8ml', '창고', '4060', 200, 'master_admin'),   -- 2024-02-29 생산
('모이스처크림 8ml', '청량리', '4060', 50, 'master_admin'),  -- 2024-02-29 생산
('모이스처크림 8ml', 'AK', '4015', 30, 'master_admin'),     -- 2024-01-15 생산
('립밤 4g', '창고', '4020', 80, 'master_admin'),            -- 2024-01-20 생산
('토너 30ml', '창고', '4010', 150, 'master_admin');         -- 2024-01-10 생산

-- =====================================================
-- 7. 뷰 생성 (유통기한 관련 편의 기능)
-- =====================================================

-- 유통기한별 재고 현황 뷰
CREATE VIEW inventory_with_expiry_status AS
SELECT 
    i.*,
    p.category_id,
    p.unit,
    l.code as location_code,
    CASE 
        WHEN i.expiry_date < CURRENT_DATE THEN '만료'
        WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN '30일 이내 만료'
        WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN '90일 이내 만료'
        ELSE '정상'
    END as expiry_status,
    i.expiry_date - CURRENT_DATE as days_until_expiry
FROM inventory i
JOIN products p ON i.product_id = p.name
JOIN locations l ON i.location_id = l.name
WHERE i.current_stock > 0
ORDER BY i.expiry_date ASC;

-- 만료 임박 재고 알림 뷰
CREATE VIEW expiring_inventory_alert AS
SELECT 
    product_id,
    location_id,
    batch_code,
    current_stock,
    production_date,
    expiry_date,
    expiry_date - CURRENT_DATE as days_until_expiry
FROM inventory
WHERE 
    current_stock > 0 
    AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY expiry_date ASC;

-- =====================================================
-- 8. 권한 설정 (RLS - Row Level Security)
-- =====================================================

-- RLS 활성화
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- 일반 사용자는 자신의 할당된 위치만 조회 가능
CREATE POLICY "Users can view inventory for their assigned location" ON inventory
    FOR SELECT TO authenticated
    USING (
        location_id IN (
            SELECT assigned_location_id 
            FROM users 
            WHERE username = current_setting('app.current_user')
        )
        OR 
        (
            SELECT role 
            FROM users 
            WHERE username = current_setting('app.current_user')
        ) = 'master'
    );

-- 마스터는 모든 데이터 조회/수정 가능
CREATE POLICY "Masters can do everything" ON inventory
    FOR ALL TO authenticated
    USING (
        (
            SELECT role 
            FROM users 
            WHERE username = current_setting('app.current_user')
        ) = 'master'
    );

COMMENT ON TABLE inventory IS '재고 관리 테이블 (배치코드 포함)';
COMMENT ON COLUMN inventory.batch_code IS '배치코드: 4자리 숫자 + 선택적 알파벳 (예: 4030, 4030A)';
COMMENT ON COLUMN inventory.production_date IS '생산일자 (배치코드로부터 자동 계산)';
COMMENT ON COLUMN inventory.expiry_date IS '유통기한 (생산일 + 3년)';

COMMENT ON FUNCTION parse_batch_code_to_date(VARCHAR) IS '배치코드를 생산일자로 변환하는 함수';
COMMENT ON FUNCTION calculate_expiry_date(DATE) IS '생산일자로부터 유통기한을 계산하는 함수 (3년 후)';

COMMENT ON VIEW inventory_with_expiry_status IS '유통기한 상태가 포함된 재고 현황 뷰';
COMMENT ON VIEW expiring_inventory_alert IS '만료 임박 재고 알림용 뷰 (90일 이내)';