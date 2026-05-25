import bcrypt from 'bcrypt';
import type { Note, NoteUser, NoteVisibility, PermissionStatus, TiptapContent, UserRole } from '@/types/note';
import { getAdminRtdb } from './firebase-admin';

const PEPPER = process.env.PASSWORD_PEPPER || '';
const SALT_ROUNDS = 12;
const NOTE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NOTE_CODE_ATTEMPTS = 5;
const REQUEST_COOLDOWN_SECONDS = 30;

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

export type ServiceError = Error & {
  status?: number;
  code?: string;
  cooldownSeconds?: number;
};

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

type NoteSecretRecord = {
  hostHash: string;
  guestHash: string;
  createdAt: number;
};

type NoteCodeRecord = {
  noteId: string;
  createdAt: number;
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

type PermissionRecord = {
  canEdit: boolean;
  permissionStatus: PermissionStatus;
  requestedAt: number | string | null;
};

function createServiceError(
  message: string,
  status: number,
  code: string,
  extras: Partial<ServiceError> = {}
): ServiceError {
  return Object.assign(new Error(message), { status, code, ...extras });
}

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

export function normalizeNoteVisibility(value: unknown): NoteVisibility {
  return value === 'unlisted' ? 'unlisted' : 'public';
}

function compareNoteListItems(left: NoteListItem, right: NoteListItem): number {
  const byLastModified = toTimestampMs(right.last_modified) - toTimestampMs(left.last_modified);

  if (byLastModified !== 0) {
    return byLastModified;
  }

  return right.id.localeCompare(left.id);
}

function mapNoteListItem(noteId: string, noteData: Partial<NoteRecord> | null | undefined): NoteListItem {
  return {
    id: noteId,
    note_code: noteData?.noteCode ?? '',
    title: noteData?.title ?? '',
    created_at: toIsoString(noteData?.createdAt),
    last_modified: toIsoString(noteData?.lastModified),
  };
}

export function mapAdminNote(noteId: string, noteData: Partial<NoteRecord> | null | undefined): Note {
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

export function mapAdminNoteUser(
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

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain + PEPPER, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain + PEPPER, hash);
}

export function generateNoteCode(): string {
  let code = '';

  for (let index = 0; index < 6; index += 1) {
    code += NOTE_CODE_CHARS.charAt(Math.floor(Math.random() * NOTE_CODE_CHARS.length));
  }

  return code;
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

export async function getNoteIdByCode(noteCode: string): Promise<string | null> {
  const normalizedCode = normalizeNoteCode(noteCode);

  if (!normalizedCode) {
    return null;
  }

  const snapshot = await getAdminRtdb().ref(`noteCodes/${normalizedCode}`).get();
  const data = snapshot.val() as Partial<NoteCodeRecord> | null;

  return typeof data?.noteId === 'string' ? data.noteId : null;
}

export async function getAdminNoteById(noteId: string): Promise<Note | null> {
  if (!noteId) {
    return null;
  }

  const snapshot = await getAdminRtdb().ref(`notes/${noteId}`).get();

  if (!snapshot.exists()) {
    return null;
  }

  return mapAdminNote(noteId, snapshot.val() as Partial<NoteRecord> | null);
}

export async function getAdminNoteByCode(noteCode: string): Promise<Note | null> {
  const noteId = await getNoteIdByCode(noteCode);

  if (!noteId) {
    return null;
  }

  return getAdminNoteById(noteId);
}

export async function createNoteWithPasswords(
  title: string,
  hostPassword: string,
  guestPassword: string,
  visibility: NoteVisibility = 'public'
): Promise<Note & { participantId: string }> {
  const rtdb = getAdminRtdb();
  const hostUid = crypto.randomUUID();
  const [hostHash, guestHash] = await Promise.all([
    hashPassword(hostPassword),
    hashPassword(guestPassword),
  ]);

  for (let attempt = 0; attempt < MAX_NOTE_CODE_ATTEMPTS; attempt += 1) {
    const noteId = crypto.randomUUID();
    const noteCode = generateNoteCode();
    const now = Date.now();
    const codeRef = rtdb.ref(`noteCodes/${noteCode}`);
    const codeResult = await codeRef.transaction((current) => (
      current === null
        ? ({ noteId, createdAt: now } satisfies NoteCodeRecord)
        : undefined
    ));

    if (!codeResult.committed) {
      continue;
    }

    try {
      await rtdb.ref('/').update({
        [`notes/${noteId}`]: {
          noteId,
          noteCode,
          title,
          visibility: normalizeNoteVisibility(visibility),
          isLocked: false,
          lockedBy: null,
          createdAt: now,
          lastModified: now,
          content: '',
          contentJson: null,
          updatedAt: now,
          updatedBy: hostUid,
        } satisfies NoteRecord,
        [`noteSecrets/${noteId}`]: {
          hostHash,
          guestHash,
          createdAt: now,
        } satisfies NoteSecretRecord,
        [`participants/${noteId}/${hostUid}`]: {
          uid: hostUid,
          username: '호스트',
          role: 'host',
          canEdit: true,
          permissionStatus: 'granted',
          permissionRequestedAt: null,
          joinedAt: now,
        } satisfies ParticipantRecord,
      });

      const note = await getAdminNoteById(noteId);

      if (!note) {
        throw createServiceError('생성된 노트를 찾을 수 없습니다.', 500, 'NOTE_NOT_FOUND_AFTER_CREATE');
      }

      return {
        ...note,
        participantId: hostUid,
      };
    } catch (error) {
      await codeRef.remove().catch(() => undefined);
      throw error;
    }
  }

  throw createServiceError('노트 코드 생성 실패: 최대 시도 횟수 초과', 500, 'NOTE_CODE_GENERATION_FAILED');
}

export async function listNotes(
  cursor?: string,
  limit: number = 10,
  search?: string
): Promise<NoteListResponse> {
  const rtdb = getAdminRtdb();
  const notesQuery = rtdb.ref('notes').orderByChild('lastModified');
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const trimmedSearch = search?.trim();
  const snapshot = trimmedSearch
    ? await notesQuery.get()
    : cursor
      ? await (async () => {
          const cursorSnapshot = await rtdb.ref(`notes/${cursor}`).get();
          const cursorData = cursorSnapshot.val() as Partial<NoteRecord> | null;
          const cursorLastModified = toTimestampMs(cursorData?.lastModified);

          if (cursorSnapshot.exists() && cursorLastModified > 0) {
            return notesQuery.endAt(cursorLastModified).get();
          }

          return notesQuery.limitToLast(safeLimit + 1).get();
        })()
      : await notesQuery.limitToLast(safeLimit + 1).get();

  const data = snapshot.val() as Record<string, Partial<NoteRecord>> | null;

  if (!data) {
    return {
      notes: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  let items = Object.entries(data)
    .filter(([, noteData]) => normalizeNoteVisibility(noteData?.visibility) === 'public')
    .map(([noteId, noteData]) => mapNoteListItem(noteId, noteData))
    .filter((item) => item.note_code !== '')
    .sort(compareNoteListItems);

  if (trimmedSearch) {
    const normalizedCode = normalizeNoteCode(trimmedSearch);
    const searchLower = trimmedSearch.toLowerCase();

    items = items.filter((item) => (
      item.note_code?.toUpperCase().startsWith(normalizedCode) || item.title.toLowerCase().includes(searchLower)
    ));
  }

  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor);

    if (cursorIndex >= 0) {
      items = items.slice(cursorIndex + 1);
    }
  }

  const hasMore = items.length > safeLimit;
  const notes = hasMore ? items.slice(0, safeLimit) : items;

  return {
    notes,
    nextCursor: hasMore ? notes[notes.length - 1]?.id ?? null : null,
    hasMore,
  };
}

export async function updateNoteByCode(
  noteCode: string,
  updates: {
    title?: string;
    content?: string;
    contentJson?: TiptapContent | null;
    updatedBy?: string;
  }
): Promise<Note | null> {
  const noteId = await getNoteIdByCode(noteCode);

  if (!noteId) {
    return null;
  }

  if (
    updates.title === undefined &&
    updates.content === undefined &&
    updates.contentJson === undefined
  ) {
    return getAdminNoteById(noteId);
  }

  const now = Date.now();
  const nextUpdates: Record<string, unknown> = {
    lastModified: now,
  };

  if (updates.title !== undefined) {
    nextUpdates.title = updates.title;
  }

  if (updates.content !== undefined || updates.contentJson !== undefined) {
    const nextContentJson = updates.contentJson !== undefined
      ? updates.contentJson
      : textToTiptapJson(updates.content ?? '');
    const nextContent = updates.content !== undefined
      ? updates.content
      : tiptapJsonToText(nextContentJson);

    nextUpdates.contentJson = nextContentJson;
    nextUpdates.content = nextContent;
    nextUpdates.updatedAt = now;
    nextUpdates.updatedBy = updates.updatedBy ?? 'system';
  }

  await getAdminRtdb().ref(`notes/${noteId}`).update(nextUpdates);
  return getAdminNoteById(noteId);
}

export async function deleteNoteByCode(noteCode: string, password: string): Promise<boolean> {
  const normalizedCode = normalizeNoteCode(noteCode);
  const noteId = await getNoteIdByCode(normalizedCode);

  if (!noteId) {
    return false;
  }

  const rtdb = getAdminRtdb();
  const secretSnapshot = await rtdb.ref(`noteSecrets/${noteId}`).get();
  const secretData = secretSnapshot.val() as Partial<NoteSecretRecord> | null;

  if (!secretData?.hostHash) {
    return false;
  }

  const valid = await verifyPassword(password, secretData.hostHash);

  if (!valid) {
    return false;
  }

  await rtdb.ref('/').update({
    [`notes/${noteId}`]: null,
    [`noteSecrets/${noteId}`]: null,
    [`noteCodes/${normalizedCode}`]: null,
    [`participants/${noteId}`]: null,
    [`permissions/${noteId}`]: null,
    [`presence/${noteId}`]: null,
    [`hostStatus/${noteId}`]: null,
    [`awareness/${noteId}`]: null,
  });

  return true;
}

export async function verifyNoteAccess(
  noteCode: string,
  password: string,
  nickname?: string
): Promise<{
  valid: boolean;
  role: UserRole | null;
  noteId: string | null;
  userId: string | null;
  note: Note | null;
}> {
  const normalizedCode = normalizeNoteCode(noteCode);
  const noteId = await getNoteIdByCode(normalizedCode);

  if (!noteId) {
    return {
      valid: false,
      role: null,
      noteId: null,
      userId: null,
      note: null,
    };
  }

  const rtdb = getAdminRtdb();
  const secretSnapshot = await rtdb.ref(`noteSecrets/${noteId}`).get();
  const secretData = secretSnapshot.val() as Partial<NoteSecretRecord> | null;
  const isHost = secretData?.hostHash ? await verifyPassword(password, secretData.hostHash) : false;
  const isGuest = !isHost && secretData?.guestHash ? await verifyPassword(password, secretData.guestHash) : false;

  if (!isHost && !isGuest) {
    return {
      valid: false,
      role: null,
      noteId,
      userId: null,
      note: null,
    };
  }

  const role: UserRole = isHost ? 'host' : 'guest';
  const userId = crypto.randomUUID();
  const username = nickname?.trim() || (role === 'host' ? '호스트' : '게스트');
  const now = Date.now();
  const participantsSnapshot = await rtdb.ref(`participants/${noteId}`).get();
  const participants = participantsSnapshot.val() as Record<string, Partial<ParticipantRecord>> | null;
  const updates: Record<string, unknown> = {
    [`participants/${noteId}/${userId}`]: {
      uid: userId,
      username,
      role,
      canEdit: role === 'host',
      permissionStatus: role === 'host' ? 'granted' : 'none',
      permissionRequestedAt: null,
      joinedAt: now,
    } satisfies ParticipantRecord,
  };

  if (role === 'host') {
    Object.entries(participants ?? {}).forEach(([participantId, participant]) => {
      if (participant.role === 'host' && participantId !== userId) {
        updates[`participants/${noteId}/${participantId}`] = null;
        return;
      }

      if (participant.role === 'guest') {
        updates[`participants/${noteId}/${participantId}/canEdit`] = false;
        updates[`participants/${noteId}/${participantId}/permissionStatus`] = 'none';
        updates[`participants/${noteId}/${participantId}/permissionRequestedAt`] = null;
      }
    });

    updates[`permissions/${noteId}`] = null;
    updates[`hostStatus/${noteId}`] = {
      online: true,
      lastSeen: now,
    };
  }

  await rtdb.ref('/').update(updates);

  return {
    valid: true,
    role,
    noteId,
    userId,
    note: await getAdminNoteById(noteId),
  };
}

export async function requestEditPermissionForUser(noteCode: string, userId: string): Promise<NoteUser> {
  const normalizedCode = normalizeNoteCode(noteCode);
  const noteId = await getNoteIdByCode(normalizedCode);

  if (!noteId) {
    throw createServiceError('노트를 찾을 수 없습니다.', 404, 'NOTE_NOT_FOUND');
  }

  const rtdb = getAdminRtdb();
  const participantRef = rtdb.ref(`participants/${noteId}/${userId}`);
  const participantSnapshot = await participantRef.get();

  if (!participantSnapshot.exists()) {
    throw createServiceError('사용자를 찾을 수 없습니다.', 404, 'PARTICIPANT_NOT_FOUND');
  }

  const participant = participantSnapshot.val() as Partial<ParticipantRecord> | null;
  const role = participant?.role === 'host' ? 'host' : 'guest';

  if (role === 'host') {
    throw createServiceError('호스트는 이미 편집 권한이 있습니다.', 400, 'HOST_ALREADY_CAN_EDIT');
  }

  if (participant?.canEdit) {
    throw createServiceError('이미 편집 권한이 있습니다.', 400, 'ALREADY_CAN_EDIT');
  }

  const requestedAtMs = toTimestampMs(participant?.permissionRequestedAt);
  const isCoolingDown = participant?.permissionStatus === 'requested' || participant?.permissionStatus === 'denied';

  if (isCoolingDown && requestedAtMs > 0) {
    const elapsedSeconds = Math.floor((Date.now() - requestedAtMs) / 1000);

    if (elapsedSeconds < REQUEST_COOLDOWN_SECONDS) {
      throw createServiceError(
        `${REQUEST_COOLDOWN_SECONDS - elapsedSeconds}초 후 다시 시도해주세요.`,
        400,
        'REQUEST_COOLDOWN',
        {
          cooldownSeconds: REQUEST_COOLDOWN_SECONDS - elapsedSeconds,
        }
      );
    }
  }

  const now = Date.now();
  await rtdb.ref('/').update({
    [`participants/${noteId}/${userId}/permissionStatus`]: 'requested',
    [`participants/${noteId}/${userId}/permissionRequestedAt`]: now,
    [`permissions/${noteId}/${userId}`]: {
      canEdit: false,
      permissionStatus: 'requested',
      requestedAt: now,
    } satisfies PermissionRecord,
  });

  const updatedSnapshot = await participantRef.get();
  return mapAdminNoteUser(noteId, userId, updatedSnapshot.val() as Partial<ParticipantRecord> | null);
}

export async function respondToEditPermission(
  noteCode: string,
  hostUserId: string,
  targetUserId: string,
  approved: boolean
): Promise<NoteUser> {
  const normalizedCode = normalizeNoteCode(noteCode);
  const noteId = await getNoteIdByCode(normalizedCode);

  if (!noteId) {
    throw createServiceError('노트를 찾을 수 없습니다.', 404, 'NOTE_NOT_FOUND');
  }

  const rtdb = getAdminRtdb();
  const [hostSnapshot, targetSnapshot] = await Promise.all([
    rtdb.ref(`participants/${noteId}/${hostUserId}`).get(),
    rtdb.ref(`participants/${noteId}/${targetUserId}`).get(),
  ]);

  const hostParticipant = hostSnapshot.val() as Partial<ParticipantRecord> | null;
  const targetParticipant = targetSnapshot.val() as Partial<ParticipantRecord> | null;

  if (!hostSnapshot.exists() || hostParticipant?.role !== 'host') {
    throw createServiceError('호스트만 권한 요청에 응답할 수 있습니다.', 403, 'HOST_ONLY');
  }

  if (!targetSnapshot.exists()) {
    throw createServiceError('대상 사용자를 찾을 수 없습니다.', 404, 'TARGET_NOT_FOUND');
  }

  if (targetParticipant?.role === 'host') {
    throw createServiceError('호스트의 권한은 변경할 수 없습니다.', 400, 'HOST_PERMISSION_IMMUTABLE');
  }

  if (targetParticipant?.permissionStatus !== 'requested') {
    throw createServiceError('대상 사용자가 권한 요청 상태가 아닙니다.', 400, 'TARGET_NOT_REQUESTED');
  }

  const requestedAt = approved ? null : Date.now();
  await rtdb.ref('/').update({
    [`participants/${noteId}/${targetUserId}/canEdit`]: approved,
    [`participants/${noteId}/${targetUserId}/permissionStatus`]: approved ? 'granted' : 'denied',
    [`participants/${noteId}/${targetUserId}/permissionRequestedAt`]: requestedAt,
    [`permissions/${noteId}/${targetUserId}/canEdit`]: approved,
    [`permissions/${noteId}/${targetUserId}/permissionStatus`]: approved ? 'granted' : 'denied',
    [`permissions/${noteId}/${targetUserId}/requestedAt`]: requestedAt,
  });

  const updatedSnapshot = await rtdb.ref(`participants/${noteId}/${targetUserId}`).get();
  return mapAdminNoteUser(noteId, targetUserId, updatedSnapshot.val() as Partial<ParticipantRecord> | null);
}

export async function leaveNoteByCode(noteCode: string, userId: string): Promise<void> {
  const normalizedCode = normalizeNoteCode(noteCode);
  const noteId = await getNoteIdByCode(normalizedCode);

  if (!noteId || !userId) {
    return;
  }

  const rtdb = getAdminRtdb();
  const participantSnapshot = await rtdb.ref(`participants/${noteId}/${userId}`).get();
  const participant = participantSnapshot.val() as Partial<ParticipantRecord> | null;
  const isHost = participant?.role === 'host';

  await rtdb.ref('/').update({
    [`participants/${noteId}/${userId}`]: null,
    [`presence/${noteId}/${userId}`]: null,
    [`permissions/${noteId}/${userId}`]: null,
  });

  if (isHost) {
    await rtdb.ref(`hostStatus/${noteId}`).update({
      online: false,
      lastSeen: Date.now(),
    });
  }
}

export function getErrorStatus(error: unknown, fallbackStatus: number = 500): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as ServiceError).status;

    if (typeof status === 'number') {
      return status;
    }
  }

  return fallbackStatus;
}

export function getErrorCooldown(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'cooldownSeconds' in error) {
    const cooldownSeconds = (error as ServiceError).cooldownSeconds;

    if (typeof cooldownSeconds === 'number') {
      return cooldownSeconds;
    }
  }

  return undefined;
}
