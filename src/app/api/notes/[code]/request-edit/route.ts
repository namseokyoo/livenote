import { NextRequest, NextResponse } from 'next/server';
import {
  getErrorCooldown,
  getErrorStatus,
  requestEditPermissionForUser,
} from '@/lib/note-service-firebase';

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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    await requestEditPermissionForUser(noteCode, userId);

    return NextResponse.json({
      success: true,
      message: '편집 권한을 요청했습니다.',
    });
  } catch (error) {
    console.error('편집 권한 요청 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '편집 권한 요청에 실패했습니다.',
        cooldownSeconds: getErrorCooldown(error),
      },
      { status: getErrorStatus(error, 400) }
    );
  }
}
