import { get, ref, remove, set, update } from 'firebase/database';
import type { Note, NoteUser, NoteVisibility, PasswordVerifyResult, PermissionStatus, TiptapContent, UserRole } from '@/types/note';
import { getRtdb, signInAnonymouslyIfNeeded } from './firebase';

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

type NoteRecord = {
  noteId: string;
  noteCode: string;
  title: string;
  isLocked: boolean;
  lockedBy: string | null;
  createdAt: number | string;
  lastModified: number | string;
  visibility?: NoteVisibility;
  content?: string;
  contentJson?: TiptapContent | null;
  updatedAt?: number | string;
  updatedBy?: string;
};

type NoteCodeRecord = {
  noteId: string;
  createdAt: number | string;
};

type ParticipantRecord = {
  uid: string;
  username: string;
  role: UserRole;
  canEdit: boolean;
  permissionStatus: PermissionStatus;
  permissionRequestedAt: number | string | null;
  joinedAt: number | string;
};

function normalizeNoteCode(noteCode: string): string {
  return noteCode.trim().toUpperCase();
}

function toTimestampMs(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function toIsoString(value: unknown): string {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date(0).toISOString();
}

function getPermissionStatus(role: UserRole, value: unknown): PermissionStatus {
  if (value === 'requested' || value === 'granted' || value === 'denied' || value === 'none') {
    return value;
  }

  return role === 'host' ? 'granted' : 'none';
}

function normalizeNoteVisibility(value: unknown): NoteVisibility {
  return value === 'unlisted' ? 'unlisted' : 'public';
}

function mapNote(noteId: string, noteData: Partial<NoteRecord> | null | undefined): Note {
  const contentJson = (noteData?.contentJson as TiptapContent | null | undefined) ?? null;
  const content = typeof noteData?.content === 'string'
    ? noteData.content
    : tiptapJsonToText(contentJson);

  return {
    id: noteId,
    note_code: noteData?.noteCode ?? '',
    title: noteData?.title ?? '',
    content,
    content_json: contentJson,
    host_password: '',
    guest_password: '',
    visibility: normalizeNoteVisibility(noteData?.visibility),
    is_locked: Boolean(noteData?.isLocked),
    locked_by: typeof noteData?.lockedBy === 'string' ? noteData.lockedBy : null,
    created_at: toIsoString(noteData?.createdAt),
    last_modified: toIsoString(noteData?.lastModified),
  };
}

function mapNoteUser(
  noteId: string,
  uid: string,
  userData: Partial<ParticipantRecord> | null | undefined
): NoteUser {
  const role = userData?.role === 'host' ? 'host' : 'guest';

  return {
    id: uid,
    note_id: noteId,
    user_id: uid,
    username: userData?.username ?? '',
    role,
    joined_at: toIsoString(userData?.joinedAt),
    can_edit: role === 'host' ? true : Boolean(userData?.canEdit),
    permission_status: getPermissionStatus(role, userData?.permissionStatus),
    permission_requested_at: userData?.permissionRequestedAt
      ? toIsoString(userData.permissionRequestedAt)
      : null,
  };
}

export function textToTiptapJson(text: string): TiptapContent {
  if (!text || text.trim() === '') {
    return { type: 'doc', content: [] };
  }

  return {
    type: 'doc',
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

export function tiptapJsonToText(json: TiptapContent | null): string {
  if (!json?.content) {
    return '';
  }

  return json.content
    .map((node) => {
      if (node.type === 'paragraph' && node.content) {
        return node.content.map((child) => child.text || '').join('');
      }

      return '';
    })
    .join('\n');
}

export function generateNoteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let index = 0; index < 6; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

export async function getNoteByCode(noteCode: string): Promise<Note | null> {
  const normalizedCode = normalizeNoteCode(noteCode);
  const rtdb = getRtdb();
  const snapshot = await get(ref(rtdb, `noteCodes/${normalizedCode}`));
  const data = snapshot.val() as Partial<NoteCodeRecord> | null;

  if (!data?.noteId) {
    return null;
  }

  return getNoteById(data.noteId);
}

export async function getNoteById(noteId: string): Promise<Note | null> {
  if (!noteId) {
    return null;
  }

  const snapshot = await get(ref(getRtdb(), `notes/${noteId}`));

  if (!snapshot.exists()) {
    return null;
  }

  return mapNote(noteId, snapshot.val() as Partial<NoteRecord> | null);
}

export async function getNoteList(
  cursor?: string,
  limit: number = 10,
  search?: string
): Promise<NoteListResponse> {
  const params = new URLSearchParams();

  if (cursor) {
    params.set('cursor', cursor);
  }

  params.set('limit', String(limit));

  if (search?.trim()) {
    params.set('search', search.trim());
  }

  const response = await fetch(`/api/notes?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || '노트 목록 조회 실패');
  }

  return response.json();
}

export async function updateNoteContent(noteId: string, content: string): Promise<Note> {
  return updateNoteContentJson(noteId, textToTiptapJson(content));
}

export async function updateNoteContentJson(
  noteId: string,
  contentJson: TiptapContent
): Promise<Note> {
  if (!noteId) {
    throw new Error('노트 업데이트 실패: 유효하지 않은 노트 ID입니다.');
  }

  const rtdb = getRtdb();
  const authUserId = await signInAnonymouslyIfNeeded();
  const now = Date.now();

  await update(ref(rtdb, `notes/${noteId}`), {
    contentJson,
    content: tiptapJsonToText(contentJson),
    lastModified: now,
    updatedAt: now,
    updatedBy: authUserId,
  });

  const note = await getNoteById(noteId);

  if (!note) {
    throw new Error('노트 업데이트 후 데이터를 찾을 수 없습니다.');
  }

  return note;
}

export async function updateNoteTitle(noteId: string, title: string): Promise<Note> {
  if (!noteId) {
    throw new Error('노트 제목 업데이트 실패: 유효하지 않은 노트 ID입니다.');
  }

  const rtdb = getRtdb();
  await signInAnonymouslyIfNeeded();

  await update(ref(rtdb, `notes/${noteId}`), {
    title,
    lastModified: Date.now(),
  });

  const note = await getNoteById(noteId);

  if (!note) {
    throw new Error('노트 제목 업데이트 후 데이터를 찾을 수 없습니다.');
  }

  return note;
}

export async function setNoteLock(
  noteId: string,
  isLocked: boolean,
  lockedBy: string | null
): Promise<Note> {
  if (!noteId) {
    throw new Error('노트 잠금 설정 실패: 유효하지 않은 노트 ID입니다.');
  }

  const rtdb = getRtdb();
  await signInAnonymouslyIfNeeded();

  await update(ref(rtdb, `notes/${noteId}`), {
    isLocked,
    lockedBy,
    lastModified: Date.now(),
  });

  const note = await getNoteById(noteId);

  if (!note) {
    throw new Error('노트 잠금 업데이트 후 데이터를 찾을 수 없습니다.');
  }

  return note;
}

export async function joinNote(
  noteId: string,
  userId: string,
  username: string,
  role: UserRole
): Promise<NoteUser> {
  if (!noteId || !userId) {
    throw new Error('노트 참여 실패: 유효하지 않은 파라미터입니다.');
  }

  const rtdb = getRtdb();
  await signInAnonymouslyIfNeeded();

  await set(ref(rtdb, `participants/${noteId}/${userId}`), {
    uid: userId,
    username,
    role,
    canEdit: role === 'host',
    permissionStatus: role === 'host' ? 'granted' : 'none',
    permissionRequestedAt: null,
    joinedAt: Date.now(),
  } satisfies ParticipantRecord);

  const participant = await getNoteUser(noteId, userId);

  if (!participant) {
    throw new Error('참여자 생성 후 데이터를 찾을 수 없습니다.');
  }

  return participant;
}

export async function leaveNote(noteId: string, userId: string): Promise<void> {
  if (!noteId || !userId) {
    return;
  }

  const rtdb = getRtdb();
  await signInAnonymouslyIfNeeded();

  await Promise.all([
    remove(ref(rtdb, `participants/${noteId}/${userId}`)),
    remove(ref(rtdb, `presence/${noteId}/${userId}`)),
    remove(ref(rtdb, `permissions/${noteId}/${userId}`)),
  ]);
}

export async function getNoteUsers(noteId: string): Promise<NoteUser[]> {
  if (!noteId) {
    return [];
  }

  const snapshot = await get(ref(getRtdb(), `participants/${noteId}`));
  const data = snapshot.val() as Record<string, Partial<ParticipantRecord>> | null;

  if (!data) {
    return [];
  }

  return Object.entries(data)
    .map(([uid, userData]) => mapNoteUser(noteId, uid, userData))
    .sort((left, right) => (
      new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime()
    ));
}

export async function getNoteUser(noteId: string, userId: string): Promise<NoteUser | null> {
  if (!noteId || !userId) {
    return null;
  }

  const snapshot = await get(ref(getRtdb(), `participants/${noteId}/${userId}`));

  if (!snapshot.exists()) {
    return null;
  }

  return mapNoteUser(noteId, userId, snapshot.val() as Partial<ParticipantRecord> | null);
}

export async function updateUserEditPermission(
  noteId: string,
  targetUserId: string,
  canEdit: boolean,
  requesterId: string
): Promise<NoteUser> {
  if (!noteId || !targetUserId || !requesterId) {
    throw new Error('권한 변경 실패: 유효하지 않은 파라미터입니다.');
  }

  const rtdb = getRtdb();
  await signInAnonymouslyIfNeeded();

  const requester = await getNoteUser(noteId, requesterId);

  if (!requester || requester.role !== 'host') {
    throw new Error('권한 변경 실패: 호스트만 편집 권한을 변경할 수 있습니다.');
  }

  const target = await getNoteUser(noteId, targetUserId);

  if (!target) {
    throw new Error('권한 변경 실패: 대상 사용자를 찾을 수 없습니다.');
  }

  if (target.role === 'host') {
    throw new Error('권한 변경 실패: 호스트의 권한은 변경할 수 없습니다.');
  }

  await Promise.all([
    update(ref(rtdb, `participants/${noteId}/${targetUserId}`), {
      canEdit,
      permissionStatus: canEdit ? 'granted' : 'none',
      permissionRequestedAt: null,
    }),
    set(ref(rtdb, `permissions/${noteId}/${targetUserId}`), {
      canEdit,
      permissionStatus: canEdit ? 'granted' : 'none',
      requestedAt: null,
    }),
  ]);

  const updated = await getNoteUser(noteId, targetUserId);

  if (!updated) {
    throw new Error('권한 변경 후 사용자 정보를 찾을 수 없습니다.');
  }

  return updated;
}

export async function cleanupExpiredRequests(noteId: string): Promise<void> {
  if (!noteId) {
    return;
  }

  const rtdb = getRtdb();
  const snapshot = await get(ref(rtdb, `participants/${noteId}`));
  const data = snapshot.val() as Record<string, ParticipantRecord> | null;

  if (!data) {
    return;
  }

  const expiryMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const updates: Record<string, unknown> = {};

  Object.entries(data).forEach(([uid, participant]) => {
    if (
      (participant.permissionStatus === 'requested' || participant.permissionStatus === 'denied') &&
      participant.permissionRequestedAt
    ) {
      const requestedAtMs = toTimestampMs(participant.permissionRequestedAt);

      if (requestedAtMs > 0 && now - requestedAtMs > expiryMs) {
        updates[`participants/${noteId}/${uid}/permissionStatus`] = 'none';
        updates[`participants/${noteId}/${uid}/permissionRequestedAt`] = null;
        updates[`participants/${noteId}/${uid}/canEdit`] = false;
      }
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(rtdb, '/'), updates);
  }
}

export function verifyPassword(): PasswordVerifyResult {
  console.warn('verifyPassword is deprecated. Use /api/notes/[code]/verify instead.');
  return { valid: false, role: null };
}
