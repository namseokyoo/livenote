import { supabase } from './supabase';
import type { Note, NoteUser, UserRole, PasswordVerifyResult, TiptapContent, PermissionStatus } from '@/types/note';

/**
 * plain text를 Tiptap JSON 포맷으로 변환
 *
 * @param text - plain text 콘텐츠
 * @returns Tiptap JSON 포맷
 */
export function textToTiptapJson(text: string): TiptapContent {
  if (!text || text.trim() === '') {
    return { type: 'doc', content: [] };
  }

  // 줄바꿈으로 분리하여 각 줄을 paragraph로 변환
  const paragraphs = text.split('\n').map(line => ({
    type: 'paragraph' as const,
    content: line ? [{ type: 'text' as const, text: line }] : [],
  }));

  return { type: 'doc', content: paragraphs };
}

/**
 * Tiptap JSON 포맷을 plain text로 변환 (백업용)
 *
 * @param json - Tiptap JSON 콘텐츠
 * @returns plain text
 */
export function tiptapJsonToText(json: TiptapContent | null): string {
  if (!json || !json.content) {
    return '';
  }

  return json.content
    .map(node => {
      if (node.type === 'paragraph' && node.content) {
        return node.content
          .map(child => child.text || '')
          .join('');
      }
      return '';
    })
    .join('\n');
}

/**
 * 6자리 랜덤 노트 코드 생성
 * 영문 대문자와 숫자 조합 (혼동되는 문자 제외: 0, O, I, 1)
 *
 * @returns 6자리 노트 코드
 */
export function generateNoteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 새 노트 생성
 *
 * @param title - 노트 제목
 * @param hostPassword - 호스트 비밀번호 (4자리)
 * @param guestPassword - 게스트 비밀번호 (4자리)
 * @returns 생성된 노트 객체와 호스트의 participantId
 */
export async function createNote(
  title: string,
  hostPassword: string,
  guestPassword: string
): Promise<Note & { participantId: string }> {
  // 고유한 노트 코드 생성 (충돌 시 재시도)
  let noteCode = generateNoteCode();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        note_code: noteCode,
        title,
        content: '',
        host_password: hostPassword,
        guest_password: guestPassword,
        is_locked: false,
        locked_by: null,
      })
      .select()
      .single();

    if (!error && data) {
      // 호스트를 note_users에 추가
      const participantId = crypto.randomUUID();
      const { error: userError } = await supabase
        .from('note_users')
        .insert({
          note_id: data.id,
          user_id: participantId,
          username: '호스트',
          role: 'host',
          can_edit: true,
        });

      if (userError) {
        console.error('호스트 등록 실패:', userError);
        // 노트는 생성됨, 호스트 등록 실패해도 진행
      }

      return { ...(data as Note), participantId };
    }

    // 코드 중복 시 재생성
    if (error?.code === '23505') { // unique_violation
      noteCode = generateNoteCode();
      attempts++;
      continue;
    }

    throw new Error(`노트 생성 실패: ${error?.message}`);
  }

  throw new Error('노트 코드 생성 실패: 최대 시도 횟수 초과');
}

/**
 * 노트 코드로 노트 조회
 *
 * @param noteCode - 6자리 노트 코드
 * @returns 노트 객체 또는 null
 */
export async function getNoteByCode(noteCode: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('note_code', noteCode.toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // 결과 없음
      return null;
    }
    throw new Error(`노트 조회 실패: ${error.message}`);
  }

  return data as Note;
}

/**
 * 노트 ID로 노트 조회
 *
 * @param noteId - 노트 UUID
 * @returns 노트 객체 또는 null
 */
export async function getNoteById(noteId: string): Promise<Note | null> {
  // noteId가 유효하지 않으면 null 반환 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    return null;
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`노트 조회 실패: ${error.message}`);
  }

  return data as Note;
}

/**
 * 비밀번호 검증 및 역할 반환
 *
 * @param note - 노트 객체
 * @param password - 입력된 비밀번호
 * @returns 검증 결과 및 역할
 */
export function verifyPassword(note: Note, password: string): PasswordVerifyResult {
  if (password === note.host_password) {
    return { valid: true, role: 'host' };
  }
  if (password === note.guest_password) {
    return { valid: true, role: 'guest' };
  }
  return { valid: false, role: null };
}

