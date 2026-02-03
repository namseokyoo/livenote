import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { UserRole } from '@/types/note';

/**
 * Presence 사용자 정보
 */
export interface PresenceUser {
  /** 사용자 UUID */
  id: string;
  /** 사용자 이름 */
  username: string;
  /** 사용자 역할 */
  role: UserRole;
  /** 접속 시간 */
  online_at: string;
  /** 게스트 편집 권한 */
  can_edit?: boolean;
}

/**
 * Presence 훅 옵션
 */
export interface UsePresenceOptions {
  /** 노트 UUID */
  noteId: string;
  /** 사용자 UUID */
  userId: string;
  /** 사용자 이름 */
  username: string;
  /** 사용자 역할 */
  role: UserRole;
}

/**
 * Presence 훅 반환값
 */
export interface UsePresenceReturn {
  /** 현재 접속자 목록 */
  users: PresenceUser[];
  /** Presence 연결 상태 */
  isConnected: boolean;
  /** 연결 에러 */
  error: Error | null;
}

/** 재연결 시도 최대 횟수 */
const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * 노트 접속자 현황 실시간 관리 훅
 *
 * Supabase Presence 채널을 활용하여:
 * - 접속/퇴장 실시간 감지
 * - 현재 접속자 목록 관리
 * - 컴포넌트 언마운트 시 자동 퇴장
 *
 * @param options - 훅 옵션
 * @returns 접속자 목록 및 연결 상태
 */
export function usePresence({
  noteId,
  userId,
  username,
  role,
}: UsePresenceOptions): UsePresenceReturn {
  // 상태
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);

  /**
   * Presence 상태에서 사용자 목록 추출
   */
  const extractUsers = useCallback((presenceState: Record<string, unknown[]>): PresenceUser[] => {
    const userList: PresenceUser[] = [];

    Object.values(presenceState).forEach((presences) => {
      presences.forEach((presence) => {
        const user = presence as PresenceUser;
        if (user.id) {
          userList.push(user);
        }
      });
    });

    // 접속 시간 순 정렬
    return userList.sort(
      (a, b) => new Date(a.online_at).getTime() - new Date(b.online_at).getTime()
    );
  }, []);

  /**
   * Presence 채널 구독
   */
  const subscribeToPresence = useCallback(() => {
    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`presence-${noteId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userList = extractUsers(state);
        setUsers(userList);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[usePresence] 사용자 접속:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[usePresence] 사용자 퇴장:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 자신의 Presence 상태 전송
          const trackResult = await channel.track({
            id: userId,
            username,
            role,
            online_at: new Date().toISOString(),
          });

          if (trackResult === 'ok') {
            setIsConnected(true);
            setError(null);
            reconnectAttemptsRef.current = 0;
            console.log('[usePresence] Presence 연결됨');
          } else {
            console.error('[usePresence] Presence 트래킹 실패:', trackResult);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setError(new Error(`Presence 연결 실패: ${status}`));
          console.error('[usePresence] Presence 연결 실패:', status);

          // 재연결 시도
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            setTimeout(subscribeToPresence, 1000 * reconnectAttemptsRef.current);
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('[usePresence] Presence 연결 종료');
        }
      });

    channelRef.current = channel;
  }, [noteId, userId, username, role, extractUsers]);

  /**
   * Presence 채널 구독 및 정리
   */
  useEffect(() => {
    subscribeToPresence();

    return () => {
      // 채널 정리 (자동으로 Presence에서 제거됨)
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribeToPresence]);

  return {
    users,
    isConnected,
    error,
  };
}
