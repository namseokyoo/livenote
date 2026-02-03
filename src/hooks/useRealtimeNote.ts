import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { updateNoteContentJson } from '@/lib/note-service';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TiptapContent } from '@/types/note';

/**
 * 실시간 노트 동기화 훅 옵션
 */
export interface UseRealtimeNoteOptions {
  /** 노트 UUID */
  noteId: string;
  /** 초기 노트 내용 (Tiptap JSON) */
  initialContentJson: TiptapContent | null;
  /** 노트 내용 변경 시 콜백 (다른 사용자 변경 수신 시) */
  onContentChange?: (contentJson: TiptapContent) => void;
}

/**
 * 실시간 노트 동기화 훅 반환값
 */
export interface UseRealtimeNoteReturn {
  /** 현재 노트 내용 (Tiptap JSON) */
  contentJson: TiptapContent | null;
  /** 노트 내용 설정 (로컬) - 로컬 변경 시 호출 */
  setContentJson: (contentJson: TiptapContent) => void;
  /** 노트 내용 저장 (서버) */
  saveContent: () => Promise<void>;
  /** 저장 중 여부 */
  isSaving: boolean;
  /** 마지막 저장 시간 */
  lastSaved: Date | null;
  /** Realtime 연결 상태 */
  isConnected: boolean;
  /** 연결 에러 */
  error: Error | null;
}

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 500;
/** 폴링 간격 (ms) - Realtime 실패 시 fallback */
const POLLING_INTERVAL = 3000;
/** 재연결 시도 최대 횟수 */
const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * 노트 내용 실시간 동기화 훅
 *
 * 기능:
 * - Supabase Realtime으로 notes 테이블 변경 구독 (content_json 기반)
 * - 폴링 하이브리드 (Realtime 실패 시 3초 폴링 fallback)
 * - 로컬 변경은 즉시 반영, 서버 변경은 구독으로 수신
 * - 디바운스된 저장 (500ms)
 *
 * @param options - 훅 옵션
 * @returns 실시간 노트 상태 및 액션
 */
export function useRealtimeNote({
  noteId,
  initialContentJson,
  onContentChange,
}: UseRealtimeNoteOptions): UseRealtimeNoteReturn {
  // 상태
  const [contentJson, setContentJsonState] = useState<TiptapContent | null>(initialContentJson);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastContentJsonRef = useRef<TiptapContent | null>(contentJson);
  const isLocalChangeRef = useRef(false);
  // 저장 대기 중 여부 (디바운스 중)
  const pendingSaveRef = useRef(false);

  // 로컬 콘텐츠 참조 업데이트
  useEffect(() => {
    lastContentJsonRef.current = contentJson;
  }, [contentJson]);

  /**
   * JSON 비교 헬퍼 함수
   */
  const isContentJsonEqual = useCallback((a: TiptapContent | null, b: TiptapContent | null): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }, []);

  /**
   * 서버에서 노트 내용 가져오기 (폴링용)
   */
  const fetchNoteContent = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('content_json')
        .eq('id', noteId)
        .single();

      if (fetchError) {
        throw new Error(`노트 조회 실패: ${fetchError.message}`);
      }

      // 로컬 변경이 아닌 경우에만 업데이트
      if (data && !isLocalChangeRef.current) {
        const newContentJson = data.content_json as TiptapContent | null;
        if (!isContentJsonEqual(newContentJson, lastContentJsonRef.current)) {
          setContentJsonState(newContentJson);
          if (newContentJson) {
            onContentChange?.(newContentJson);
          }
        }
      }
    } catch (err) {
      console.error('[useRealtimeNote] 폴링 에러:', err);
    }
  }, [noteId, onContentChange, isContentJsonEqual]);

  /**
   * 폴링 시작 (Realtime fallback)
   */
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(fetchNoteContent, POLLING_INTERVAL);
    console.log('[useRealtimeNote] 폴링 모드 활성화');
  }, [fetchNoteContent]);

  /**
   * 폴링 중지
   */
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  /**
   * 노트 내용 설정 (로컬) - 로컬 변경 시 호출
   */
  const setContentJson = useCallback((newContentJson: TiptapContent) => {
    isLocalChangeRef.current = true;
    pendingSaveRef.current = true;
    setContentJsonState(newContentJson);
  }, []);

  /**
   * 노트 내용 저장 (서버)
   */
  const saveContent = useCallback(async () => {
    if (isSaving || !lastContentJsonRef.current) return;

    try {
      setIsSaving(true);
      await updateNoteContentJson(noteId, lastContentJsonRef.current);
      setLastSaved(new Date());
      setError(null);
      pendingSaveRef.current = false;
    } catch (err) {
      const saveError = err instanceof Error ? err : new Error('저장 실패');
      setError(saveError);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, [noteId, isSaving]);

  /**
   * 디바운스된 자동 저장
   */
  useEffect(() => {
    // 저장 대기 중이 아니면 저장하지 않음
    if (!pendingSaveRef.current) return;

    // 기존 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 새 디바운스 타이머 설정
    debounceTimerRef.current = setTimeout(() => {
      saveContent().catch(console.error);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [contentJson, saveContent]);

  /**
   * Realtime 구독 설정 및 정리
   * 주의: subscribeToChannel은 종속성에서 제외하여 무한 루프 방지
   */
  useEffect(() => {
    // noteId가 유효하지 않으면 구독하지 않음
    if (!noteId || noteId === '') {
      return;
    }

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`note-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${noteId}`,
        },
        (payload) => {
          const newData = payload.new as { content_json: TiptapContent | null };

          // 로컬 변경이 아닌 경우에만 업데이트
          if (!isLocalChangeRef.current && !isContentJsonEqual(newData.content_json, lastContentJsonRef.current)) {
            setContentJsonState(newData.content_json);
            if (newData.content_json) {
              onContentChange?.(newData.content_json);
            }
          }
          isLocalChangeRef.current = false;
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          stopPolling();
          console.log('[useRealtimeNote] Realtime 연결됨');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setError(new Error(`Realtime 연결 실패: ${status}`));
          console.error('[useRealtimeNote] Realtime 연결 실패:', status);

          // 재연결 대신 폴링으로 전환
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
          } else {
            startPolling();
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('[useRealtimeNote] Realtime 연결 종료');
        }
      });

    channelRef.current = channel;

    return () => {
      // 채널 정리
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // 타이머 정리
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 폴링 정리
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]); // noteId만 종속성으로 - 콜백 함수들은 제외하여 무한 루프 방지

  /**
   * 초기 콘텐츠 변경 시 상태 업데이트
   */
  useEffect(() => {
    setContentJsonState(initialContentJson);
  }, [initialContentJson]);

  return {
    contentJson,
    setContentJson,
    saveContent,
    isSaving,
    lastSaved,
    isConnected,
    error,
  };
}