/**
 * 노트 내용 업데이트 (plain text 버전 - 하위 호환용)
 *
 * @param noteId - 노트 UUID
 * @param content - 새 노트 내용 (plain text)
 * @returns 업데이트된 노트 객체
 */
export async function updateNoteContent(
  noteId: string,
  content: string
): Promise<Note> {
  // noteId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('노트 업데이트 실패: 유효하지 않은 노트 ID입니다.');
  }

  const { data, error } = await supabase
    .from('notes')
    .update({
      content,
      last_modified: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    throw new Error(`노트 업데이트 실패: ${error.message}`);
  }

  return data as Note;
}

/**
 * 노트 내용 업데이트 (JSON 버전 - Tiptap 에디터용)
 *
 * @param noteId - 노트 UUID
 * @param contentJson - Tiptap JSON 포맷 콘텐츠
 * @returns 업데이트된 노트 객체
 */
export async function updateNoteContentJson(
  noteId: string,
  contentJson: TiptapContent
): Promise<Note> {
  // noteId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('노트 업데이트 실패: 유효하지 않은 노트 ID입니다.');
  }

  // JSON과 함께 plain text 백업도 저장
  const plainText = tiptapJsonToText(contentJson);

  const { data, error } = await supabase
    .from('notes')
    .update({
      content_json: contentJson,
      content: plainText, // 백업용 plain text
      last_modified: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    throw new Error(`노트 업데이트 실패: ${error.message}`);
  }

  return data as Note;
}

/**
 * 노트 제목 업데이트
 *
 * @param noteId - 노트 UUID
 * @param title - 새 노트 제목
 * @returns 업데이트된 노트 객체
 */
export async function updateNoteTitle(
  noteId: string,
  title: string
): Promise<Note> {
  // noteId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('노트 제목 업데이트 실패: 유효하지 않은 노트 ID입니다.');
  }

  const { data, error } = await supabase
    .from('notes')
    .update({
      title,
      last_modified: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    throw new Error(`노트 제목 업데이트 실패: ${error.message}`);
  }

  return data as Note;
}

/**
 * 노트 잠금 설정/해제
 *
 * @param noteId - 노트 UUID
 * @param isLocked - 잠금 상태
 * @param lockedBy - 잠금을 건 사용자 ID (해제 시 null)
 * @returns 업데이트된 노트 객체
 */
export async function setNoteLock(
  noteId: string,
  isLocked: boolean,
  lockedBy: string | null
): Promise<Note> {
  // noteId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('노트 잠금 설정 실패: 유효하지 않은 노트 ID입니다.');
  }

  const { data, error } = await supabase
    .from('notes')
    .update({
      is_locked: isLocked,
      locked_by: lockedBy,
      last_modified: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    throw new Error(`노트 잠금 설정 실패: ${error.message}`);
  }

  return data as Note;
}

/**
 * 노트 참여
 *
 * @param noteId - 노트 UUID
 * @param userId - 사용자 UUID
 * @param username - 사용자 이름
 * @param role - 사용자 역할 (host/guest)
 * @returns 생성된 참여자 객체
 */
export async function joinNote(
  noteId: string,
  userId: string,
  username: string,
  role: UserRole
): Promise<NoteUser> {
  // noteId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('노트 참여 실패: 유효하지 않은 노트 ID입니다.');
  }
  // userId가 유효하지 않으면 에러 발생
  if (!userId || userId === '') {
    throw new Error('노트 참여 실패: 유효하지 않은 사용자 ID입니다.');
  }

  // 기존 참여 기록이 있으면 업데이트
  const { data: existing } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('note_users')
      .update({
        username,
        role,
        joined_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`노트 참여 업데이트 실패: ${error.message}`);
    }

    return data as NoteUser;
  }

  // 새로운 참여 기록 생성
  // 게스트는 기본적으로 can_edit: false, permission_status: 'none'
  // 호스트는 can_edit: true, permission_status: 'granted'
  const { data, error } = await supabase
    .from('note_users')
    .insert({
      note_id: noteId,
      user_id: userId,
      username,
      role,
      can_edit: role === 'host',
      permission_status: role === 'host' ? 'granted' : 'none',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`노트 참여 실패: ${error.message}`);
  }

  return data as NoteUser;
}

