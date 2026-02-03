'use client';

import { useState, useEffect, useCallback } from 'react';
import { TiptapEditor } from './TiptapEditor';
import type { TiptapContent } from '@/types/note';

interface NoteEditorProps {
  noteCode: string;
  title: string;
  content: string;
  /** Tiptap JSON 포맷 콘텐츠 */
  contentJson?: TiptapContent | null;
  isHost: boolean;
  /** 게스트의 편집 권한 (호스트가 부여) */
  canEdit?: boolean;
  /** plain text 콘텐츠 변경 콜백 (하위 호환용) */
  onContentChange?: (content: string) => void;
  /** JSON 포맷 콘텐츠 변경 콜백 */
  onContentJsonChange?: (contentJson: TiptapContent) => void;
  onTitleChange?: (title: string) => void;
  lastSaved?: Date | null;
  isSaving?: boolean;
  isConnected?: boolean;
}

export function NoteEditor({
  noteCode,
  title,
  content,
  contentJson,
  isHost,
  canEdit: guestCanEdit = false,
  onContentChange,
  onContentJsonChange,
  onTitleChange,
  lastSaved,
  isSaving = false,
  isConnected = true,
}: NoteEditorProps) {
  // 편집 가능 여부: 호스트이거나, 게스트에게 편집 권한이 부여된 경우
  const canEdit = isHost || guestCanEdit;
  const [localTitle, setLocalTitle] = useState(title);
  // Tiptap 에디터용 JSON 콘텐츠 상태
  const [localContentJson, setLocalContentJson] = useState<string>(
    contentJson ? JSON.stringify(contentJson) : ''
  );

  // Sync with external title changes (from other users)
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Sync with external content_json changes (from Realtime)
  useEffect(() => {
    if (contentJson) {
      setLocalContentJson(JSON.stringify(contentJson));
    }
  }, [contentJson]);

  // Tiptap 에디터 콘텐츠 변경 핸들러
  const handleTiptapContentChange = useCallback(
    (jsonContent: string) => {
      setLocalContentJson(jsonContent);
      try {
        const parsed = JSON.parse(jsonContent) as TiptapContent;
        onContentJsonChange?.(parsed);
      } catch {
        // JSON 파싱 실패 시 무시
      }
    },
    [onContentJsonChange]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setLocalTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  const formatLastSaved = (date: Date | null | undefined): string => {
    if (!date) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 10) return '방금 저장됨';
    if (diff < 60) return `${diff}초 전 저장됨`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전 저장됨`;
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex-1">
          {isHost ? (
            <input
              type="text"
              value={localTitle}
              onChange={handleTitleChange}
              placeholder="노트 제목"
              className="text-2xl font-semibold text-gray-900 w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-gray-400"
              maxLength={100}
            />
          ) : (
            <h1 className="text-2xl font-semibold text-gray-900">{localTitle}</h1>
          )}
        </div>

        {/* 게스트 편집 권한 표시 */}
        {!isHost && canEdit && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            편집 가능
          </span>
        )}

        {/* Status indicators */}
        <div className="flex items-center gap-3 ml-4">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-500">
              {isConnected ? '연결됨' : '연결 끊김'}
            </span>
          </div>

          {/* Save status */}
          <div className="text-xs text-gray-500">
            {isSaving ? (
              <span className="flex items-center gap-1">
                <svg
                  className="animate-spin h-3 w-3"
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
                저장 중...
              </span>
            ) : (
              formatLastSaved(lastSaved)
            )}
          </div>
        </div>
      </div>

      {/* Note code display */}
      <div className="flex items-center gap-2 py-3">
        <span className="text-xs text-gray-500">코드:</span>
        <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
          {noteCode}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(noteCode);
          }}
          className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
        >
          복사
        </button>
      </div>

      {/* Tiptap WYSIWYG Editor */}
      <div className="flex-1 pt-4">
        <TiptapEditor
          content={localContentJson}
          onContentChange={handleTiptapContentChange}
          disabled={!canEdit}
          placeholder="노트 내용을 입력하세요..."
        />
        {!canEdit && (
          <div className="text-xs text-gray-400 mt-2 text-center">
            읽기 전용 모드
          </div>
        )}
      </div>
    </div>
  );
}
