'use client';

import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface DeleteNoteModalProps {
  noteCode: string;
  noteTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * 노트 삭제 확인 모달 컴포넌트
 * 호스트 비밀번호 재입력으로 삭제 확인
 */
export function DeleteNoteModal({
  noteCode,
  noteTitle,
  isOpen,
  onClose,
  onDeleted,
}: DeleteNoteModalProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setPassword('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 비밀번호 검증
    if (!/^\d{4}$/.test(password)) {
      setError('비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${noteCode}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '삭제에 실패했습니다.');
        return;
      }

      // 삭제 성공
      onDeleted();
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="노트 삭제">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 bg-red-50 rounded-lg border border-red-100">
          <p className="text-sm text-red-800">
            <span className="font-semibold">&quot;{noteTitle}&quot;</span> 노트를
            삭제하시겠습니까?
          </p>
          <p className="text-xs text-red-600 mt-2">
            이 작업은 되돌릴 수 없습니다. 노트의 모든 내용과 참여자 정보가
            삭제됩니다.
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">
            삭제를 확인하려면 호스트 비밀번호를 입력하세요.
          </p>
          <Input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="호스트 비밀번호 (4자리 숫자)"
            value={password}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPassword(value);
            }}
            disabled={isLoading}
            autoFocus
          />
        </div>

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
            className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500"
          >
            {isLoading ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
