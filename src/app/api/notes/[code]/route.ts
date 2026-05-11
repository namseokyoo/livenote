import { NextRequest, NextResponse } from 'next/server';
import type { TiptapContent } from '@/types/note';
import {
  deleteNoteByCode,
  getAdminNoteByCode,
  getErrorStatus,
  textToTiptapJson,
  updateNoteByCode,
} from '@/lib/note-service-firebase';
import {
  buildRateLimitKey,
  clearRateLimit,
  createRtdbRateLimitStore,
  getRateLimitStatus,
  recordRateLimitFailure,
} from '@/lib/rate-limit-service';

const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;
const deleteRateLimitStore = createRtdbRateLimitStore('rateLimits/delete');
const MAX_TITLE_LENGTH = 200;

function sanitizeTitle(title: string): string {
  return title.replace(/<[^>]*>/g, '').trim();
}

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();

    const note = await getAdminNoteByCode(noteCode);

    if (!note) {
      return NextResponse.json(
        { error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: note.id,
      code: note.note_code,
      title: note.title,
      content: note.content,
      content_json: note.content_json || textToTiptapJson(note.content),
      is_locked: note.is_locked,
      created_at: note.created_at,
      last_modified: note.last_modified,
    });
  } catch (error) {
    console.error('노트 조회 오류:', error);
    return NextResponse.json(
      { error: '노트 조회에 실패했습니다.' },
      { status: getErrorStatus(error) }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { title, content, content_json, userId } = body as {
      title?: string;
      content?: string;
      content_json?: TiptapContent;
      userId?: string;
    };

    if (title !== undefined && typeof title !== 'string') {
      return NextResponse.json(
        { error: '노트 제목은 문자열이어야 합니다.' },
        { status: 400 }
      );
    }

    const sanitizedTitle = title === undefined
      ? undefined
      : sanitizeTitle(title);

    if (sanitizedTitle !== undefined && sanitizedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: '노트 제목은 200자를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    const updatedNote = await updateNoteByCode(noteCode, {
      title: sanitizedTitle,
      content,
      contentJson: content_json,
      updatedBy: userId,
    });

    if (!updatedNote) {
      return NextResponse.json(
        { error: '노트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedNote.id,
      code: updatedNote.note_code,
      title: updatedNote.title,
      content: updatedNote.content,
      content_json: updatedNote.content_json || textToTiptapJson(updatedNote.content),
      is_locked: updatedNote.is_locked,
      last_modified: updatedNote.last_modified,
    });
  } catch (error) {
    console.error('노트 업데이트 오류:', error);
    return NextResponse.json(
      { error: '노트 업데이트에 실패했습니다.' },
      { status: getErrorStatus(error) }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params;
    const noteCode = code.toUpperCase();
    const body = await request.json();
    const { password } = body;

    const rateLimitKey = buildRateLimitKey('delete', noteCode, 'all-clients');
    const rateLimit = await getRateLimitStatus(deleteRateLimitStore, rateLimitKey);
    if (rateLimit.locked) {
      const remainingMinutes = Math.ceil(rateLimit.remainingMs / 60000);
      return NextResponse.json(
        {
          error: `너무 많은 시도가 있었습니다. ${remainingMinutes}분 후 다시 시도해주세요.`,
          code: 'RATE_LIMITED',
          retryAfterMs: rateLimit.remainingMs,
        },
        { status: 429 }
      );
    }

    if (!password || !/^\d{4}$/.test(password)) {
      return NextResponse.json(
        { error: '비밀번호는 4자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    const deleted = await deleteNoteByCode(noteCode, password);

    if (!deleted) {
      const failedLimit = await recordRateLimitFailure(deleteRateLimitStore, rateLimitKey, {
        maxFailures: MAX_FAILURES,
        lockDurationMs: LOCK_DURATION_MS,
      });

      if (failedLimit.locked) {
        const remainingMinutes = Math.ceil(failedLimit.remainingMs / 60000);
        return NextResponse.json(
          {
            error: `너무 많은 시도가 있었습니다. ${remainingMinutes}분 후 다시 시도해주세요.`,
            code: 'RATE_LIMITED',
            retryAfterMs: failedLimit.remainingMs,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    await clearRateLimit(deleteRateLimitStore, rateLimitKey);

    return NextResponse.json(
      { message: '노트가 삭제되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('노트 삭제 오류:', error);
    return NextResponse.json(
      { error: '노트 삭제에 실패했습니다.' },
      { status: getErrorStatus(error) }
    );
  }
}
