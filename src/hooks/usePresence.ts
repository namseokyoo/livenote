'use client';

import { useEffect, useMemo, useState } from 'react';
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from 'firebase/database';
import { getRtdb, signInAnonymouslyIfNeeded } from '@/lib/firebase';
import type { UserRole } from '@/types/note';

export interface PresenceUser {
  id: string;
  username: string;
  role: UserRole;
  online_at: string;
  can_edit?: boolean;
}

export interface UsePresenceOptions {
  noteId: string;
  userId: string;
  username: string;
  role: UserRole;
}

export interface UsePresenceReturn {
  users: PresenceUser[];
  isConnected: boolean;
  error: Error | null;
  isHostOnline: boolean;
}

function toIso(value: unknown): string {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date().toISOString();
}

export function usePresence({ noteId, userId, username, role }: UsePresenceOptions): UsePresenceReturn {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isHostOnline, setIsHostOnline] = useState(role === 'host');

  const safeUsername = useMemo(() => username || (role === 'host' ? '호스트' : '게스트'), [role, username]);

  useEffect(() => {
    if (!noteId || !userId) {
      return;
    }

    let unsubscribePresence: () => void = () => {};
    let unsubscribeHostStatus: () => void = () => {};
    let disposed = false;
    const rtdb = getRtdb();
    const presenceRef = ref(rtdb, `presence/${noteId}/${userId}`);
    const roomPresenceRef = ref(rtdb, `presence/${noteId}`);
    const hostStatusRef = ref(rtdb, `hostStatus/${noteId}`);

    const connect = async () => {
      try {
        await signInAnonymouslyIfNeeded();
        if (disposed) {
          return;
        }

        await set(presenceRef, {
          username: safeUsername,
          role,
          connectedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        });
        await onDisconnect(presenceRef).remove();

        if (role === 'host') {
          await set(hostStatusRef, {
            online: true,
            lastSeen: serverTimestamp(),
          });
          await onDisconnect(hostStatusRef).set({
            online: false,
            lastSeen: serverTimestamp(),
          });
          setIsHostOnline(true);
        }

        unsubscribePresence = onValue(
          roomPresenceRef,
          (snapshot) => {
            setIsConnected(true);
            setError(null);

            const value = snapshot.val() as Record<string, { username?: string; role?: UserRole; connectedAt?: number }> | null;
            const nextUsers: PresenceUser[] = value
              ? Object.entries(value).map(([id, entry]) => ({
                  id,
                  username: entry.username || (entry.role === 'host' ? '호스트' : '게스트'),
                  role: (entry.role === 'host' ? 'host' : 'guest') as UserRole,
                  online_at: toIso(entry.connectedAt),
                }))
              : [];

            nextUsers.sort((left, right) =>
              new Date(left.online_at).getTime() - new Date(right.online_at).getTime()
            );
            setUsers(nextUsers);
          },
          (databaseError) => {
            setIsConnected(false);
            setError(databaseError instanceof Error ? databaseError : new Error('Presence 연결 실패'));
          }
        );

        unsubscribeHostStatus = onValue(
          hostStatusRef,
          (snapshot) => {
            if (role === 'host') {
              setIsHostOnline(true);
              return;
            }

            const status = snapshot.val() as { online?: boolean } | null;
            setIsHostOnline(Boolean(status?.online));
          },
          () => {
            if (role !== 'host') {
              setIsHostOnline(false);
            }
          }
        );
      } catch (err) {
        setIsConnected(false);
        setError(err instanceof Error ? err : new Error('Presence 연결 실패'));
      }
    };

    void connect();

    return () => {
      disposed = true;
      unsubscribePresence();
      unsubscribeHostStatus();
      void onDisconnect(presenceRef).cancel().catch(() => undefined);
      void remove(presenceRef).catch(() => undefined);
      if (role === 'host') {
        void onDisconnect(hostStatusRef).cancel().catch(() => undefined);
        void set(hostStatusRef, { online: false, lastSeen: serverTimestamp() }).catch(() => undefined);
      }
    };
  }, [noteId, role, safeUsername, userId]);

  return {
    users: noteId && userId ? users : [],
    isConnected: noteId && userId ? isConnected : false,
    error: noteId && userId ? error : null,
    isHostOnline: noteId && userId ? isHostOnline : role === 'host',
  };
}
