/**
 * LiveNote 커스텀 훅 모음
 *
 * 실시간 동기화 기능을 위한 훅들:
 * - useRealtimeNote: 노트 내용 실시간 동기화
 * - usePresence: 접속자 현황 관리
 * - useNoteLock: 노트 잠금 관리
 */

export { useRealtimeNote } from './useRealtimeNote';
export type {
  UseRealtimeNoteOptions,
  UseRealtimeNoteReturn,
} from './useRealtimeNote';

export { usePresence } from './usePresence';
export type {
  PresenceUser,
  UsePresenceOptions,
  UsePresenceReturn,
} from './usePresence';

export { useNoteLock } from './useNoteLock';
export type {
  UseNoteLockOptions,
  UseNoteLockReturn,
} from './useNoteLock';

export { useEditPermission } from './useEditPermission';
export type {
  UseEditPermissionOptions,
  UseEditPermissionReturn,
} from './useEditPermission';
