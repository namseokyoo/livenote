-- LiveNote 테이블 생성 마이그레이션
-- 2026-02-03

-- notes 테이블 생성
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  content_json JSONB,
  host_password TEXT NOT NULL,
  guest_password TEXT NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_modified TIMESTAMPTZ DEFAULT now()
);

-- note_users 테이블 생성
CREATE TABLE IF NOT EXISTS note_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
  can_edit BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notes_note_code ON notes(note_code);
CREATE INDEX IF NOT EXISTS idx_note_users_note_id ON note_users(note_id);
CREATE INDEX IF NOT EXISTS idx_note_users_user_id ON note_users(user_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_users ENABLE ROW LEVEL SECURITY;

-- 익명 사용자를 위한 RLS 정책 (공개 접근 허용)
CREATE POLICY "Allow public read access" ON notes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON notes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON notes FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON note_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON note_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON note_users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON note_users FOR DELETE USING (true);

-- Realtime 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE note_users;
