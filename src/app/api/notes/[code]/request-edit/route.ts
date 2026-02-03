import { NextRequest, NextResponse } from 'next/server';
import { getNoteByCode, requestEditPermission } from '@/lib/note-service';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/notes/[code]/request-edit - 편집 권한 요청 (게스트 전용)
 *
 * Request body:
 * - userId: 요청자 UUID
 *
 * Response:
 * - success: boolean
 * - message: string
 * - cooldownSeconds?: number (쿨다운 중인 경우)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId가 필요합니다.' },
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

    await requestEditPermission(note.id, userId);

    return NextResponse.json({
      success: true,
      message: '편집 권한을 요청했습니다.',
    });
  } catch (error) {
    console.error('편집 권한 요청 오류:', error);

    // 쿨다운 에러 메시지에서 남은 시간 추출
    const errorMessage = error instanceof Error ? error.message : '편집 권한 요청에 실패했습니다.';
    const cooldownMatch = errorMessage.match(/(\d+)초 후/);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        cooldownSeconds: cooldownMatch ? parseInt(cooldownMatch[1]) : undefined,
      },
      { status: 400 }
    );
  }
}
