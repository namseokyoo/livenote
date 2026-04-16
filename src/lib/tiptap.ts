import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { TiptapContent } from '@/types/note';

export const EMPTY_TIPTAP_DOC: TiptapContent = {
  type: 'doc',
  content: [],
};

export function createBaseTiptapExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      codeBlock: false,
    }),
  ];
}

export function normalizeTiptapContent(content: TiptapContent | null | undefined): TiptapContent {
  if (!content || content.type !== 'doc') {
    return EMPTY_TIPTAP_DOC;
  }

  return content;
}
