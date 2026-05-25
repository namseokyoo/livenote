import { NextRequest, NextResponse } from 'next/server';
import type { NoteVisibility } from '@/types/note';
import { createNoteWithPasswords, getErrorStatus, listNotes } from '@/lib/note-service-firebase';

const MAX_TITLE_LENGTH = 200;

function sanitizeTitle(title: string): string {
  return title.replace(/<[^>]*>/g, '').trim();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '10', 10), 1),
      50
    );
    const search = searchParams.get('search') || undefined;

    const result = await listNotes(cursor, limit, search);
    return NextResponse.json(result);
  } catch (error) {
    console.error('노트 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '노트 목록을 가져오는데 실패했습니다.' },
      { status: getErrorStatus(error) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, hostPassword, guestPassword } = body;
    const visibility: NoteVisibility = body.visibility === 'unlisted' ? 'unlisted' : 'public';

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: '노트 제목은 필수입니다.' },
        { status: 400 }
      );
    }

    const sanitizedTitle = sanitizeTitle(title);

    if (!sanitizedTitle) {
      return NextResponse.json(
        { error: '노트 제목은 필수입니다.' },
        { status: 400 }
      );
    }

    if (sanitizedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: '노트 제목은 200자를 초과할 수 없습니다.' },
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

    const note = await createNoteWithPasswords(sanitizedTitle, hostPassword, guestPassword, visibility);

    return NextResponse.json({
      code: note.note_code,
      visibility: note.visibility,
      participantId: note.participantId,
      userId: note.participantId,
      note: {
        id: note.id,
        note_code: note.note_code,
        title: note.title,
        content: note.content,
        visibility: note.visibility,
        is_locked: note.is_locked,
        created_at: note.created_at,
        last_modified: note.last_modified,
      },
    });
  } catch (error) {
    console.error('노트 생성 오류:', error);
    return NextResponse.json(
      { error: '노트 생성에 실패했습니다.' },
      { status: getErrorStatus(error) }
    );
  }
}
