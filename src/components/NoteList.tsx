'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NoteCard, NoteCardData } from './NoteCard';
import { PasswordModal } from './PasswordModal';

interface NoteListResponse {
  notes: NoteCardData[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface NoteListProps {
  search?: string;
  onSearchingChange?: (isSearching: boolean) => void;
}

/**
 * 노트 목록 컨테이너 컴포넌트
 * 무한 스크롤 (Intersection Observer 사용)
 */
export function NoteList({ search, onSearchingChange }: NoteListProps) {
  const [notes, setNotes] = useState<NoteCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 비밀번호 모달 상태
  const [selectedNote, setSelectedNote] = useState<NoteCardData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Intersection Observer 타겟
  const observerTarget = useRef<HTMLDivElement>(null);

  // 노트 목록 불러오기
  const fetchNotes = useCallback(async (cursorId?: string | null, searchQuery?: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    onSearchingChange?.(true);

    try {
      const params = new URLSearchParams();
      if (cursorId) {
        params.set('cursor', cursorId);
      }
      params.set('limit', '10');
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/notes?${params.toString()}`);

      if (!response.ok) {
        throw new Error('노트 목록을 불러오는데 실패했습니다.');
      }

      const data: NoteListResponse = await response.json();

      setNotes((prev) => (cursorId ? [...prev, ...data.notes] : data.notes));
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
      onSearchingChange?.(false);
    }
  }, [isLoading, onSearchingChange]);

  // 검색어 변경 시 목록 리셋 및 새로 로드
  useEffect(() => {
    setNotes([]);
    setCursor(null);
    setHasMore(true);
    setIsInitialLoading(true);
    fetchNotes(null, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Intersection Observer 설정
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          fetchNotes(cursor, search);
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [cursor, hasMore, isLoading, fetchNotes, search]);

  // 노트 카드 클릭 핸들러
  const handleNoteClick = (note: NoteCardData) => {
    setSelectedNote(note);
    setIsModalOpen(true);
  };

  // 모달 닫기 핸들러
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedNote(null);
  };

  // 초기 로딩 상태
  if (isInitialLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse p-4 bg-gray-100 rounded-lg h-20"
          />
        ))}
      </div>
    );
  }

  // 에러 상태
  if (error && notes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{error}</p>
        <button
          onClick={() => fetchNotes()}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 빈 상태
  if (notes.length === 0) {
    // 검색 결과가 없는 경우
    if (search) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">검색 결과가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">
            다른 검색어로 시도해보세요.
          </p>
        </div>
      );
    }
    // 노트가 없는 경우
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">아직 생성된 노트가 없습니다.</p>
        <p className="text-sm text-gray-400 mt-1">
          새 노트를 생성해보세요!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} onClick={handleNoteClick} />
        ))}

        {/* Intersection Observer 타겟 */}
        <div ref={observerTarget} className="h-4" />

        {/* 추가 로딩 인디케이터 */}
        {isLoading && !isInitialLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
          </div>
        )}

        {/* 더 이상 데이터 없음 */}
        {!hasMore && notes.length > 0 && (
          <p className="text-center text-sm text-gray-400 py-4">
            모든 노트를 불러왔습니다.
          </p>
        )}
      </div>

      {/* 비밀번호 모달 */}
      <PasswordModal
        note={selectedNote}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </>
  );
}
