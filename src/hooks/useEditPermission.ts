import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { updateUserEditPermission, getNoteUsers, cleanupExpiredRequests } from '@/lib/note-service';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { NoteUser, PermissionStatus } from '@/types/note';

/**
 * 편집 권한 관리 훅 옵션
 */
export interface UseEditPermissionOptions {
  /** 노트 코드 (API 호출용) */
  noteCode: string;
  /** 노트 UUID */
  noteId: string;
  /** 현재 사용자 UUID */
  userId: string;
  /** 현재 사용자가 호스트인지 여부 */
  isHost: boolean;
  /** 권한 변경 시 콜백 */
  onPermissionChange?: (userId: string, canEdit: boolean) => void;
  /** 권한 요청 수신 시 콜백 (호스트 전용) */
  onPermissionRequest?: (user: NoteUser) => void;
}

/**
 * 편집 권한 관리 훅 반환값
 */
export interface UseEditPermissionReturn {
  /** 현재 사용자의 편집 가능 여부 (호스트 또는 can_edit=true) */
  canEdit: boolean;
  /** 노트 참여자 목록 (can_edit 포함) */
  noteUsers: NoteUser[];
  /** 게스트의 편집 권한 토글 (호스트 전용) */
  toggleEditPermission: (targetUserId: string) => Promise<void>;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
  /** 현재 사용자의 권한 요청 상태 */
  permissionStatus: PermissionStatus;
  /** 편집 권한 요청 (게스트 전용) */
  requestEditPermission: () => Promise<void>;
  /** 권한 요청 응답 (호스트 전용) */
  respondToRequest: (targetUserId: string, approved: boolean) => Promise<void>;
  /** 요청 쿨다운 남은 시간 (초) */
  cooldownSeconds: number;
  /** 권한 요청 중인 사용자 목록 (호스트 전용) */
  pendingRequests: NoteUser[];
}

const COOLDOWN_DURATION = 30; // 쿨다운 30초

/**
 * 노트 편집 권한 실시간 관리 훅
 *
 * 기능:
 * - note_users 테이블의 can_edit, permission_status 변경 구독
 * - 호스트: 게스트의 편집 권한 토글 가능, 요청 승인/거부
 * - 게스트: 편집 권한 요청, 자신의 권한 변경 실시간 수신
 *
 * @param options - 훅 옵션
 * @returns 편집 권한 상태 및 액션
 */
