import { NextRequest, NextResponse } from 'next/server';
import { getErrorStatus, respondToEditPermission } from '@/lib/note-service-firebase';

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
    const { hostUserId, targetUserId, approved } = body;

    if (!hostUserId || !targetUserId || approved === undefined) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    await respondToEditPermission(noteCode, hostUserId, targetUserId, Boolean(approved));

    return NextResponse.json({
      success: true,
      message: approved ? '편집 권한을 승인했습니다.' : '편집 권한 요청을 거부했습니다.',
    });
  } catch (error) {
    console.error('편집 권한 응답 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '편집 권한 응답에 실패했습니다.',
      },
      { status: getErrorStatus(error, 400) }
    );
  }
}
