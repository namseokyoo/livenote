import { NextRequest, NextResponse } from 'next/server';
import { createNote, getNoteList } from '@/lib/note-service';

/**
 * GET /api/notes - 노트 목록 조회 (무한 스크롤용)
 *
 * Query params:
 * - cursor: 마지막 노트 ID (옵션)
 * - limit: 가져올 개수 (기본 10, 최대 50)
 * - search: 검색어 (옵션, 제목/내용 ILIKE 검색)
 *
 * Response:
 * - notes: 노트 배열 (비밀번호 제외)
 * - nextCursor: 다음 페이지 커서 (없으면 null)
 * - hasMore: 다음 페이지 존재 여부
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '10', 10), 1),
      50
    );
    const search = searchParams.get('search') || undefined;

    const result = await getNoteList(cursor, limit, search);

    return NextResponse.json(result);
  } catch (error) {
    console.error('노트 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '노트 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes - 새 노트 생성
 *
 * Request body:
 * - title: 노트 제목
 * - hostPassword: 호스트 비밀번호 (4자리 숫자)
 * - guestPassword: 게스트 비밀번호 (4자리 숫자)
 *
 * Response:
 * - code: 생성된 노트 코드
 * - note: 노트 객체 (비밀번호 제외)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, hostPassword, guestPassword } = body;

    // Validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: '노트 제목은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!hostPassword || !/^\d{4}$/.test(hostPassword)) {
      return NextResponse.json(
        { error: '호스트 비밀번호는 4자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (!guestPassword || !/^\d{4}$/.test(guestPassword)) {
      return NextResponse.json(
        { error: '게스트 비밀번호는 4자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (hostPassword === guestPassword) {
      return NextResponse.json(
        { error: '호스트와 게스트 비밀번호는 서로 달라야 합니다.' },
        { status: 400 }
      );
    }

    // Create note
    const note = await createNote(title.trim(), hostPassword, guestPassword);

    // Return note without passwords
    return NextResponse.json({
      code: note.note_code,
      participantId: note.participantId,
      note: {
        id: note.id,
        note_code: note.note_code,
        title: note.title,
        content: note.content,
        is_locked: note.is_locked,
        created_at: note.created_at,
        last_modified: note.last_modified,
      },
    });
  } catch (error) {
    console.error('노트 생성 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '노트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