/**
 * 노트 나가기
 *
 * @param noteId - 노트 UUID
 * @param userId - 사용자 UUID
 */
export async function leaveNote(noteId: string, userId: string): Promise<void> {
  // noteId 또는 userId가 유효하지 않으면 조기 반환 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '' || !userId || userId === '') {
    return;
  }

  const { error } = await supabase
    .from('note_users')
    .delete()
    .eq('note_id', noteId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`노트 나가기 실패: ${error.message}`);
  }
}

/**
 * 노트 접속자 목록 조회
 *
 * @param noteId - 노트 UUID
 * @returns 참여자 목록
 */
export async function getNoteUsers(noteId: string): Promise<NoteUser[]> {
  // noteId가 유효하지 않으면 빈 배열 반환 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    return [];
  }

  const { data, error } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(`접속자 목록 조회 실패: ${error.message}`);
  }

  return data as NoteUser[];
}

/**
 * 특정 사용자의 노트 참여 정보 조회
 *
 * @param noteId - 노트 UUID
 * @param userId - 사용자 UUID
 * @returns 참여자 정보 또는 null
 */
export async function getNoteUser(
  noteId: string,
  userId: string
): Promise<NoteUser | null> {
  // noteId 또는 userId가 유효하지 않으면 null 반환 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '' || !userId || userId === '') {
    return null;
  }

  const { data, error } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`참여자 정보 조회 실패: ${error.message}`);
  }

  return data as NoteUser;
}

/**
 * 게스트의 편집 권한 업데이트 (호스트만 가능)
 *
 * @param noteId - 노트 UUID
 * @param targetUserId - 권한을 변경할 대상 사용자 UUID
 * @param canEdit - 편집 권한 여부
 * @param requesterId - 요청자 UUID (호스트 검증용)
 * @returns 업데이트된 참여자 객체
 * @throws 요청자가 호스트가 아니거나 대상이 존재하지 않는 경우 에러
 */
export async function updateUserEditPermission(
  noteId: string,
  targetUserId: string,
  canEdit: boolean,
  requesterId: string
): Promise<NoteUser> {
  // noteId, targetUserId, requesterId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('권한 변경 실패: 유효하지 않은 노트 ID입니다.');
  }
  if (!targetUserId || targetUserId === '') {
    throw new Error('권한 변경 실패: 유효하지 않은 대상 사용자 ID입니다.');
  }
  if (!requesterId || requesterId === '') {
    throw new Error('권한 변경 실패: 유효하지 않은 요청자 ID입니다.');
  }

  // 1. 요청자가 해당 노트의 호스트인지 검증
  const { data: requesterData, error: requesterError } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', requesterId)
    .eq('role', 'host')
    .single();

  if (requesterError || !requesterData) {
    throw new Error('권한 변경 실패: 호스트만 편집 권한을 변경할 수 있습니다.');
  }

  // 2. 대상 사용자가 해당 노트에 존재하는지 확인
  const { data: targetData, error: targetError } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', targetUserId)
    .single();

  if (targetError || !targetData) {
    throw new Error('권한 변경 실패: 대상 사용자를 찾을 수 없습니다.');
  }

  // 3. 호스트는 자신의 권한을 변경할 수 없음 (호스트는 항상 편집 가능)
  if (targetData.role === 'host') {
    throw new Error('권한 변경 실패: 호스트의 권한은 변경할 수 없습니다.');
  }

  // 4. can_edit 권한 업데이트
  const { data, error } = await supabase
    .from('note_users')
    .update({
      can_edit: canEdit,
    })
    .eq('note_id', noteId)
    .eq('user_id', targetUserId)
    .select()
    .single();

  if (error) {
    throw new Error(`편집 권한 변경 실패: ${error.message}`);
  }

  return data as NoteUser;
}

/**
 * 편집 권한 요청 (게스트 전용)
 * - 30초 쿨다운 체크
 * - permission_status = 'requested', permission_requested_at = now()
 *
 * @param noteId - 노트 UUID
 * @param userId - 사용자 UUID
 * @returns 업데이트된 참여자 객체
 * @throws 쿨다운 중이거나 호스트인 경우 에러
 */
