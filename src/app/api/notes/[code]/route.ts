import { NextRequest, NextResponse } from 'next/server';
import { getNoteByCode, updateNoteContent, updateNoteContentJson, updateNoteTitle, textToTiptapJson } from '@/lib/note-service';
import type { TiptapContent } from '@/types/note';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/notes/[code] - 노트 조회 (기본 정보만, 인증 불필요)
 *
 * Response:
 * - note: { id, note_code, title, is_locked }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();

    const note = await getNoteByCode(noteCode);

    if (!note) {
      return NextResponse.json(
        { error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // content_json이 있으면 우선 사용, 없으면 content에서 변환
    const contentJson = note.content_json || textToTiptapJson(note.content);

    // Return basic note info (without passwords)
    return NextResponse.json({
      id: note.id,
      code: note.note_code,
      title: note.title,
      content: note.content,
      content_json: contentJson,
      is_locked: note.is_locked,
      created_at: note.created_at,
      last_modified: note.last_modified,
    });
  } catch (error) {
    console.error('노트 조회 오류:', error);
    return NextResponse.json(
      { error: '노트 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notes/[code] - 노트 업데이트 (제목 또는 내용)
 *
 * Request body:
 * - title?: 새 제목
 * - content?: 새 내용 (plain text - 하위 호환용)
 * - content_json?: Tiptap JSON 포맷 콘텐츠 (우선 사용)
 *
 * Response:
 * - note: 업데이트된 노트 객체
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { title, content, content_json } = body;

    const note = await getNoteByCode(noteCode);

    if (!note) {
      return NextResponse.json(
        { error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let updatedNote = note;

    // Update title if provided
    if (title !== undefined) {
      updatedNote = await updateNoteTitle(note.id, title);
    }

    // Update content - content_json 우선 (Tiptap 에디터), 없으면 content (plain text)
    if (content_json !== undefined) {
      updatedNote = await updateNoteContentJson(note.id, content_json as TiptapContent);
    } else if (content !== undefined) {
      updatedNote = await updateNoteContent(note.id, content);
    }

    // 응답에 content_json 포함
    const responseContentJson = updatedNote.content_json || textToTiptapJson(updatedNote.content);

    return NextResponse.json({
      id: updatedNote.id,
      code: updatedNote.note_code,
      title: updatedNote.title,
      content: updatedNote.content,
      content_json: responseContentJson,
      is_locked: updatedNote.is_locked,
      last_modified: updatedNote.last_modified,
    });
  } catch (error) {
    console.error('노트 업데이트 오류:', error);
    return NextResponse.json(
      { error: '노트 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}
