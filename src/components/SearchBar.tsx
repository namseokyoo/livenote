'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching?: boolean;
}

/**
 * 검색바 컴포넌트
 * - 돋보기 아이콘 버튼
 * - 클릭 시 검색창 확장/축소 토글
 * - 입력 시 디바운스 300ms 적용
 * - 검색어 입력 중 로딩 표시
 * - 검색어 지우기(X) 버튼
 */
export function SearchBar({ onSearch, isSearching = false }: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 디바운스 타이머
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 디바운스된 검색 실행
  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onSearch(searchQuery);
      }, 300);
    },
    [onSearch]
  );

  // 입력값 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  // 검색어 지우기
  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  // 검색창 토글
  const handleToggle = () => {
    if (isExpanded && query) {
      // 검색어가 있으면 축소하지 않고 유지
      return;
    }
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // 확장 시 입력 필드에 포커스
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // ESC 키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) {
        // 검색어가 있으면 지우기만
        handleClear();
      } else {
        // 검색어가 없으면 축소
        setIsExpanded(false);
      }
    }
  };

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !query
      ) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [query]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative flex items-center justify-end">
      <div
        className={`flex items-center transition-all duration-300 ease-in-out ${
          isExpanded
            ? 'w-full bg-gray-100 rounded-full px-4 py-2'
            : 'w-10 h-10'
        }`}
      >
        {/* 돋보기 아이콘 버튼 */}
        <button
          onClick={handleToggle}
          className={`flex items-center justify-center transition-all ${
            isExpanded
              ? 'w-6 h-6 mr-2 text-gray-500'
              : 'w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
          aria-label={isExpanded ? '검색' : '검색창 열기'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </button>

        {/* 검색 입력 필드 */}
        {isExpanded && (
          <>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="제목 또는 내용 검색..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
            />

            {/* 로딩 인디케이터 */}
            {isSearching && (
              <div className="w-5 h-5 mr-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600" />
              </div>
            )}

            {/* 지우기 버튼 */}
            {query && !isSearching && (
              <button
                onClick={handleClear}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="검색어 지우기"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
