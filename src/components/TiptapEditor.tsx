'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createBaseTiptapExtensions } from '@/lib/tiptap';

interface TiptapEditorProps {
  content?: string;
  onContentChange?: (jsonContent: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TiptapEditor({
  content,
  onContentChange,
  disabled = false,
  placeholder = '내용을 입력하세요...',
}: TiptapEditorProps) {
  void placeholder;

  const extensions = useMemo(() => createBaseTiptapExtensions(), []);
  const onContentChangeRef = useRef(onContentChange);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const editor = useEditor(
    {
      extensions,
      content: content ? parseContent(content) : '',
      editable: !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor: nextEditor }) => {
        onContentChangeRef.current?.(JSON.stringify(nextEditor.getJSON()));
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px] px-4 py-3',
        },
      },
    },
    [extensions]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const parsedContent = content ? parseContent(content) : '';
    const currentContent = JSON.stringify(editor.getJSON());
    const nextContent = typeof parsedContent === 'string'
      ? parsedContent
      : JSON.stringify(parsedContent);

    if (currentContent !== nextContent) {
      editor.commands.setContent(parsedContent);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

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
      {!disabled && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
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

      <EditorContent editor={editor} />
    </div>
  );
}

function parseContent(content: string): string | object {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

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

export function getEditorHTML(editor: ReturnType<typeof useEditor>): string {
  return editor?.getHTML() || '';
}

export function getEditorJSON(editor: ReturnType<typeof useEditor>): object | null {
  return editor?.getJSON() || null;
}
