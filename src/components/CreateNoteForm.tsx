'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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

  const validatePassword = (password: string): boolean => {
    return /^\d{4}$/.test(password);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      sessionStorage.setItem(`note-${data.code}-userId`, data.participantId);

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
        required
        maxLength={100}
      />

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
        required
      />

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
        required
      />

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
          노트 생성
        </Button>
      </div>
    </form>
  );
}
