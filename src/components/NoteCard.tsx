'use client';

import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export interface NoteCardData {
  id: string;
  note_code: string;
  title: string;
  created_at: string;
  last_modified: string;
}

interface NoteCardProps {
  note: NoteCardData;
  onClick: (note: NoteCardData) => void;
}

/**
 * 개별 노트 카드 컴포넌트
 * 표시: 제목, 수정시간 (상대시간), 노트코드 일부
 */
export function NoteCard({ note, onClick }: NoteCardProps) {
  // 상대 시간 포맷팅
  const relativeTime = formatDistanceToNow(new Date(note.last_modified), {
    addSuffix: true,
    locale: ko,
  });

  // 노트 코드 마스킹 (앞 3자리만 표시)
  const maskedCode = `${note.note_code.slice(0, 3)}***`;

  return (
    <button
      onClick={() => onClick(note)}
      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate group-hover:text-black">
            {note.title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {relativeTime}
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-gray-100 text-gray-600">
            {maskedCode}
          </span>
        </div>
      </div>
    </button>
  );
}
