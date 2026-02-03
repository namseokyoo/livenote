import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { setNoteLock } from '@/lib/note-service';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { UserRole } from '@/types/note';

/**
 * 노트 잠금 훅 옵션
 */
export interface UseNoteLockOptions {
  /** 노트 UUID */
  noteId: string;
  /** 사용자 UUID */
  userId: string;
  /** 사용자 역할 */
  role: UserRole;
  /** 초기 잠금 상태 */
  initialLocked?: boolean;
  /** 초기 잠금 소유자 */
  initialLockedBy?: string | null;
}

/**
 * 노트 잠금 훅 반환값
 */
export interface UseNoteLockReturn {
  /** 노트 잠금 여부 */
  isLocked: boolean;
  /** 잠금을 건 사용자 ID */
  lockedBy: string | null;
  /** 현재 사용자가 편집 가능한지 여부 */
  canEdit: boolean;
  /** 잠금 요청 (호스트만 가능) */
  requestLock: () => Promise<boolean>;
  /** 잠금 해제 (호스트만 가능) */
  releaseLock: () => Promise<void>;
  /** Realtime 연결 상태 */
  isConnected: boolean;
  /** 에러 */
  error: Error | null;
}

/** 재연결 시도 최대 횟수 */
const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * 노트 잠금 관리 훅
 *
 * 동시 편집 방지를 위한 Lock 시스템:
 * - MVP 단순화: 호스트만 편집 가능
 * - 게스트는 읽기 전용
 * - 잠금 상태 실시간 동기화
 *
 * @param options - 훅 옵션
 * @returns 잠금 상태 및 액션
 */
export function useNoteLock({
  noteId,
  userId,
  role,
  initialLocked = false,
  initialLockedBy = null,
}: UseNoteLockOptions): UseNoteLockReturn {
  // 상태
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [lockedBy, setLockedBy] = useState<string | null>(initialLockedBy);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);

  /**
   * 현재 사용자가 편집 가능한지 계산
   *
   * MVP 규칙:
   * - 호스트: 항상 편집 가능
   * - 게스트: 항상 읽기 전용
   */
  const canEdit = role === 'host';

  /**
   * 잠금 상태 실시간 구독
   */
  const subscribeToLock = useCallback(() => {
    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`lock-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${noteId}`,
        },
        (payload) => {
          const newData = payload.new as { is_locked: boolean; locked_by: string | null };
          setIsLocked(newData.is_locked);
          setLockedBy(newData.locked_by);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          console.log('[useNoteLock] Realtime 연결됨');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setError(new Error(`Lock 연결 실패: ${status}`));
          console.error('[useNoteLock] Realtime 연결 실패:', status);

          // 재연결 시도
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            setTimeout(subscribeToLock, 1000 * reconnectAttemptsRef.current);
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('[useNoteLock] Realtime 연결 종료');
        }
      });

    channelRef.current = channel;
  }, [noteId]);

  /**
   * 잠금 요청
   *
   * @returns 잠금 성공 여부
   */
  const requestLock = useCallback(async (): Promise<boolean> => {
    // 호스트만 잠금 가능
    if (role !== 'host') {
      setError(new Error('게스트는 잠금을 설정할 수 없습니다'));
      return false;
    }

    // 이미 잠금 상태면 성공 반환
    if (isLocked && lockedBy === userId) {
      return true;
    }

    try {
      await setNoteLock(noteId, true, userId);
      setIsLocked(true);
      setLockedBy(userId);
      setError(null);
      return true;
    } catch (err) {
      const lockError = err instanceof Error ? err : new Error('잠금 설정 실패');
      setError(lockError);
      return false;
    }
  }, [noteId, userId, role, isLocked, lockedBy]);

  /**
   * 잠금 해제
   */
  const releaseLock = useCallback(async (): Promise<void> => {
    // 호스트만 잠금 해제 가능
    if (role !== 'host') {
      setError(new Error('게스트는 잠금을 해제할 수 없습니다'));
      return;
    }

    // 본인이 잠금을 건 경우에만 해제 가능
    if (lockedBy !== userId && lockedBy !== null) {
      setError(new Error('다른 사용자가 설정한 잠금은 해제할 수 없습니다'));
      return;
    }

    try {
      await setNoteLock(noteId, false, null);
      setIsLocked(false);
      setLockedBy(null);
      setError(null);
    } catch (err) {
      const unlockError = err instanceof Error ? err : new Error('잠금 해제 실패');
      setError(unlockError);
      throw unlockError;
    }
  }, [noteId, userId, role, lockedBy]);

  /**
   * Realtime 구독 설정 및 정리
   */
  useEffect(() => {
    subscribeToLock();

    return () => {
      // 채널 정리
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribeToLock]);

  /**
   * 컴포넌트 언마운트 시 잠금 해제 (호스트인 경우)
   */
  useEffect(() => {
    return () => {
      // 호스트이고 본인이 잠금을 건 경우 해제
      if (role === 'host' && lockedBy === userId && isLocked) {
        setNoteLock(noteId, false, null).catch(console.error);
      }
    };
  }, [noteId, userId, role, isLocked, lockedBy]);

  return {
    isLocked,
    lockedBy,
    canEdit,
    requestLock,
    releaseLock,
    isConnected,
    error,
  };
}
