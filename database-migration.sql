-- 데이터베이스 스키마 변경: UUID PK를 name/username PK로 변경
-- 주의: 기존 데이터를 백업하고 실행하세요!

-- 1. 기존 테이블 데이터 백업 (필요한 경우)
-- CREATE TABLE backup_categories AS SELECT * FROM categories;
-- CREATE TABLE backup_locations AS SELECT * FROM locations;
-- CREATE TABLE backup_products AS SELECT * FROM products;
-- CREATE TABLE backup_users AS SELECT * FROM users;
-- CREATE TABLE backup_inventory AS SELECT * FROM inventory;
-- CREATE TABLE backup_inventory_movements AS SELECT * FROM inventory_movements;

-- 2. 외래키 제약조건 제거 (기존 관계 해제)
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_location_id_fkey;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_last_modified_by_fkey;
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_location_id_fkey;
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_modified_by_fkey;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_assigned_location_id_fkey;

-- 3. 기존 PRIMARY KEY 제거
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_pkey;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;

-- 4. 새로운 PRIMARY KEY 추가
ALTER TABLE categories ADD CONSTRAINT categories_pkey PRIMARY KEY (name);
ALTER TABLE locations ADD CONSTRAINT locations_pkey PRIMARY KEY (name);
ALTER TABLE products ADD CONSTRAINT products_pkey PRIMARY KEY (name);
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (username);

-- 5. 외래키 컬럼 타입 변경
-- inventory 테이블
ALTER TABLE inventory ALTER COLUMN product_id TYPE VARCHAR USING (
  SELECT name FROM products WHERE products.id = inventory.product_id::uuid
);
ALTER TABLE inventory ALTER COLUMN location_id TYPE VARCHAR USING (
  SELECT name FROM locations WHERE locations.id = inventory.location_id::uuid
);
ALTER TABLE inventory ALTER COLUMN last_modified_by TYPE VARCHAR USING (
  SELECT username FROM users WHERE users.id = inventory.last_modified_by::uuid
);

-- inventory_movements 테이블
ALTER TABLE inventory_movements ALTER COLUMN product_id TYPE VARCHAR USING (
  SELECT name FROM products WHERE products.id = inventory_movements.product_id::uuid
);
ALTER TABLE inventory_movements ALTER COLUMN location_id TYPE VARCHAR USING (
  SELECT name FROM locations WHERE locations.id = inventory_movements.location_id::uuid
);
ALTER TABLE inventory_movements ALTER COLUMN from_location_id TYPE VARCHAR USING (
  SELECT name FROM locations WHERE locations.id = inventory_movements.from_location_id::uuid
);
ALTER TABLE inventory_movements ALTER COLUMN to_location_id TYPE VARCHAR USING (
  SELECT name FROM locations WHERE locations.id = inventory_movements.to_location_id::uuid
);
ALTER TABLE inventory_movements ALTER COLUMN modified_by TYPE VARCHAR USING (
  SELECT username FROM users WHERE users.id = inventory_movements.modified_by::uuid
);

-- products 테이블
ALTER TABLE products ALTER COLUMN category_id TYPE VARCHAR USING (
  SELECT name FROM categories WHERE categories.id = products.category_id::uuid
);

-- users 테이블
ALTER TABLE users ALTER COLUMN assigned_location_id TYPE VARCHAR USING (
  SELECT name FROM locations WHERE locations.id = users.assigned_location_id::uuid
);

-- 6. 불필요한 id 컬럼 제거
ALTER TABLE categories DROP COLUMN IF EXISTS id;
ALTER TABLE locations DROP COLUMN IF EXISTS id;
ALTER TABLE products DROP COLUMN IF EXISTS id;
ALTER TABLE users DROP COLUMN IF EXISTS id;

-- 7. 외래키 제약조건 재생성
ALTER TABLE inventory ADD CONSTRAINT inventory_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(name);
ALTER TABLE inventory ADD CONSTRAINT inventory_location_id_fkey 
  FOREIGN KEY (location_id) REFERENCES locations(name);
ALTER TABLE inventory ADD CONSTRAINT inventory_last_modified_by_fkey 
  FOREIGN KEY (last_modified_by) REFERENCES users(username);

ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(name);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_location_id_fkey 
  FOREIGN KEY (location_id) REFERENCES locations(name);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_from_location_id_fkey 
  FOREIGN KEY (from_location_id) REFERENCES locations(name);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_to_location_id_fkey 
  FOREIGN KEY (to_location_id) REFERENCES locations(name);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_modified_by_fkey 
  FOREIGN KEY (modified_by) REFERENCES users(username);

ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(name);
ALTER TABLE users ADD CONSTRAINT users_assigned_location_id_fkey 
  FOREIGN KEY (assigned_location_id) REFERENCES locations(name);

-- 8. 인덱스 재생성 (성능을 위해)
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_id ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_location_id ON inventory_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_users_assigned_location_id ON users(assigned_location_id);