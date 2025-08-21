# 🔑 로그인 문제 해결 가이드

## 문제 상황
데이터베이스의 비밀번호가 `$2b$12$hash_here`로 되어 있어 로그인이 불가능한 상태

## ⚡ 빠른 해결 방법

### 1. Supabase SQL Editor에서 비밀번호 업데이트
```sql
-- update-passwords-only.sql 파일의 내용을 복사하여 실행
UPDATE users SET password_hash = '9fae4e1142bc035f4e373f9f42dc20ab4c8aa5108a3e22347af9bade4a3c244a' WHERE username = 'master_admin';
UPDATE users SET password_hash = 'a9902ea121923e331e40123e01853b88ee3c101d5e92b547dcb8645b295496af' WHERE username = '청량리_evelom';
UPDATE users SET password_hash = '75489cb6361ef45becbabbbf9fb1cf4a228eff3883593bcc980835bd4a9324ee' WHERE username = 'AK_evelom';
UPDATE users SET password_hash = '1ae414dfbec9bc6c6e2391c9737e51fa114ec285d34e8bea59cbf8a2f2c6e54e' WHERE username = '창고_evelom';
```

### 2. 업데이트 확인
```sql
SELECT username, 
       CASE 
         WHEN password_hash = '$2b$12$hash_here' THEN '❌ 기본값 (로그인 불가)'
         ELSE '✅ 해시된 비밀번호'
       END as password_status
FROM users;
```

## 🔐 테스트 계정 정보

| 역할 | 아이디 | 비밀번호 | 접근 권한 |
|------|--------|----------|-----------|
| **마스터** | `master_admin` | `admin123` | 모든 위치 접근 |
| **청량리** | `청량리_evelom` | `cheonglyangni123` | 청량리만 접근 |
| **AK** | `AK_evelom` | `ak123` | AK만 접근 |
| **창고** | `창고_evelom` | `warehouse123` | 창고만 접근 |

## 🔧 비밀번호 해시 알고리즘
```javascript
// 사용된 해시 방식 (auth.ts 참조)
crypto.createHash('sha256').update(password + 'evelom_salt').digest('hex')
```

## 🚨 전체 데이터베이스 재생성하는 경우
전체 시스템을 처음부터 재구성하려면:
```sql
-- database-recreate-with-batch.sql 실행
-- ⚠️ 주의: 모든 기존 데이터가 삭제됩니다!
```

## ✅ 해결 확인 방법
1. SQL 쿼리 실행 후 로그인 페이지 새로고침
2. 마스터 계정으로 테스트: `master_admin` / `admin123`
3. 로그인 성공 시 대시보드로 자동 이동
4. 일반 계정으로 권한 제한 테스트

## 🔍 문제 진단
로그인이 여전히 안 되는 경우:
1. 브라우저 콘솔에서 네트워크 탭 확인
2. `/api/auth/login` 응답 상태 확인
3. 서버 로그에서 인증 오류 메시지 확인

이제 정상적으로 로그인할 수 있습니다! 🎉