export function useEditPermission({
  noteCode,
  noteId,
  userId,
  isHost,
  onPermissionChange,
  onPermissionRequest,
}: UseEditPermissionOptions): UseEditPermissionReturn {
  // 상태
  const [noteUsers, setNoteUsers] = useState<NoteUser[]>([]);
  const [canEdit, setCanEdit] = useState(isHost);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('none');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 권한 요청 중인 사용자 목록 (호스트 전용)
   */
  const pendingRequests = noteUsers.filter(
    (u) => u.role === 'guest' && u.permission_status === 'requested'
  );

  /**
   * 쿨다운 타이머 시작
   */
  const startCooldown = useCallback((seconds: number) => {
    setCooldownSeconds(seconds);

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }

    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /**
   * 노트 참여자 목록 조회
   */
  const fetchNoteUsers = useCallback(async () => {
    // noteId가 유효하지 않으면 조기 반환 (빈 문자열 UUID 오류 방지)
    if (!noteId || noteId === '') {
      return;
    }

    try {
      // 24시간 지난 요청 정리 (클라이언트에서 호출)
      await cleanupExpiredRequests(noteId);

      const users = await getNoteUsers(noteId);
      setNoteUsers(users);

      // 현재 사용자의 상태 업데이트
      const currentUser = users.find((u) => u.user_id === userId);
      if (currentUser) {
        setCanEdit(isHost || currentUser.can_edit === true);
        setPermissionStatus(currentUser.permission_status || 'none');

        // 쿨다운 계산 (요청 또는 거부 상태인 경우)
        if (
          currentUser.permission_requested_at &&
          (currentUser.permission_status === 'requested' ||
            currentUser.permission_status === 'denied')
        ) {
          const requestTime = new Date(currentUser.permission_requested_at).getTime();
          const elapsed = (Date.now() - requestTime) / 1000;
          const remaining = Math.max(0, Math.ceil(COOLDOWN_DURATION - elapsed));
          if (remaining > 0) {
            startCooldown(remaining);
          }
        }
      }
    } catch (err) {
      console.error('[useEditPermission] 참여자 목록 조회 실패:', err);
    }
  }, [noteId, userId, isHost, startCooldown]);

  /**
   * 게스트의 편집 권한 토글 (호스트 전용)
   */
  const toggleEditPermission = useCallback(
    async (targetUserId: string) => {
      if (!isHost) {
        throw new Error('호스트만 편집 권한을 변경할 수 있습니다.');
      }

      // noteId 또는 userId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
      if (!noteId || noteId === '') {
        throw new Error('노트 정보가 로드되지 않았습니다.');
      }
      if (!userId || userId === '') {
        throw new Error('사용자 정보가 없습니다.');
      }

      setIsLoading(true);
      setError(null);

      try {
        // 현재 권한 상태 확인
        const targetUser = noteUsers.find((u) => u.user_id === targetUserId);
        if (!targetUser) {
          throw new Error('대상 사용자를 찾을 수 없습니다.');
        }

        const newCanEdit = !targetUser.can_edit;

        // 서버에 권한 업데이트 요청
        await updateUserEditPermission(noteId, targetUserId, newCanEdit, userId);

        // 로컬 상태 즉시 업데이트 (Realtime이 오기 전에)
        setNoteUsers((prev) =>
          prev.map((u) =>
            u.user_id === targetUserId
              ? { ...u, can_edit: newCanEdit, permission_status: newCanEdit ? 'granted' : 'none' }
              : u
          )
        );
      } catch (err) {
        const permError = err instanceof Error ? err : new Error('권한 변경 실패');
        setError(permError);
        throw permError;
      } finally {
        setIsLoading(false);
      }
    },
    [isHost, noteId, userId, noteUsers]
  );

  /**
   * 편집 권한 요청 (게스트 전용)
   */
  const requestEditPermission = useCallback(async () => {
    if (isHost) {
      throw new Error('호스트는 이미 편집 권한이 있습니다.');
    }

    // noteCode 또는 userId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
    if (!noteCode || noteCode === '') {
      throw new Error('노트 정보가 로드되지 않았습니다.');
    }
    if (!userId || userId === '') {
      throw new Error('사용자 정보가 없습니다.');
    }

    if (cooldownSeconds > 0) {
      throw new Error(`${cooldownSeconds}초 후 다시 시도해주세요.`);
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${noteCode}/request-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 쿨다운 정보가 있으면 타이머 시작
        if (data.cooldownSeconds) {
          startCooldown(data.cooldownSeconds);
        }
        throw new Error(data.error || '권한 요청에 실패했습니다.');
      }

      // 요청 성공 시 쿨다운 시작
      startCooldown(COOLDOWN_DURATION);
      setPermissionStatus('requested');

      // 로컬 상태 업데이트
      setNoteUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? { ...u, permission_status: 'requested', permission_requested_at: new Date().toISOString() }
            : u
        )
      );
    } catch (err) {
      const reqError = err instanceof Error ? err : new Error('권한 요청 실패');
      setError(reqError);
      throw reqError;
    } finally {
      setIsLoading(false);
    }
  }, [isHost, noteCode, userId, cooldownSeconds, startCooldown]);

  /**
   * 권한 요청 응답 (호스트 전용)
   */
  const respondToRequest = useCallback(
    async (targetUserId: string, approved: boolean) => {
      if (!isHost) {
        throw new Error('호스트만 권한 요청에 응답할 수 있습니다.');
      }

      // noteCode 또는 userId가 유효하지 않으면 에러 발생 (빈 문자열 UUID 오류 방지)
      if (!noteCode || noteCode === '') {
        throw new Error('노트 정보가 로드되지 않았습니다.');
      }
      if (!userId || userId === '') {
        throw new Error('사용자 정보가 없습니다.');
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/notes/${noteCode}/respond-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostUserId: userId,
            targetUserId,
            approved,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '권한 응답에 실패했습니다.');
        }

        // 로컬 상태 업데이트
        setNoteUsers((prev) =>
          prev.map((u) =>
            u.user_id === targetUserId
              ? {
                  ...u,
                  can_edit: approved ? true : u.can_edit,
                  permission_status: approved ? 'granted' : 'denied',
                }
              : u
          )
        );
      } catch (err) {
        const respError = err instanceof Error ? err : new Error('권한 응답 실패');
        setError(respError);
        throw respError;
      } finally {
        setIsLoading(false);
      }
    },
    [isHost, noteCode, userId]
  );

  /**
   * Realtime 채널 구독 (note_users 테이블 변경 감지)
   * 주의: 콜백 함수들은 종속성에서 제외하여 무한 루프 방지
   */
  useEffect(() => {
    // noteId가 유효하지 않으면 구독하지 않음 (빈 문자열 UUID 오류 방지)
    if (!noteId || noteId === '') {
      return;
    }

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`note-users-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'note_users',
          filter: `note_id=eq.${noteId}`,
        },
        (payload) => {
          const updatedUser = payload.new as NoteUser;

          // 로컬 상태 업데이트
          setNoteUsers((prev) =>
            prev.map((u) =>
              u.user_id === updatedUser.user_id ? { ...u, ...updatedUser } : u
            )
          );

          // 현재 사용자의 권한이 변경된 경우
          if (updatedUser.user_id === userId) {
            const newCanEdit = isHost || updatedUser.can_edit === true;
            setCanEdit(newCanEdit);
            setPermissionStatus(updatedUser.permission_status || 'none');

            // 승인된 경우 쿨다운 해제
            if (updatedUser.permission_status === 'granted') {
              setCooldownSeconds(0);
              if (cooldownTimerRef.current) {
                clearInterval(cooldownTimerRef.current);
                cooldownTimerRef.current = null;
              }
            }
          }

          // 콜백 호출 - 클로저로 캡처된 값 사용
          if (onPermissionChange && updatedUser.can_edit !== undefined) {
            onPermissionChange(updatedUser.user_id, updatedUser.can_edit);
          }

          // 호스트에게 권한 요청 알림
          if (
            isHost &&
            updatedUser.permission_status === 'requested' &&
            onPermissionRequest
          ) {
            onPermissionRequest(updatedUser);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'note_users',
          filter: `note_id=eq.${noteId}`,
        },
        (payload) => {
          const newUser = payload.new as NoteUser;
          setNoteUsers((prev) => {
            // 중복 방지
            if (prev.some((u) => u.user_id === newUser.user_id)) {
              return prev;
            }
            return [...prev, newUser];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'note_users',
          filter: `note_id=eq.${noteId}`,
        },
        (payload) => {
          const deletedUser = payload.old as NoteUser;
          setNoteUsers((prev) =>
            prev.filter((u) => u.user_id !== deletedUser.user_id)
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useEditPermission] 편집 권한 구독 연결됨');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[useEditPermission] 편집 권한 구독 실패:', status);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, userId, isHost]); // 콜백 함수들은 제외하여 무한 루프 방지

  /**
   * 초기 데이터 로드 (별도 useEffect로 분리)
   */
  useEffect(() => {
    if (!noteId || noteId === '') {
      return;
    }
    fetchNoteUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]); // fetchNoteUsers는 제외하여 무한 루프 방지

  // 호스트는 항상 편집 가능
  useEffect(() => {
    if (isHost) {
      setCanEdit(true);
    }
  }, [isHost]);

  return {
    canEdit,
    noteUsers,
    toggleEditPermission,
    isLoading,
    error,
    permissionStatus,
    requestEditPermission,
    respondToRequest,
    cooldownSeconds,
    pendingRequests,
  };
}
