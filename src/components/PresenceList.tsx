'use client';

import { Badge } from './ui/Badge';
import type { PermissionStatus } from '@/types/note';

interface Participant {
  id: string;
  nickname: string;
  role: 'host' | 'guest';
  isOnline: boolean;
  canEdit?: boolean;
  permissionStatus?: PermissionStatus;
}

interface PresenceListProps {
  participants: Participant[];
  currentUserId?: string;
  /** 현재 사용자가 호스트인지 여부 */
  isHost?: boolean;
  /** 편집 권한 토글 핸들러 (호스트 전용) */
  onToggleEditPermission?: (userId: string) => void;
  /** 토글 로딩 상태 */
  isTogglingPermission?: boolean;
  /** 게스트: 권한 요청 핸들러 */
  onRequestEditPermission?: () => void;
  /** 호스트: 권한 요청 응답 핸들러 */
  onRespondToRequest?: (userId: string, approved: boolean) => void;
  /** 현재 사용자의 권한 요청 상태 (게스트 전용) */
  permissionStatus?: PermissionStatus;
  /** 쿨다운 남은 시간 (초) */
  cooldownSeconds?: number;
  /** 대기 중인 권한 요청 수 (호스트 전용) */
  pendingRequestCount?: number;
}

export function PresenceList({
  participants,
  currentUserId,
  isHost = false,
  onToggleEditPermission,
  isTogglingPermission = false,
  onRequestEditPermission,
  onRespondToRequest,
  permissionStatus = 'none',
  cooldownSeconds = 0,
  pendingRequestCount = 0,
}: PresenceListProps) {
  // Sort: host first, then online users, then offline users
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.role === 'host' && b.role !== 'host') return -1;
    if (a.role !== 'host' && b.role === 'host') return 1;
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return 0;
  });

  const onlineCount = participants.filter((p) => p.isOnline).length;

  // 현재 사용자 정보
  const currentUser = participants.find((p) => p.id === currentUserId);
  const isCurrentUserGuest = currentUser?.role === 'guest';
  const canCurrentUserEdit = currentUser?.canEdit === true;

  // 게스트 본인의 권한 요청 버튼 렌더링
  const renderGuestPermissionButton = () => {
    if (isHost || !isCurrentUserGuest || canCurrentUserEdit) return null;

    switch (permissionStatus) {
      case 'none':
        return (
          <button
            onClick={onRequestEditPermission}
            disabled={isTogglingPermission || cooldownSeconds > 0}
            className="w-full px-3 py-2 mt-3 bg-blue-500 text-white text-sm font-medium rounded-lg
              hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed
              transition-colors"
          >
            {cooldownSeconds > 0 ? `${cooldownSeconds}초 후 재요청 가능` : '편집 권한 요청'}
          </button>
        );
      case 'requested':
        return (
          <div className="w-full px-3 py-2 mt-3 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-lg text-center">
            요청 중... 호스트 승인 대기
          </div>
        );
      case 'denied':
        return (
          <div className="w-full mt-3">
            <div className="px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg text-center mb-2">
              요청이 거부되었습니다
            </div>
            {cooldownSeconds > 0 ? (
              <div className="text-xs text-gray-500 text-center">
                {cooldownSeconds}초 후 재요청 가능
              </div>
            ) : (
              <button
                onClick={onRequestEditPermission}
                disabled={isTogglingPermission}
                className="w-full px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg
                  hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed
                  transition-colors"
              >
                다시 요청
              </button>
            )}
          </div>
        );
      case 'granted':
        // 이미 편집 가능한 상태이므로 표시하지 않음
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">접속자 목록</h2>
          {/* 호스트에게 대기 중인 요청 배지 표시 */}
          {isHost && pendingRequestCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {pendingRequestCount}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {onlineCount}명 접속 중
        </span>
      </div>

      {/* Participants list */}
      <ul className="space-y-2">
        {sortedParticipants.length === 0 ? (
          <li className="text-sm text-gray-500 text-center py-4">
            접속자가 없습니다.
          </li>
        ) : (
          sortedParticipants.map((participant) => (
            <li
              key={participant.id}
              className={`
                flex flex-col p-2 rounded-lg
                ${participant.id === currentUserId ? 'bg-blue-50' : 'hover:bg-gray-50'}
                ${!participant.isOnline ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Online indicator */}
                  <span
                    className={`
                      w-2 h-2 rounded-full flex-shrink-0
                      ${participant.isOnline ? 'bg-green-500' : 'bg-gray-300'}
                    `}
                    title={participant.isOnline ? '온라인' : '오프라인'}
                  />

                  {/* Nickname */}
                  <span className="text-sm text-gray-700">
                    {participant.nickname}
                    {participant.id === currentUserId && (
                      <span className="text-xs text-gray-400 ml-1">(나)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* 호스트 시점: 게스트가 권한 요청 중인 경우 승인/거부 버튼 */}
                  {isHost &&
                    participant.role === 'guest' &&
                    participant.permissionStatus === 'requested' &&
                    onRespondToRequest && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onRespondToRequest(participant.id, true)}
                          disabled={isTogglingPermission}
                          className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded
                            hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                            transition-colors"
                          title="편집 권한 승인"
                        >
                          ✓ 승인
                        </button>
                        <button
                          onClick={() => onRespondToRequest(participant.id, false)}
                          disabled={isTogglingPermission}
                          className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded
                            hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed
                            transition-colors"
                          title="편집 권한 거부"
                        >
                          ✗ 거부
                        </button>
                      </div>
                    )}

                  {/* 호스트 시점: 일반 권한 토글 (요청 중이 아닌 게스트) */}
                  {isHost &&
                    participant.role === 'guest' &&
                    participant.permissionStatus !== 'requested' &&
                    onToggleEditPermission && (
                      <button
                        onClick={() => onToggleEditPermission(participant.id)}
                        disabled={isTogglingPermission}
                        className={`
                          px-2 py-0.5 rounded text-xs font-medium transition-colors
                          ${participant.canEdit
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={participant.canEdit ? '편집 권한 해제' : '편집 권한 부여'}
                      >
                        {participant.canEdit ? '편집 가능' : '읽기 전용'}
                      </button>
                    )}

                  {/* 게스트 시점: 다른 게스트의 권한 상태 표시 */}
                  {!isHost && participant.role === 'guest' && participant.id !== currentUserId && (
                    <span
                      className={`
                        px-2 py-0.5 rounded text-xs font-medium
                        ${participant.canEdit ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                      `}
                    >
                      {participant.canEdit ? '편집 가능' : '읽기 전용'}
                    </span>
                  )}

                  {/* Role badge */}
                  <Badge role={participant.role} />
                </div>
              </div>

              {/* 호스트 시점: 요청 중인 게스트에게 요청 상태 표시 */}
              {isHost &&
                participant.role === 'guest' &&
                participant.permissionStatus === 'requested' && (
                  <div className="mt-1 text-xs text-yellow-600 pl-4">
                    편집 권한을 요청했습니다
                  </div>
                )}
            </li>
          ))
        )}
      </ul>

      {/* 게스트: 권한 요청 버튼 영역 */}
      {renderGuestPermissionButton()}
    </div>
  );
}
