import { NextRequest, NextResponse } from 'next/server';
import { getNoteByCode, respondToEditRequest } from '@/lib/note-service';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/notes/[code]/respond-edit - 편집 권한 요청 응답 (호스트 전용)
 *
 * Request body:
 * - hostUserId: 호스트 UUID (검증용)
 * - targetUserId: 대상 사용자 UUID
 * - approved: boolean (승인 여부)
 *
 * Response:
 * - success: boolean
 * - message: string
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { hostUserId, targetUserId, approved } = body;

    if (!hostUserId || !targetUserId || approved === undefined) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const note = await getNoteByCode(noteCode);

    if (!note) {
      return NextResponse.json(
        { success: false, error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await respondToEditRequest(note.id, targetUserId, approved, hostUserId);

    const message = approved
      ? '편집 권한을 승인했습니다.'
      : '편집 권한 요청을 거부했습니다.';

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('편집 권한 응답 오류:', error);

    const errorMessage = error instanceof Error ? error.message : '편집 권한 응답에 실패했습니다.';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
