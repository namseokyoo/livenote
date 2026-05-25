'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { NoteVisibility } from '@/types/note';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface CreateNoteFormProps {
  onCancel?: () => void;
}

export function CreateNoteForm({ onCancel }: CreateNoteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [hostPassword, setHostPassword] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('public');

  const validatePassword = (password: string): boolean => {
    return /^\d{4}$/.test(password);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);

    // Validation
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!validatePassword(hostPassword)) {
      setError('호스트 비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (!validatePassword(guestPassword)) {
      setError('게스트 비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (hostPassword === guestPassword) {
      setError('호스트와 게스트 비밀번호는 서로 달라야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          hostPassword,
          guestPassword,
          visibility,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '노트 생성에 실패했습니다.');
      }

      const data = await response.json();

      // Store authentication in sessionStorage
      sessionStorage.setItem(`note-${data.code}-role`, 'host');
      sessionStorage.setItem(`note-${data.code}-auth`, 'true');
      sessionStorage.setItem(`note-${data.code}-nickname`, '호스트');
      sessionStorage.setItem(`note-${data.code}-timestamp`, Date.now().toString());
      sessionStorage.setItem(`note-${data.code}-userId`, data.userId || data.participantId);

      router.replace(`/note/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="노트 제목"
        placeholder="제목을 입력하세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isLoading}
        required
        maxLength={100}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">공개 범위</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-start gap-2 rounded-lg border border-gray-300 p-3 text-sm">
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={visibility === 'public'}
              onChange={() => setVisibility('public')}
              disabled={isLoading}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-gray-900">공개</span>
              <span className="block text-xs text-gray-500">최근 노트와 검색에 표시</span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-gray-300 p-3 text-sm">
            <input
              type="radio"
              name="visibility"
              value="unlisted"
              checked={visibility === 'unlisted'}
              onChange={() => setVisibility('unlisted')}
              disabled={isLoading}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-gray-900">링크 전용</span>
              <span className="block text-xs text-gray-500">코드나 링크로만 접근</span>
            </span>
          </label>
        </div>
        {visibility === 'unlisted' && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
            링크 전용 노트는 목록에 보이지 않습니다. 나중에 다시 열려면 코드나 링크를 따로 보관하세요.
          </p>
        )}
      </fieldset>

      <Input
        label="호스트 비밀번호"
        type="password"
        placeholder="4자리 숫자"
        value={hostPassword}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '').slice(0, 4);
          setHostPassword(value);
        }}
        inputMode="numeric"
        maxLength={4}
        disabled={isLoading}
        required
      />
      <p className="-mt-2 text-xs text-gray-500">
        호스트 비밀번호는 제목 편집, 삭제, 게스트 편집 권한 관리에 사용됩니다.
      </p>

      <Input
        label="게스트 비밀번호"
        type="password"
        placeholder="4자리 숫자"
        value={guestPassword}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '').slice(0, 4);
          setGuestPassword(value);
        }}
        inputMode="numeric"
        maxLength={4}
        disabled={isLoading}
        required
      />
      <p className="-mt-2 text-xs text-gray-500">
        비밀번호는 각각 4자리 숫자이며 서로 달라야 합니다. 생성된 코드와 링크는 노트를 다시 여는 데 필요합니다.
      </p>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            취소
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="flex-1"
        >
          {isLoading ? '생성 중...' : '노트 생성'}
        </Button>
      </div>
    </form>
  );
}
