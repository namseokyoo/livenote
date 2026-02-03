-- Realtime Publication 활성화 마이그레이션
-- 2026-02-03: 프로덕션 Realtime 연결 문제 해결

-- notes 테이블 Realtime Publication 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
    RAISE NOTICE 'Added notes table to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'notes table already in supabase_realtime publication';
  END IF;
END $$;

-- note_users 테이블 Realtime Publication 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'note_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE note_users;
    RAISE NOTICE 'Added note_users table to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'note_users table already in supabase_realtime publication';
  END IF;
END $$;

-- REPLICA IDENTITY 설정 (Realtime이 모든 컬럼 변경을 추적하도록)
ALTER TABLE notes REPLICA IDENTITY FULL;
ALTER TABLE note_users REPLICA IDENTITY FULL;
