/**
 * LiveNote 노트 관련 타입 정의
 */

/**
 * Tiptap 에디터 JSON 포맷 타입
 */
export interface TiptapContent {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * 노트 엔티티
 *
 * 보안 패치 2026-02-10:
 * - host_password, guest_password는 별도 테이블(note_passwords)에 저장됨
 * - 클라이언트에서는 항상 빈 문자열로 반환됨
 * - 비밀번호 검증은 Postgres Function을 통해서만 수행
 */
export interface Note {
  id: string;
  note_code: string;
  title: string;
  /** 기존 plain text 콘텐츠 (백업/마이그레이션용) */
  content: string;
  /** Tiptap 에디터 JSON 포맷 콘텐츠 */
  content_json: TiptapContent | null;
  /** @deprecated 보안 패치 이후 항상 빈 문자열 */
  host_password: string;
  /** @deprecated 보안 패치 이후 항상 빈 문자열 */
  guest_password: string;
  is_locked: boolean;
  locked_by: string | null;
  created_at: string;
  last_modified: string;
}

/**
 * 편집 권한 요청 상태
 */
export type PermissionStatus = 'none' | 'requested' | 'granted' | 'denied';

/**
 * 노트 참여자 엔티티
 */
export interface NoteUser {
  id: string;
  note_id: string;
  user_id: string;
  username: string;
  role: UserRole;
  joined_at: string;
  /** 게스트 편집 권한 (호스트만 변경 가능) */
  can_edit?: boolean;
  /** 편집 권한 요청 상태 */
  permission_status?: PermissionStatus;
  /** 권한 요청 시간 */
  permission_requested_at?: string;
}

/**
 * 사용자 역할
 */
export type UserRole = 'host' | 'guest';

/**
 * 노트 생성 입력값
 */
export interface CreateNoteInput {
  title: string;
  hostPassword: string;
  guestPassword: string;
}

/**
 * 노트 참여 입력값
 */
export interface JoinNoteInput {
  noteId: string;
  userId: string;
  username: string;
  role: UserRole;
}

/**
 * 비밀번호 검증 결과
 */
export interface PasswordVerifyResult {
  valid: boolean;
  role: UserRole | null;
}
