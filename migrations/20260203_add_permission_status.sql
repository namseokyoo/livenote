-- Phase 4-1a: 게스트 편집 권한 요청/수락 시스템 DB 마이그레이션
-- 실행 위치: Supabase Dashboard > SQL Editor

-- 1. note_users 테이블에 권한 요청 상태 컬럼 추가
-- permission_status: 'none' | 'requested' | 'granted' | 'denied'
ALTER TABLE note_users
ADD COLUMN IF NOT EXISTS permission_status VARCHAR(20) DEFAULT 'none';

-- 2. 권한 요청 시간 컬럼 추가
ALTER TABLE note_users
ADD COLUMN IF NOT EXISTS permission_requested_at TIMESTAMPTZ;

-- 3. 인덱스 추가 (권한 요청 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_note_users_permission_status
ON note_users(note_id, permission_status);

-- 4. 기존 데이터 업데이트 (이미 편집 권한이 있는 사용자는 'granted' 상태로)
UPDATE note_users
SET permission_status = 'granted'
WHERE can_edit = true AND role = 'guest';

-- 5. Realtime 구독 활성화 (이미 활성화되어 있다면 무시됨)
-- Supabase Dashboard > Database > Replication에서 note_users 테이블 확인

COMMENT ON COLUMN note_users.permission_status IS '편집 권한 요청 상태: none(미요청), requested(요청중), granted(승인), denied(거부)';
COMMENT ON COLUMN note_users.permission_requested_at IS '권한 요청 시간 (쿨다운 계산용)';
