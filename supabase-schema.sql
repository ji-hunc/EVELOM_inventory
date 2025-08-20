-- EVELOM 재고관리 시스템 데이터베이스 스키마
-- 확장 가능한 구조로 설계

-- 1. 사용자 테이블 (인증 및 권한 관리)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('master', 'general')),
  location VARCHAR(50), -- 일반 사용자의 경우 담당 위치 (창고, 청량리, AK)
  alert_threshold INTEGER DEFAULT 30, -- 사용자별 재고 부족 알림 임계치
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 위치 테이블 (창고, 청량리, AK 등)
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 제품 카테고리 테이블 (정제품, 샘플, 사셰, 테스터)
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 제품 테이블
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE, -- 제품 코드
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  image_url TEXT, -- 제품 이미지 URL
  description TEXT,
  unit VARCHAR(20) DEFAULT '개', -- 단위 (개, 박스 등)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 5. 재고 테이블 (현재 재고 현황)
CREATE TABLE inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  current_stock INTEGER DEFAULT 0 NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(product_id, location_id)
);

-- 6. 재고 이동 내역 테이블 (입고/출고 이벤트)
CREATE TABLE inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 기본 데이터 삽입

-- 위치 데이터 삽입
INSERT INTO locations (name, code, description) VALUES
('창고', 'WH', '메인 창고'),
('청량리', 'CL', '청량리 지점'),
('AK', 'AK', 'AK 지점');

-- 카테고리 데이터 삽입
INSERT INTO categories (name, code, description) VALUES
('정제품', 'FG', '완제품 (Finished Goods)'),
('샘플', 'SA', '샘플 제품'),
('사셰', 'SC', '사셰 형태 제품'),
('테스터', 'TE', '테스터 제품');

-- 사용자 계정 생성 (비밀번호는 SHA256으로 해시된 'evelom2024')
INSERT INTO users (username, password_hash, role, location) VALUES
('master', '2fa507d29e7a11d67a097a45cf69a3e1fb16b21d703ecc003052f44bbe4835b6', 'master', NULL),
('창고_evelom', '2fa507d29e7a11d67a097a45cf69a3e1fb16b21d703ecc003052f44bbe4835b6', 'general', '창고'),
('청량리_evelom', '2fa507d29e7a11d67a097a45cf69a3e1fb16b21d703ecc003052f44bbe4835b6', 'general', '청량리'),
('AK_evelom', '2fa507d29e7a11d67a097a45cf69a3e1fb16b21d703ecc003052f44bbe4835b6', 'general', 'AK');

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_inventory_product_location ON inventory(product_id, location_id);
CREATE INDEX idx_movements_product_date ON inventory_movements(product_id, movement_date);
CREATE INDEX idx_movements_location_date ON inventory_movements(location_id, movement_date);
CREATE INDEX idx_movements_type_date ON inventory_movements(movement_type, movement_date);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 설정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (기본적으로 모든 인증된 사용자에게 접근 허용, 애플리케이션에서 추가 권한 제어)
CREATE POLICY "Allow authenticated access" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON locations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON inventory FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON inventory_movements FOR ALL USING (auth.role() = 'authenticated');