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
 */
export interface Note {
  id: string;
  note_code: string;
  title: string;
  /** 기존 plain text 콘텐츠 (백업/마이그레이션용) */
  content: string;
  /** Tiptap 에디터 JSON 포맷 콘텐츠 */
  content_json: TiptapContent | null;
  host_password: string;
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
