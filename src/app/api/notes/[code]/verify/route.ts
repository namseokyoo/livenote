import { NextRequest, NextResponse } from 'next/server';
import { getErrorStatus, verifyNoteAccess } from '@/lib/note-service-firebase';

const rateLimitMap = new Map<string, { failCount: number; lockedUntil: number }>();
const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { password, nickname } = body;

    const rateLimit = rateLimitMap.get(noteCode);
    if (rateLimit && rateLimit.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `너무 많은 시도가 있었습니다. ${remainingMinutes}분 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    if (!password || !/^\d{4}$/.test(password)) {
      return NextResponse.json(
        { error: '비밀번호는 4자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    const result = await verifyNoteAccess(noteCode, password, nickname);

    if (!result.valid || !result.role || !result.noteId || !result.userId || !result.note) {
      const currentLimit = rateLimitMap.get(noteCode) || { failCount: 0, lockedUntil: 0 };
      currentLimit.failCount += 1;

      if (currentLimit.failCount >= MAX_FAILURES) {
        currentLimit.lockedUntil = Date.now() + LOCK_DURATION_MS;
        currentLimit.failCount = 0;
        rateLimitMap.set(noteCode, currentLimit);

        return NextResponse.json(
          { error: '너무 많은 시도가 있었습니다. 10분 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }

      rateLimitMap.set(noteCode, currentLimit);

      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    rateLimitMap.delete(noteCode);

    return NextResponse.json({
      role: result.role,
      participantId: result.userId,
      userId: result.userId,
      note: {
        id: result.note.id,
        code: result.note.note_code,
        title: result.note.title,
        content: result.note.content,
        is_locked: result.note.is_locked,
        created_at: result.note.created_at,
        last_modified: result.note.last_modified,
      },
    });
  } catch (error) {
    console.error('비밀번호 검증 오류:', error);
    return NextResponse.json(
      { error: '인증에 실패했습니다.' },
      { status: getErrorStatus(error) }
    );
  }
}
