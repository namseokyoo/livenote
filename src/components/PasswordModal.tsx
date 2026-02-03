'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { NoteCardData } from './NoteCard';

interface PasswordModalProps {
  note: NoteCardData | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 비밀번호 입력 모달 컴포넌트
 * 비밀번호 + 닉네임 입력 후 검증하여 노트 페이지로 이동
 */
export function PasswordModal({ note, isOpen, onClose }: PasswordModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setPassword('');
    setNickname('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!note) return;

    // 비밀번호 검증
    if (!/^\d{4}$/.test(password)) {
      setError('비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${note.note_code}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          nickname: nickname.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '인증에 실패했습니다.');
        return;
      }

      // 세션 정보 저장 (sessionStorage) - page.tsx와 동일한 키 형식 사용
      sessionStorage.setItem(`note-${note.note_code}-auth`, 'true');
      sessionStorage.setItem(`note-${note.note_code}-role`, data.role);
      sessionStorage.setItem(`note-${note.note_code}-nickname`, nickname.trim() || (data.role === 'host' ? '호스트' : '게스트'));
      sessionStorage.setItem(`note-${note.note_code}-timestamp`, Date.now().toString());
      sessionStorage.setItem(`note-${note.note_code}-userId`, data.userId);

      // 노트 페이지로 이동 (replace 사용으로 히스토리에서 제거 - 뒤로가기 방지)
      router.replace(`/note/${note.note_code}`);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!note) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="노트 참여">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-medium text-gray-900">{note.title}</span>에
            참여하려면 비밀번호를 입력하세요.
          </p>
        </div>

        <Input
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="비밀번호 (4자리 숫자)"
          value={password}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 4);
            setPassword(value);
          }}
          disabled={isLoading}
          autoFocus
        />

        <Input
          type="text"
          placeholder="닉네임 (선택)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          disabled={isLoading}
        />

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || password.length !== 4}
            className="flex-1"
          >
            {isLoading ? '확인 중...' : '참여하기'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