export async function requestEditPermission(
  noteId: string,
  userId: string
): Promise<NoteUser> {
  // noteId 또는 userId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('권한 요청 실패: 유효하지 않은 노트 ID입니다.');
  }
  if (!userId || userId === '') {
    throw new Error('권한 요청 실패: 유효하지 않은 사용자 ID입니다.');
  }

  // 1. 현재 사용자 정보 조회
  const { data: userData, error: userError } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', userId)
    .single();

  if (userError || !userData) {
    throw new Error('권한 요청 실패: 사용자를 찾을 수 없습니다.');
  }

  // 2. 호스트는 권한 요청 불가 (이미 편집 가능)
  if (userData.role === 'host') {
    throw new Error('권한 요청 실패: 호스트는 이미 편집 권한이 있습니다.');
  }

  // 3. 이미 편집 권한이 있는 경우
  if (userData.can_edit === true) {
    throw new Error('권한 요청 실패: 이미 편집 권한이 있습니다.');
  }

  // 4. 쿨다운 체크 (마지막 요청 후 30초)
  const COOLDOWN_SECONDS = 30;
  if (userData.permission_requested_at) {
    const lastRequestTime = new Date(userData.permission_requested_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - lastRequestTime) / 1000;

    if (elapsedSeconds < COOLDOWN_SECONDS && userData.permission_status === 'requested') {
      const remainingSeconds = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
      throw new Error(`권한 요청 실패: ${remainingSeconds}초 후 다시 시도해주세요.`);
    }

    // 거부된 경우에도 쿨다운 적용
    if (elapsedSeconds < COOLDOWN_SECONDS && userData.permission_status === 'denied') {
      const remainingSeconds = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
      throw new Error(`권한 요청 실패: ${remainingSeconds}초 후 다시 시도해주세요.`);
    }
  }

  // 5. 권한 요청 상태 업데이트
  const { data, error } = await supabase
    .from('note_users')
    .update({
      permission_status: 'requested' as PermissionStatus,
      permission_requested_at: new Date().toISOString(),
    })
    .eq('note_id', noteId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`권한 요청 실패: ${error.message}`);
  }

  return data as NoteUser;
}

/**
 * 편집 권한 응답 (호스트 전용)
 * - 승인: can_edit = true, permission_status = 'granted'
 * - 거부: permission_status = 'denied'
 *
 * @param noteId - 노트 UUID
 * @param targetUserId - 대상 사용자 UUID
 * @param approved - 승인 여부
 * @param hostUserId - 호스트 UUID (검증용)
 * @returns 업데이트된 참여자 객체
 * @throws 요청자가 호스트가 아니거나 대상이 권한 요청 상태가 아닌 경우 에러
 */
export async function respondToEditRequest(
  noteId: string,
  targetUserId: string,
  approved: boolean,
  hostUserId: string
): Promise<NoteUser> {
  // noteId, targetUserId, hostUserId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('권한 응답 실패: 유효하지 않은 노트 ID입니다.');
  }
  if (!targetUserId || targetUserId === '') {
    throw new Error('권한 응답 실패: 유효하지 않은 대상 사용자 ID입니다.');
  }
  if (!hostUserId || hostUserId === '') {
    throw new Error('권한 응답 실패: 유효하지 않은 호스트 ID입니다.');
  }

  // 1. 요청자가 해당 노트의 호스트인지 검증
  const { data: hostData, error: hostError } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', hostUserId)
    .eq('role', 'host')
    .single();

  if (hostError || !hostData) {
    throw new Error('권한 응답 실패: 호스트만 권한 요청에 응답할 수 있습니다.');
  }

  // 2. 대상 사용자 정보 조회
  const { data: targetData, error: targetError } = await supabase
    .from('note_users')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', targetUserId)
    .single();

  if (targetError || !targetData) {
    throw new Error('권한 응답 실패: 대상 사용자를 찾을 수 없습니다.');
  }

  // 3. 대상이 권한 요청 상태인지 확인
  if (targetData.permission_status !== 'requested') {
    throw new Error('권한 응답 실패: 대상 사용자가 권한 요청 상태가 아닙니다.');
  }

  // 4. 승인/거부에 따른 업데이트
  const updateData = approved
    ? {
        can_edit: true,
        permission_status: 'granted' as PermissionStatus,
      }
    : {
        permission_status: 'denied' as PermissionStatus,
      };

  const { data, error } = await supabase
    .from('note_users')
    .update(updateData)
    .eq('note_id', noteId)
    .eq('user_id', targetUserId)
    .select()
    .single();

  if (error) {
    throw new Error(`권한 응답 실패: ${error.message}`);
  }

  return data as NoteUser;
}

