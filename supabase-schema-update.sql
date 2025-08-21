-- 재고 테이블에 수정자 필드 추가
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id);

-- 재고 이동 테이블에 수정자 필드와 이동 그룹 ID 추가
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES users(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

-- 사용자 테이블에 담당 위치 필드 추가 (이미 있을 수 있지만 안전하게)
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_location_id UUID REFERENCES locations(id);

-- 기존 데이터에 기본 수정자 설정 (마스터 사용자로)
UPDATE inventory 
SET last_modified_by = (SELECT id FROM users WHERE role = 'master' LIMIT 1)
WHERE last_modified_by IS NULL;

UPDATE inventory_movements 
SET modified_by = (SELECT id FROM users WHERE role = 'master' LIMIT 1)
WHERE modified_by IS NULL;

-- 일반 사용자들을 각 위치에 할당 (예시)
-- 실제로는 사용자 생성 시 또는 관리자가 직접 할당해야 함