import { NextRequest, NextResponse } from 'next/server';
import { getNoteByCode, verifyPassword, joinNote } from '@/lib/note-service';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/notes/[code]/verify - 비밀번호 검증 및 노트 참여
 *
 * Request body:
 * - password: 비밀번호 (4자리 숫자)
 * - nickname: 닉네임 (optional)
 *
 * Response:
 * - role: 'host' | 'guest'
 * - note: 노트 객체 (비밀번호 제외)
 * - participantId: 참여자 ID
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { password, nickname } = body;

    // Validation
    if (!password || !/^\d{4}$/.test(password)) {
      return NextResponse.json(
        { error: '비밀번호는 4자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    // Get note
    const note = await getNoteByCode(noteCode);

    if (!note) {
      return NextResponse.json(
        { error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Verify password
    const result = verifyPassword(note, password);

    if (!result.valid || !result.role) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Generate user ID for this session
    const userId = uuidv4();
    const username = nickname?.trim() || (result.role === 'host' ? '호스트' : '게스트');

    // Join note (create participant record)
    const participant = await joinNote(note.id, userId, username, result.role);

    // Return response without passwords
    return NextResponse.json({
      role: result.role,
      participantId: participant.id,
      userId: userId,
      note: {
        id: note.id,
        code: note.note_code,
        title: note.title,
        content: note.content,
        is_locked: note.is_locked,
        created_at: note.created_at,
        last_modified: note.last_modified,
      },
    });
  } catch (error) {
    console.error('비밀번호 검증 오류:', error);
    return NextResponse.json(
      { error: '인증에 실패했습니다.' },
      { status: 500 }
    );
  }
}