/**
 * 만료된 요청 정리 (24시간 지난 요청 → 'none'으로 리셋)
 *
 * @param noteId - 노트 UUID
 */
export async function cleanupExpiredRequests(noteId: string): Promise<void> {
  // noteId가 유효하지 않으면 조기 반환 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    return;
  }

  const EXPIRY_HOURS = 24;
  const expiryTime = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  // 24시간 지난 요청들을 'none'으로 리셋
  const { error } = await supabase
    .from('note_users')
    .update({
      permission_status: 'none' as PermissionStatus,
      permission_requested_at: null,
    })
    .eq('note_id', noteId)
    .in('permission_status', ['requested', 'denied'])
    .lt('permission_requested_at', expiryTime);

  if (error) {
    console.error('만료된 요청 정리 실패:', error);
  }
}

/**
 * 노트 목록 응답 타입 (비밀번호 제외)
 */
export interface NoteListItem {
  id: string;
  note_code: string;
  title: string;
  created_at: string;
  last_modified: string;
}

export interface NoteListResponse {
  notes: NoteListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * 노트 목록 조회 (무한 스크롤용, 커서 기반 페이지네이션)
 * 비밀번호 필드는 절대 반환하지 않음
 *
 * @param cursor - 마지막 노트 ID (선택)
 * @param limit - 가져올 개수 (기본 10)
 * @param search - 검색어 (선택, 제목/내용 ILIKE 검색)
 * @returns 노트 목록 및 페이지네이션 정보
 */
export async function getNoteList(
  cursor?: string,
  limit: number = 10,
  search?: string
): Promise<NoteListResponse> {
  // 비밀번호 필드 제외하고 필요한 필드만 선택
  let query = supabase
    .from('notes')
    .select('id, note_code, title, created_at, last_modified')
    .order('last_modified', { ascending: false })
    .limit(limit + 1); // 다음 페이지 존재 여부 확인을 위해 +1

  // 검색어가 있으면 제목과 내용에서 ILIKE 검색
  if (search && search.trim()) {
    const searchTerm = search.trim();
    query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
  }

  // 커서가 있으면 해당 노트의 last_modified 이후 데이터만 조회
  if (cursor) {
    // 커서 노트의 last_modified 조회
    const { data: cursorNote } = await supabase
      .from('notes')
      .select('last_modified')
      .eq('id', cursor)
      .single();

    if (cursorNote) {
      query = query.lt('last_modified', cursorNote.last_modified);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`노트 목록 조회 실패: ${error.message}`);
  }

  const notes = data as NoteListItem[];
  const hasMore = notes.length > limit;

  // 실제 반환할 노트 목록 (limit 개수만)
  const resultNotes = hasMore ? notes.slice(0, limit) : notes;

  // 다음 커서는 마지막 노트의 ID
  const nextCursor = hasMore ? resultNotes[resultNotes.length - 1].id : null;

  return {
    notes: resultNotes,
    nextCursor,
    hasMore,
  };
}

/**
 * 노트 삭제 (호스트만 가능)
 *
 * @param noteId - 노트 UUID
 */
export async function deleteNote(noteId: string): Promise<void> {
  // noteId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
  if (!noteId || noteId === '') {
    throw new Error('노트 삭제 실패: 유효하지 않은 노트 ID입니다.');
  }

  // 먼저 참여자 기록 삭제
  const { error: usersError } = await supabase
    .from('note_users')
    .delete()
    .eq('note_id', noteId);

  if (usersError) {
    throw new Error(`참여자 기록 삭제 실패: ${usersError.message}`);
  }

  // 노트 삭제
  const { error: noteError } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (noteError) {
    throw new Error(`노트 삭제 실패: ${noteError.message}`);
  }
}
