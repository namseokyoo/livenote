'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NoteEditor } from '@/components/NoteEditor';
import { PresenceList } from '@/components/PresenceList';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useEditPermission } from '@/hooks/useEditPermission';
import { useRealtimeNote } from '@/hooks/useRealtimeNote';
import { leaveNote } from '@/lib/note-service';

import type { TiptapContent } from '@/types/note';

// 인증 만료 시간 (3분 = 180,000ms)
const AUTH_EXPIRY_MS = 3 * 60 * 1000;

interface Note {
  id: string;
  code: string;
  title: string;
  content: string;
  content_json?: TiptapContent | null;
}

interface Participant {
  id: string;
  nickname: string;
  role: 'host' | 'guest';
  isOnline: boolean;
}

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const noteCode = params.code as string;
  const { showToast } = useToast();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Auth form state
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  // Note state
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User state
  const [userRole, setUserRole] = useState<'host' | 'guest' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Presence state
  const [participants] = useState<Participant[]>([]);

  // Save state (로컬 저장 상태 - Realtime 훅 사용 시 fallback)
  const [localIsSaving, setLocalIsSaving] = useState(false);
  const [localLastSaved, setLocalLastSaved] = useState<Date | null>(null);

  // Realtime note hook - noteId가 있을 때만 활성화
  const {
    setContentJson: setRealtimeContentJson,
    isSaving: realtimeSaving,
    lastSaved: realtimeLastSaved,
    isConnected: realtimeConnected,
  } = useRealtimeNote({
    noteId: note?.id || '',
    initialContentJson: note?.content_json || null,
    onContentChange: (newContentJson) => {
      // 다른 사용자의 변경 수신 시 note 상태 업데이트
      setNote((prev) => (prev ? { ...prev, content_json: newContentJson } : null));
    },
  });

  // 실시간 연결 상태 및 저장 상태 통합
  const isSaving = realtimeSaving || localIsSaving;
  const lastSaved = realtimeLastSaved || localLastSaved;
  // noteId가 있으면 realtime 연결 상태 사용, 없으면 기본값 true
  const isRealtimeConnected = note?.id ? realtimeConnected : true;

  // Edit permission hook - 인증 후 및 note 로드 후에만 활성화
  const {
    canEdit: guestCanEdit,
    noteUsers,
    toggleEditPermission,
    isLoading: isPermissionLoading,
    permissionStatus,
    requestEditPermission,
    respondToRequest,
    cooldownSeconds,
    pendingRequests,
  } = useEditPermission({
    noteCode,
    noteId: note?.id || '',
    userId: userId || '',
    isHost: userRole === 'host',
    onPermissionChange: (changedUserId, newCanEdit) => {
      // 내 권한이 변경된 경우 알림
      if (changedUserId === userId && userRole === 'guest') {
        if (newCanEdit) {
          showToast('편집 권한이 부여되었습니다.', 'success');
        } else {
          showToast('편집 권한이 해제되었습니다.', 'info');
        }
      }
    },
    onPermissionRequest: (user) => {
      // 호스트에게 권한 요청 알림
      showToast(`${user.username}님이 편집 권한을 요청했습니다.`, 'info');
    },
  });

  // 인증 정보 삭제 헬퍼 함수
  const clearAuthData = useCallback(() => {
    sessionStorage.removeItem(`note-${noteCode}-auth`);
    sessionStorage.removeItem(`note-${noteCode}-role`);
    sessionStorage.removeItem(`note-${noteCode}-nickname`);
    sessionStorage.removeItem(`note-${noteCode}-timestamp`);
    sessionStorage.removeItem(`note-${noteCode}-userId`);
  }, [noteCode]);

  // 인증 만료 여부 확인 함수
  const isAuthExpired = useCallback((): boolean => {
    const timestamp = sessionStorage.getItem(`note-${noteCode}-timestamp`);
    if (!timestamp) return true;

    const authTime = parseInt(timestamp, 10);
    const now = Date.now();
    return (authTime + AUTH_EXPIRY_MS) < now;
  }, [noteCode]);

  // Check authentication on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem(`note-${noteCode}-auth`);
    const role = sessionStorage.getItem(`note-${noteCode}-role`) as 'host' | 'guest' | null;
    const storedNickname = sessionStorage.getItem(`note-${noteCode}-nickname`);
    const storedUserId = sessionStorage.getItem(`note-${noteCode}-userId`);

    if (isAuth === 'true' && role) {
      // 인증 만료 확인
      if (isAuthExpired()) {
        clearAuthData();
        setShowAuthModal(true);
        return;
      }

      setIsAuthenticated(true);
      setUserRole(role);
      if (storedNickname) {
        setNickname(storedNickname);
      }
      if (storedUserId) {
        setUserId(storedUserId);
      }
    } else {
      setShowAuthModal(true);
    }
  }, [noteCode, isAuthExpired, clearAuthData]);

  // visibilitychange 이벤트로 탭 복귀 시 만료 확인
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        if (isAuthExpired()) {
          clearAuthData();
          setIsAuthenticated(false);
          setShowAuthModal(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, isAuthExpired, clearAuthData]);

  // popstate 이벤트로 브라우저 뒤로가기/앞으로가기 시 인증 확인
  useEffect(() => {
    const handlePopState = () => {
      // 뒤로가기/앞으로가기 시 인증 만료 확인
      if (isAuthExpired()) {
        clearAuthData();
        setIsAuthenticated(false);
        setShowAuthModal(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthExpired, clearAuthData]);

  // pageshow 이벤트로 bfcache에서 복원 시 인증 확인
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // bfcache에서 복원된 경우
      if (event.persisted) {
        const isAuth = sessionStorage.getItem(`note-${noteCode}-auth`);
        if (isAuth !== 'true' || isAuthExpired()) {
          clearAuthData();
          setIsAuthenticated(false);
          setShowAuthModal(true);
        }
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [noteCode, isAuthExpired, clearAuthData]);

  // beforeunload 이벤트로 페이지 떠날 때 세션 삭제 및 DB에서 사용자 삭제
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 페이지 떠날 때 세션 삭제 (새로고침도 포함)
      clearAuthData();
      // sendBeacon으로 leave API 호출 (페이지 unload 시에도 전송 보장)
      if (userId && noteCode) {
        const data = JSON.stringify({ userId });
        navigator.sendBeacon(`/api/notes/${noteCode}/leave`, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [clearAuthData, userId, noteCode]);

  // Fetch note data
  const fetchNote = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`/api/notes/${noteCode}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('노트를 찾을 수 없습니다.');
        }
        throw new Error('노트를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setNote(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [noteCode, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNote();
    }
  }, [isAuthenticated, fetchNote]);

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      const response = await fetch(`/api/notes/${noteCode}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          nickname: nickname.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '인증에 실패했습니다.');
      }

      const data = await response.json();

      // Store auth with timestamp
      sessionStorage.setItem(`note-${noteCode}-role`, data.role);
      sessionStorage.setItem(`note-${noteCode}-auth`, 'true');
      sessionStorage.setItem(`note-${noteCode}-nickname`, nickname.trim());
      sessionStorage.setItem(`note-${noteCode}-timestamp`, Date.now().toString());
      sessionStorage.setItem(`note-${noteCode}-userId`, data.userId);

      setUserRole(data.role);
      setUserId(data.userId);
      setIsAuthenticated(true);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '인증에 실패했습니다.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle content JSON change (Tiptap 에디터용 - 호스트 또는 편집 권한 있는 게스트)
  const handleContentJsonChange = useCallback(
    async (newContentJson: TiptapContent) => {
      const canEditContent = userRole === 'host' || guestCanEdit;
      if (!note || !canEditContent) return;

      // 로컬 상태 업데이트
      setNote((prev) => (prev ? { ...prev, content_json: newContentJson } : null));

      // Realtime 훅의 setContentJson 호출 (디바운스 저장 + 실시간 브로드캐스트)
      if (note.id) {
        setRealtimeContentJson(newContentJson);
      }
    },
    [note, userRole, guestCanEdit, setRealtimeContentJson]
  );

  // Handle content change (plain text - 하위 호환용)
  const handleContentChange = useCallback(
    async (newContent: string) => {
      const canEditContent = userRole === 'host' || guestCanEdit;
      if (!note || !canEditContent) return;

      setNote((prev) => (prev ? { ...prev, content: newContent } : null));
      setLocalIsSaving(true);

      try {
        await fetch(`/api/notes/${noteCode}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: newContent }),
        });
        setLocalLastSaved(new Date());
      } catch {
        // Handle error silently for now
      } finally {
        setLocalIsSaving(false);
      }
    },
    [note, noteCode, userRole, guestCanEdit]
  );

  // Handle title change
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (!note || userRole !== 'host') return;

      setNote((prev) => (prev ? { ...prev, title: newTitle } : null));
      setLocalIsSaving(true);

      try {
        await fetch(`/api/notes/${noteCode}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: newTitle }),
        });
        setLocalLastSaved(new Date());
      } catch {
        // Handle error silently for now
      } finally {
        setLocalIsSaving(false);
      }
    },
    [note, noteCode, userRole]
  );

  // Handle toggle edit permission (호스트 전용)
  const handleToggleEditPermission = useCallback(
    async (targetUserId: string) => {
      try {
        await toggleEditPermission(targetUserId);
        const targetUser = noteUsers.find((u) => u.user_id === targetUserId);
        if (targetUser) {
          const newPermission = !targetUser.can_edit;
          showToast(
            `${targetUser.username}님의 편집 권한이 ${newPermission ? '부여' : '해제'}되었습니다.`,
            newPermission ? 'success' : 'info'
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : '권한 변경에 실패했습니다.',
          'error'
        );
      }
    },
    [toggleEditPermission, noteUsers, showToast]
  );

  // 편집 권한 요청 핸들러 (게스트 전용)
  const handleRequestEditPermission = useCallback(async () => {
    try {
      await requestEditPermission();
      showToast('편집 권한을 요청했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '권한 요청에 실패했습니다.',
        'error'
      );
    }
  }, [requestEditPermission, showToast]);

  // 권한 요청 응답 핸들러 (호스트 전용)
  const handleRespondToRequest = useCallback(
    async (targetUserId: string, approved: boolean) => {
      try {
        await respondToRequest(targetUserId, approved);
        const targetUser = noteUsers.find((u) => u.user_id === targetUserId);
        if (targetUser) {
          showToast(
            approved
              ? `${targetUser.username}님의 편집 권한을 승인했습니다.`
              : `${targetUser.username}님의 편집 권한 요청을 거부했습니다.`,
            approved ? 'success' : 'info'
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : '권한 응답에 실패했습니다.',
          'error'
        );
      }
    },
    [respondToRequest, noteUsers, showToast]
  );

  // noteUsers를 participants 형식으로 변환
  const participantsFromUsers = noteUsers.map((user) => ({
    id: user.user_id,
    nickname: user.username,
    role: user.role,
    isOnline: true, // TODO: Presence 통합 시 실제 온라인 상태로 변경
    canEdit: user.can_edit,
    permissionStatus: user.permission_status,
  }));

  // Auth modal
  if (showAuthModal) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-black mb-2">LiveNote</h1>
            <p className="text-gray-500">노트에 참여하려면 인증이 필요합니다.</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">노트 참여</h2>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                노트 코드: <code className="font-mono">{noteCode}</code>
              </p>
            </div>

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <Input
                label="비밀번호"
                type="password"
                placeholder="4자리 숫자"
                value={password}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPassword(value);
                }}
                inputMode="numeric"
                maxLength={4}
                required
              />

              <Input
                label="닉네임"
                placeholder="표시될 이름을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                required
              />

              {authError && (
                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                  {authError}
                </p>
              )}

              <div className="flex gap-3 mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push('/')}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isAuthLoading}
                  className="flex-1"
                >
                  참여하기
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-500">노트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="secondary" onClick={() => router.push('/')}>
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main editor area */}
          <div className="flex-1 min-w-0">
            {note && (
              <NoteEditor
                noteCode={noteCode}
                title={note.title}
                content={note.content}
                contentJson={note.content_json}
                isHost={userRole === 'host'}
                canEdit={guestCanEdit}
                onContentChange={handleContentChange}
                onContentJsonChange={handleContentJsonChange}
                onTitleChange={handleTitleChange}
                lastSaved={lastSaved}
                isSaving={isSaving}
                isConnected={isRealtimeConnected}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <PresenceList
              participants={participantsFromUsers.length > 0 ? participantsFromUsers : participants}
              currentUserId={userId || undefined}
              isHost={userRole === 'host'}
              onToggleEditPermission={handleToggleEditPermission}
              isTogglingPermission={isPermissionLoading}
              onRequestEditPermission={handleRequestEditPermission}
              onRespondToRequest={handleRespondToRequest}
              permissionStatus={permissionStatus}
              cooldownSeconds={cooldownSeconds}
              pendingRequestCount={pendingRequests.length}
            />

            {/* Actions */}
            <div className="mt-4">
              <Button
                variant="ghost"
                onClick={async () => {
                  // 퇴장 시 인증 정보 삭제 (뒤로가기 방지)
                  clearAuthData();
                  // DB에서 사용자 삭제
                  if (note?.id && userId) {
                    try {
                      await leaveNote(note.id, userId);
                    } catch (e) {
                      // 실패해도 홈으로 이동
                      console.error('leaveNote failed:', e);
                    }
                  }
                  router.push('/');
                }}
                className="w-full text-gray-500"
              >
                홈으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
