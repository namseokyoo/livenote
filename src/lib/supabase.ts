import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

/**
 * 브라우저용 Supabase 클라이언트 인스턴스
 * 싱글톤 패턴으로 하나의 인스턴스만 사용
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 서버 사이드용 Supabase 클라이언트 생성
 * 필요시 서비스 롤 키로 교체 가능
 */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
