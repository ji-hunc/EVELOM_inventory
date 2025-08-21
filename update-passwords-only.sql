-- 기존 사용자 비밀번호만 업데이트 (전체 재생성 없이)
-- 현재 데이터베이스에서 비밀번호만 수정하는 경우 사용

UPDATE users SET password_hash = '9fae4e1142bc035f4e373f9f42dc20ab4c8aa5108a3e22347af9bade4a3c244a' WHERE username = 'master_admin';
UPDATE users SET password_hash = 'a9902ea121923e331e40123e01853b88ee3c101d5e92b547dcb8645b295496af' WHERE username = '청량리_evelom';
UPDATE users SET password_hash = '75489cb6361ef45becbabbbf9fb1cf4a228eff3883593bcc980835bd4a9324ee' WHERE username = 'AK_evelom';
UPDATE users SET password_hash = '1ae414dfbec9bc6c6e2391c9737e51fa114ec285d34e8bea59cbf8a2f2c6e54e' WHERE username = '창고_evelom';

-- 업데이트 확인
SELECT username, 
       CASE 
         WHEN password_hash = '$2b$12$hash_here' THEN '❌ 기본값 (로그인 불가)'
         ELSE '✅ 해시된 비밀번호'
       END as password_status
FROM users;