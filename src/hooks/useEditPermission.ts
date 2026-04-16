'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getRtdb, signInAnonymouslyIfNeeded } from '@/lib/firebase';
import { cleanupExpiredRequests, updateUserEditPermission } from '@/lib/note-service';
import type { NoteUser, PermissionStatus } from '@/types/note';

export interface UseEditPermissionOptions {
  noteCode: string;
  noteId: string;
  userId: string;
  isHost: boolean;
  onPermissionChange?: (userId: string, canEdit: boolean) => void;
  onPermissionRequest?: (user: NoteUser) => void;
}

export interface UseEditPermissionReturn {
  canEdit: boolean;
  noteUsers: NoteUser[];
  toggleEditPermission: (targetUserId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  permissionStatus: PermissionStatus;
  requestEditPermission: () => Promise<void>;
  respondToRequest: (targetUserId: string, approved: boolean) => Promise<void>;
  cooldownSeconds: number;
  pendingRequests: NoteUser[];
}

const COOLDOWN_DURATION = 30;

type UserStateSnapshot = {
  canEdit?: boolean;
  permissionStatus?: PermissionStatus;
};

type ParticipantRecord = {
  username?: string;
  role?: 'host' | 'guest';
  canEdit?: boolean;
  permissionStatus?: PermissionStatus;
  permissionRequestedAt?: number | string | null;
  joinedAt?: number | string;
};

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

function toPermissionStatus(value: unknown, isHost: boolean): PermissionStatus {
  if (value === 'none' || value === 'requested' || value === 'granted' || value === 'denied') {
    return value;
  }

  return isHost ? 'granted' : 'none';
}

function mapParticipant(noteId: string, userId: string, data: ParticipantRecord): NoteUser {
  const role = data.role === 'host' ? 'host' : 'guest';

  return {
    id: userId,
    note_id: noteId,
    user_id: userId,
    username: data.username ?? '',
    role,
    joined_at: toIsoString(data.joinedAt),
    can_edit: role === 'host' ? true : Boolean(data.canEdit),
    permission_status: toPermissionStatus(data.permissionStatus, role === 'host'),
    permission_requested_at: data.permissionRequestedAt
      ? toIsoString(data.permissionRequestedAt)
      : null,
  };
}

export function useEditPermission({
  noteCode,
  noteId,
  userId,
  isHost,
  onPermissionChange,
  onPermissionRequest,
}: UseEditPermissionOptions): UseEditPermissionReturn {
  const [noteUsers, setNoteUsers] = useState<NoteUser[]>([]);
  const [canEdit, setCanEdit] = useState(isHost);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>(isHost ? 'granted' : 'none');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousUsersRef = useRef<Record<string, UserStateSnapshot>>({});

  const pendingRequests = useMemo(
    () => noteUsers.filter((user) => user.role === 'guest' && user.permission_status === 'requested'),
    [noteUsers]
  );

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const startCooldown = useCallback((seconds: number) => {
    clearCooldownTimer();
    setCooldownSeconds(seconds);

    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((previous) => {
        if (previous <= 1) {
          clearCooldownTimer();
          return 0;
        }

        return previous - 1;
      });
    }, 1000);
  }, [clearCooldownTimer]);

  const syncCooldown = useCallback((requestedAt: unknown, status: PermissionStatus) => {
    if ((status !== 'requested' && status !== 'denied') || !requestedAt) {
      clearCooldownTimer();
      setCooldownSeconds(0);
      return;
    }

    const requestedAtMs = requestedAt instanceof Date
      ? requestedAt.getTime()
      : typeof requestedAt === 'number'
        ? requestedAt
        : new Date(String(requestedAt)).getTime();

    if (Number.isNaN(requestedAtMs)) {
      clearCooldownTimer();
      setCooldownSeconds(0);
      return;
    }

    const remainingSeconds = Math.max(
      0,
      COOLDOWN_DURATION - Math.floor((Date.now() - requestedAtMs) / 1000)
    );

    if (remainingSeconds > 0) {
      startCooldown(remainingSeconds);
    } else {
      clearCooldownTimer();
      setCooldownSeconds(0);
    }
  }, [clearCooldownTimer, startCooldown]);

  const syncCurrentUserPermission = useCallback((nextCanEdit: boolean, nextStatus: PermissionStatus, requestedAt?: unknown) => {
    setCanEdit(isHost || nextCanEdit);
    setPermissionStatus(isHost ? 'granted' : nextStatus);
    syncCooldown(requestedAt, nextStatus);
  }, [isHost, syncCooldown]);

  const applyUsers = useCallback((users: NoteUser[]) => {
    setNoteUsers(users);

    const previousUsers = previousUsersRef.current;

    users.forEach((user) => {
      const previous = previousUsers[user.user_id];

      if (
        previous &&
        previous.canEdit !== user.can_edit &&
        user.can_edit !== undefined &&
        onPermissionChange
      ) {
        onPermissionChange(user.user_id, Boolean(user.can_edit));
      }

      if (
        isHost &&
        onPermissionRequest &&
        user.permission_status === 'requested' &&
        previous?.permissionStatus !== 'requested'
      ) {
        onPermissionRequest(user);
      }
    });

    previousUsersRef.current = Object.fromEntries(
      users.map((user) => [
        user.user_id,
        {
          canEdit: user.can_edit,
          permissionStatus: user.permission_status,
        },
      ])
    );

    const currentUser = users.find((user) => user.user_id === userId);

    if (currentUser) {
      syncCurrentUserPermission(
        currentUser.can_edit === true,
        currentUser.permission_status ?? 'none',
        currentUser.permission_requested_at ?? undefined
      );
    } else if (isHost) {
      syncCurrentUserPermission(true, 'granted');
    }
  }, [isHost, onPermissionChange, onPermissionRequest, syncCurrentUserPermission, userId]);

  const toggleEditPermission = useCallback(async (targetUserId: string) => {
    if (!isHost) {
      throw new Error('호스트만 편집 권한을 변경할 수 있습니다.');
    }

    if (!noteId || !userId) {
      throw new Error('노트 정보가 로드되지 않았습니다.');
    }

    setIsLoading(true);
    setError(null);

    try {
      const targetUser = noteUsers.find((user) => user.user_id === targetUserId);
      if (!targetUser) {
        throw new Error('대상 사용자를 찾을 수 없습니다.');
      }

      await updateUserEditPermission(noteId, targetUserId, !targetUser.can_edit, userId);
    } catch (permissionError) {
      const nextError = permissionError instanceof Error ? permissionError : new Error('권한 변경 실패');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [isHost, noteId, noteUsers, userId]);

  const requestEditPermission = useCallback(async () => {
    if (isHost) {
      throw new Error('호스트는 이미 편집 권한이 있습니다.');
    }

    if (!noteCode || !userId) {
      throw new Error('노트 정보가 로드되지 않았습니다.');
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
        if (data.cooldownSeconds) {
          startCooldown(data.cooldownSeconds);
        }
        throw new Error(data.error || '권한 요청에 실패했습니다.');
      }

      syncCurrentUserPermission(false, 'requested', Date.now());
    } catch (requestError) {
      const nextError = requestError instanceof Error ? requestError : new Error('권한 요청 실패');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [cooldownSeconds, isHost, noteCode, startCooldown, syncCurrentUserPermission, userId]);

  const respondToRequest = useCallback(async (targetUserId: string, approved: boolean) => {
    if (!isHost) {
      throw new Error('호스트만 권한 요청에 응답할 수 있습니다.');
    }

    if (!noteCode || !userId) {
      throw new Error('노트 정보가 로드되지 않았습니다.');
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
    } catch (responseError) {
      const nextError = responseError instanceof Error ? responseError : new Error('권한 응답 실패');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [isHost, noteCode, userId]);

  useEffect(() => {
    if (!noteId || !userId) {
      return;
    }

    let unsubscribePermissions: () => void = () => undefined;
    let unsubscribeParticipants: () => void = () => undefined;
    let disposed = false;
    const rtdb = getRtdb();

    const connect = async () => {
      try {
        await signInAnonymouslyIfNeeded();
        await cleanupExpiredRequests(noteId);

        if (disposed) {
          return;
        }

        unsubscribePermissions = onValue(
          ref(rtdb, `permissions/${noteId}/${userId}`),
          (snapshot) => {
            const value = snapshot.val() as {
              canEdit?: boolean;
              permissionStatus?: PermissionStatus;
              requestedAt?: number | string | null;
            } | null;

            if (!value) {
              if (isHost) {
                syncCurrentUserPermission(true, 'granted');
              }
              return;
            }

            syncCurrentUserPermission(
              value.canEdit === true,
              value.permissionStatus ?? 'none',
              value.requestedAt ?? undefined
            );
          },
          (permissionError) => {
            setError(permissionError instanceof Error ? permissionError : new Error('권한 상태 동기화 실패'));
          }
        );

        unsubscribeParticipants = onValue(
          ref(rtdb, `participants/${noteId}`),
          (snapshot) => {
            const data = snapshot.val() as Record<string, ParticipantRecord> | null;
            const users = data
              ? Object.entries(data)
                  .map(([uid, record]) => mapParticipant(noteId, uid, record))
                  .sort((left, right) => (
                    new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime()
                  ))
              : [];

            applyUsers(users);
            setError(null);
          },
          (participantsError) => {
            setError(participantsError instanceof Error ? participantsError : new Error('참여자 목록 구독 실패'));
          }
        );
      } catch (connectError) {
        setError(connectError instanceof Error ? connectError : new Error('권한 구독 실패'));
      }
    };

    void connect();

    return () => {
      disposed = true;
      unsubscribePermissions();
      unsubscribeParticipants();
      clearCooldownTimer();
    };
  }, [applyUsers, clearCooldownTimer, isHost, noteId, syncCurrentUserPermission, userId]);

  useEffect(() => {
    if (isHost) {
      syncCurrentUserPermission(true, 'granted');
    }
  }, [isHost, syncCurrentUserPermission]);

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
