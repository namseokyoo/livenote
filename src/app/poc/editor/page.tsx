'use client';

import { useState, useCallback } from 'react';
import { TiptapEditor } from '@/components/TiptapEditor';

/**
 * Tiptap Editor PoC 테스트 페이지
 *
 * Phase 2-2: React 19 호환성 검증
 * - 에디터 렌더링 확인
 * - 기본 포맷팅 동작 확인
 * - JSON 저장/로드 테스트
 */
export default function EditorPocPage() {
  // 에디터 콘텐츠 상태 (JSON 문자열)
  const [content, setContent] = useState<string>('');

  // 저장된 콘텐츠 (시뮬레이션)
  const [savedContent, setSavedContent] = useState<string>('');

  // 읽기 전용 모드 토글
  const [isReadOnly, setIsReadOnly] = useState(false);

  // 콘텐츠 변경 핸들러
  const handleContentChange = useCallback((jsonContent: string) => {
    setContent(jsonContent);
  }, []);

  // 저장 시뮬레이션
  const handleSave = useCallback(() => {
    setSavedContent(content);
    alert('콘텐츠가 저장되었습니다! (시뮬레이션)');
  }, [content]);

  // 불러오기 시뮬레이션
  const handleLoad = useCallback(() => {
    if (savedContent) {
      setContent(savedContent);
      alert('저장된 콘텐츠를 불러왔습니다!');
    } else {
      alert('저장된 콘텐츠가 없습니다.');
    }
  }, [savedContent]);

  // 콘텐츠 초기화
  const handleClear = useCallback(() => {
    setContent('');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Tiptap Editor PoC
          </h1>
          <p className="text-gray-600">
            Phase 2-2: React 19 호환성 검증 테스트 페이지
          </p>
        </div>

        {/* 검증 항목 체크리스트 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">검증 항목</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>npm run build 성공</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>TypeScript 에러 없음</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-500">○</span>
              <span>에디터 렌더링 정상 - 아래에서 확인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-500">○</span>
              <span>기본 포맷팅 (Bold, Italic) 동작 - 아래에서 확인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-500">○</span>
              <span>콘텐츠 추출 (getJSON()) 동작 - 아래에서 확인</span>
            </li>
          </ul>
        </div>

        {/* 컨트롤 패널 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              저장 (시뮬레이션)
            </button>
            <button
              onClick={handleLoad}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              불러오기
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              초기화
            </button>
            <label className="flex items-center gap-2 ml-auto">
              <input
                type="checkbox"
                checked={isReadOnly}
                onChange={(e) => setIsReadOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">읽기 전용 모드</span>
            </label>
          </div>
        </div>

        {/* 에디터 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">에디터</h2>
          <TiptapEditor
            content={content}
            onContentChange={handleContentChange}
            disabled={isReadOnly}
            placeholder="여기에 내용을 입력하세요..."
          />
        </div>

        {/* JSON 출력 (디버깅용) */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">JSON 출력 (getJSON())</h2>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
            {content ? JSON.stringify(JSON.parse(content), null, 2) : '(빈 콘텐츠)'}
          </pre>
        </div>

        {/* 기술 정보 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Next.js 16.1.6 | React 19.2.3 | Tiptap (최신)</p>
        </div>
      </div>
    </div>
  );
}
