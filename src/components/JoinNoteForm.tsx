'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface JoinNoteFormProps {
  onCancel?: () => void;
}

export function JoinNoteForm({ onCancel }: JoinNoteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [noteCode, setNoteCode] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (noteCode.length !== 6) {
      setError('노트 코드는 6자리입니다.');
      return;
    }

    if (!/^\d{4}$/.test(password)) {
      setError('비밀번호는 4자리 숫자입니다.');
      return;
    }

    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/notes/${noteCode}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          nickname: nickname.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '인증에 실패했습니다.');
      }

      const data = await response.json();

      // Store authentication in sessionStorage
      sessionStorage.setItem(`note-${noteCode}-role`, data.role);
      sessionStorage.setItem(`note-${noteCode}-auth`, 'true');
      sessionStorage.setItem(`note-${noteCode}-nickname`, nickname.trim());

      router.push(`/note/${noteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="노트 코드"
        placeholder="6자리 코드 입력"
        value={noteCode}
        onChange={(e) => {
          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
          setNoteCode(value);
        }}
        maxLength={6}
        required
      />

      <Input
        label="비밀번호"
        type="password"
        placeholder="4자리 숫자"
        value={password}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '').slice(0, 4);
          setPassword(value);
        }}
        inputMode="numeric"
        maxLength={4}
        required
      />

      <Input
        label="닉네임"
        placeholder="표시될 이름을 입력하세요"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
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
          참여하기
        </Button>
      </div>
    </form>
  );
}
