import { NextRequest, NextResponse } from 'next/server';
import { getErrorStatus, leaveNoteByCode } from '@/lib/note-service-firebase';

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

    let userId: string | undefined;

    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      const text = await request.text();
      try {
        const parsed = JSON.parse(text);
        userId = parsed.userId;
      } catch {
        userId = undefined;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    await leaveNoteByCode(noteCode, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave note error:', error);
    return NextResponse.json(
      { error: 'Failed to leave note' },
      { status: getErrorStatus(error) }
    );
  }
}
