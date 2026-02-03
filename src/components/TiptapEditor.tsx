'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect } from 'react';

interface TiptapEditorProps {
  /** 초기 콘텐츠 (JSON 또는 HTML 문자열) */
  content?: string;
  /** 콘텐츠 변경 시 콜백 (JSON 문자열 반환) */
  onContentChange?: (jsonContent: string) => void;
  /** 에디터 비활성화 여부 */
  disabled?: boolean;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
}

/**
 * Tiptap WYSIWYG Editor PoC Component
 *
 * Phase 2-2: React 19 호환성 검증용
 * - 기본 포맷팅: Bold, Italic, Strike, Heading
 * - JSON 포맷 저장/로드
 * - Supabase Realtime 연동 준비
 */
export function TiptapEditor({
  content,
  onContentChange,
  disabled = false,
  // placeholder는 향후 @tiptap/extension-placeholder 추가 시 사용 예정
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  placeholder: _placeholder = '내용을 입력하세요...',
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 필요한 확장만 활성화
        heading: {
          levels: [1, 2, 3],
        },
        // 코드 블록은 나중에 필요시 추가
        codeBlock: false,
      }),
    ],
    content: content ? parseContent(content) : '',
    editable: !disabled,
    // SSR 경고 해결: 서버에서 즉시 렌더링하지 않음
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // JSON 형식으로 콘텐츠 추출
      const json = JSON.stringify(editor.getJSON());
      onContentChange?.(json);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  // 외부 콘텐츠 변경 시 에디터 동기화
  useEffect(() => {
    if (editor && content) {
      const parsedContent = parseContent(content);
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = typeof parsedContent === 'string'
        ? parsedContent
        : JSON.stringify(parsedContent);

      // 콘텐츠가 다를 때만 업데이트 (무한 루프 방지)
      if (currentContent !== newContent) {
        editor.commands.setContent(parsedContent);
      }
    }
  }, [editor, content]);

  // disabled 상태 변경 시 에디터 상태 업데이트
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // 포맷팅 버튼 핸들러
  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor?.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleHeading = useCallback((level: 1 | 2 | 3) => {
    editor?.chain().focus().toggleHeading({ level }).run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
        <span className="text-gray-400">에디터 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
          {/* Text Formatting */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={toggleBold}
              isActive={editor.isActive('bold')}
              title="굵게 (Ctrl+B)"
            >
              <BoldIcon />
            </ToolbarButton>
            <ToolbarButton
              onClick={toggleItalic}
              isActive={editor.isActive('italic')}
              title="기울임 (Ctrl+I)"
            >
              <ItalicIcon />
            </ToolbarButton>
            <ToolbarButton
              onClick={toggleStrike}
              isActive={editor.isActive('strike')}
              title="취소선 (Ctrl+Shift+S)"
            >
              <StrikeIcon />
            </ToolbarButton>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Headings */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => toggleHeading(1)}
              isActive={editor.isActive('heading', { level: 1 })}
              title="제목 1"
            >
              H1
            </ToolbarButton>
            <ToolbarButton
              onClick={() => toggleHeading(2)}
              isActive={editor.isActive('heading', { level: 2 })}
              title="제목 2"
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              onClick={() => toggleHeading(3)}
              isActive={editor.isActive('heading', { level: 3 })}
              title="제목 3"
            >
              H3
            </ToolbarButton>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Lists */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={toggleBulletList}
              isActive={editor.isActive('bulletList')}
              title="글머리 기호 목록"
            >
              <BulletListIcon />
            </ToolbarButton>
            <ToolbarButton
              onClick={toggleOrderedList}
              isActive={editor.isActive('orderedList')}
              title="번호 매기기 목록"
            >
              <OrderedListIcon />
            </ToolbarButton>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}

// 콘텐츠 파싱 헬퍼 함수
function parseContent(content: string): string | object {
  try {
    // JSON 문자열인지 확인
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    // JSON이 아니면 HTML 문자열로 처리
    return content;
  }
}

// Toolbar Button 컴포넌트
interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`
        px-2 py-1.5 rounded text-sm font-medium transition-colors
        ${isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
      `}
    >
      {children}
    </button>
  );
}

// Icon 컴포넌트들
function BoldIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6V4zm0 8h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6V12z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4h4l-4 16H6l4-16z" />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.154 14a3.5 3.5 0 0 1-3.404 4H7v-2h6.75a1.5 1.5 0 1 0 0-3H4v-2h16v2h-2.846zM6.846 10a3.5 3.5 0 0 1 3.404-4H17v2h-6.75a1.5 1.5 0 1 0 0 3h7.75v2H4v-2h2.846z" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 6h13v2H8V6zm0 5h13v2H8v-2zm0 5h13v2H8v-2zM3 6h2v2H3V6zm0 5h2v2H3v-2zm0 5h2v2H3v-2z" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 6h13v2H8V6zm0 5h13v2H8v-2zm0 5h13v2H8v-2zM3 5v2h2V5H3zm0 5v2h2v-2H3zm0 5v2h2v-2H3z" />
    </svg>
  );
}

// 유틸리티 함수: 에디터에서 HTML 추출
export function getEditorHTML(editor: ReturnType<typeof useEditor>): string {
  return editor?.getHTML() || '';
}

// 유틸리티 함수: 에디터에서 JSON 추출
export function getEditorJSON(editor: ReturnType<typeof useEditor>): object | null {
  return editor?.getJSON() || null;
}
