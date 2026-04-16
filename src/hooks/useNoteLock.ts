'use client';

import { useCallback, useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getRtdb, signInAnonymouslyIfNeeded } from '@/lib/firebase';
import { setNoteLock } from '@/lib/note-service';
import type { UserRole } from '@/types/note';

export interface UseNoteLockOptions {
  noteId: string;
  userId: string;
  role: UserRole;
  initialLocked?: boolean;
  initialLockedBy?: string | null;
}

export interface UseNoteLockReturn {
  isLocked: boolean;
  lockedBy: string | null;
  canEdit: boolean;
  requestLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  isConnected: boolean;
  error: Error | null;
}

export function useNoteLock({
  noteId,
  userId,
  role,
  initialLocked = false,
  initialLockedBy = null,
}: UseNoteLockOptions): UseNoteLockReturn {
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [lockedBy, setLockedBy] = useState<string | null>(initialLockedBy);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const canEdit = role === 'host';

  const requestLock = useCallback(async (): Promise<boolean> => {
    if (role !== 'host') {
      setError(new Error('게스트는 잠금을 설정할 수 없습니다'));
      return false;
    }

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
  }, [isLocked, lockedBy, noteId, role, userId]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (role !== 'host') {
      setError(new Error('게스트는 잠금을 해제할 수 없습니다'));
      return;
    }

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
  }, [lockedBy, noteId, role, userId]);

  useEffect(() => {
    if (!noteId) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    const rtdb = getRtdb();

    const subscribe = async () => {
      try {
        await signInAnonymouslyIfNeeded();
        if (disposed) {
          return;
        }

        unsubscribe = onValue(
          ref(rtdb, `notes/${noteId}`),
          (snapshot) => {
            setIsConnected(true);
            setError(null);

            if (!snapshot.exists()) {
              return;
            }

            const data = snapshot.val() as { isLocked?: boolean; lockedBy?: string | null };
            setIsLocked(Boolean(data.isLocked));
            setLockedBy(typeof data.lockedBy === 'string' ? data.lockedBy : null);
          },
          (snapshotError) => {
            setIsConnected(false);
            setError(snapshotError instanceof Error ? snapshotError : new Error('Lock 연결 실패'));
          }
        );
      } catch (subscribeError) {
        setIsConnected(false);
        setError(subscribeError instanceof Error ? subscribeError : new Error('Lock 연결 실패'));
      }
    };

    void subscribe();

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [noteId]);

  useEffect(() => () => {
    if (role === 'host' && lockedBy === userId && isLocked) {
      void setNoteLock(noteId, false, null).catch(console.error);
    }
  }, [isLocked, lockedBy, noteId, role, userId]);

  return {
    isLocked: noteId ? isLocked : initialLocked,
    lockedBy: noteId ? lockedBy : initialLockedBy,
    canEdit,
    requestLock,
    releaseLock,
    isConnected: noteId ? isConnected : false,
    error: noteId ? error : null,
  };
}
