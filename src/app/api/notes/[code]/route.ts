import { NextRequest, NextResponse } from 'next/server';
import { getNoteByCode, updateNoteContent, updateNoteContentJson, updateNoteTitle, textToTiptapJson, deleteNote } from '@/lib/note-service';
import type { TiptapContent } from '@/types/note';

// Rate Limiting: 메모리 기반 (5회 실패 시 10분 잠금)
const rateLimitMap = new Map<string, { failCount: number; lockedUntil: number }>();
const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10분

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

/**
 * DELETE /api/notes/[code] - 노트 삭제 (호스트만 가능)
 *
 * Request body:
 * - password: 호스트 비밀번호 (4자리 숫자)
 *
 * Response:
 * - 200: 삭제 성공
 * - 401: 비밀번호 오류
 * - 429: Rate Limit 초과 (10분 잠금)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { password } = body;

    // Rate Limit 체크
    const rateLimitKey = noteCode;
    const rateLimit = rateLimitMap.get(rateLimitKey);

    if (rateLimit && rateLimit.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `너무 많은 시도가 있었습니다. ${remainingMinutes}분 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    // 비밀번호 유효성 검사
    if (!password || !/^\d{4}$/.test(password)) {
      return NextResponse.json(
        { error: '비밀번호는 4자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    // 노트 조회
    const note = await getNoteByCode(noteCode);

    if (!note) {
      return NextResponse.json(
        { error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 호스트 비밀번호 검증
    if (password !== note.host_password) {
      // 실패 카운트 증가
      const currentLimit = rateLimitMap.get(rateLimitKey) || { failCount: 0, lockedUntil: 0 };
      currentLimit.failCount += 1;

      if (currentLimit.failCount >= MAX_FAILURES) {
        currentLimit.lockedUntil = Date.now() + LOCK_DURATION_MS;
        currentLimit.failCount = 0; // 잠금 후 카운트 리셋
        rateLimitMap.set(rateLimitKey, currentLimit);

        return NextResponse.json(
          { error: '너무 많은 시도가 있었습니다. 10분 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }

      rateLimitMap.set(rateLimitKey, currentLimit);

      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증 성공 - Rate Limit 초기화
    rateLimitMap.delete(rateLimitKey);

    // 노트 삭제 (CASCADE로 note_users도 함께 삭제됨)
    await deleteNote(note.id);

    return NextResponse.json(
      { message: '노트가 삭제되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('노트 삭제 오류:', error);
    return NextResponse.json(
      { error: '노트 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
