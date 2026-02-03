import { NextRequest, NextResponse } from 'next/server';
import { leaveNote, getNoteByCode } from '@/lib/note-service';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/notes/[code]/leave - 노트 퇴장 (접속자 정보 삭제)
 *
 * Request body:
 * - userId: 사용자 UUID
 *
 * Response:
 * - success: boolean
 *
 * 주로 navigator.sendBeacon()으로 호출되어 페이지 unload 시에도 전송 보장
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();

    // sendBeacon은 Content-Type이 text/plain일 수 있으므로 안전하게 파싱
    let userId: string | undefined;

    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // JSON 파싱 실패 시 text로 시도
      const text = await request.text();
      try {
        const parsed = JSON.parse(text);
        userId = parsed.userId;
      } catch {
        // 최종 실패
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 노트 조회
    const note = await getNoteByCode(noteCode);
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // 사용자 삭제
    await leaveNote(note.id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave note error:', error);
    return NextResponse.json(
      { error: 'Failed to leave note' },
      { status: 500 }
    );
  }
}
