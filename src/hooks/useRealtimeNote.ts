'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onValue, ref, update } from 'firebase/database';
import { getRtdb, signInAnonymouslyIfNeeded } from '@/lib/firebase';
import { EMPTY_TIPTAP_DOC } from '@/lib/tiptap';
import { tiptapJsonToText } from '@/lib/note-service';
import type { TiptapContent } from '@/types/note';

export interface UseRealtimeNoteOptions {
  noteId: string;
  initialContentJson: TiptapContent | null;
  onContentChange?: (contentJson: TiptapContent) => void;
}

export interface UseRealtimeNoteReturn {
  contentJson: TiptapContent | null;
  setContentJson: (contentJson: TiptapContent) => void;
  saveContent: () => Promise<void>;
  isSaving: boolean;
  lastSaved: Date | null;
  isConnected: boolean;
  error: Error | null;
}

const DEBOUNCE_DELAY = 500;

function isContentJsonEqual(left: TiptapContent | null, right: TiptapContent | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function useRealtimeNote({
  noteId,
  initialContentJson,
  onContentChange,
}: UseRealtimeNoteOptions): UseRealtimeNoteReturn {
  const [contentJson, setContentJsonState] = useState<TiptapContent | null>(initialContentJson);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const previousNoteIdRef = useRef(noteId);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentJsonRef = useRef<TiptapContent | null>(initialContentJson);
  const lastSavedContentRef = useRef<TiptapContent | null>(null);
  const isLocalChangeRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const isSavingRef = useRef(false);
  const onContentChangeRef = useRef(onContentChange);
  const saveContentRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const saveContent = useCallback(async () => {
    if (!noteId || isSavingRef.current) {
      return;
    }

    const rtdb = getRtdb();
    const nextContentJson = lastContentJsonRef.current ?? EMPTY_TIPTAP_DOC;

    try {
      isSavingRef.current = true;
      setIsSaving(true);

      const authUserId = await signInAnonymouslyIfNeeded();
      const now = Date.now();

      await update(ref(rtdb, `notes/${noteId}`), {
        lastModified: now,
        contentJson: nextContentJson,
        content: tiptapJsonToText(nextContentJson),
        updatedAt: now,
        updatedBy: authUserId,
      });

      lastSavedContentRef.current = nextContentJson;
      pendingSaveRef.current = false;
      setLastSaved(new Date());
      setError(null);
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError : new Error('저장 실패');
      setError(nextError);
      throw nextError;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [noteId]);

  useEffect(() => {
    saveContentRef.current = saveContent;
  }, [saveContent]);

  const scheduleSave = useCallback(() => {
    clearSaveTimer();

    saveTimerRef.current = setTimeout(() => {
      void saveContentRef.current().catch(console.error);
    }, DEBOUNCE_DELAY);
  }, [clearSaveTimer]);

  const setContentJson = useCallback((nextContentJson: TiptapContent) => {
    if (isContentJsonEqual(lastContentJsonRef.current, nextContentJson)) {
      return;
    }

    lastContentJsonRef.current = nextContentJson;
    setContentJsonState(nextContentJson);
    onContentChangeRef.current?.(nextContentJson);
    pendingSaveRef.current = true;
    isLocalChangeRef.current = true;
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    const noteChanged = previousNoteIdRef.current !== noteId;
    previousNoteIdRef.current = noteId;

    if (!noteId) {
      clearSaveTimer();
      lastContentJsonRef.current = initialContentJson;
      lastSavedContentRef.current = null;
      pendingSaveRef.current = false;
      isLocalChangeRef.current = false;
      setContentJsonState(initialContentJson);
      setIsConnected(false);
      setError(null);
      return;
    }

    if (!noteChanged && isContentJsonEqual(initialContentJson, lastContentJsonRef.current)) {
      return;
    }

    clearSaveTimer();
    lastContentJsonRef.current = initialContentJson;
    lastSavedContentRef.current = null;
    pendingSaveRef.current = false;
    isLocalChangeRef.current = false;
    setContentJsonState(initialContentJson);
  }, [clearSaveTimer, initialContentJson, noteId]);

  useEffect(() => {
    if (!noteId) {
      return;
    }

    let unsubscribe: () => void = () => undefined;
    let disposed = false;
    const rtdb = getRtdb();

    const subscribe = async () => {
      try {
        await signInAnonymouslyIfNeeded();

        if (disposed) {
          return;
        }

        unsubscribe = onValue(
          ref(rtdb, `notes/${noteId}`),
          (snapshot) => {
            setIsConnected(true);
            setError(null);

            if (!snapshot.exists()) {
              return;
            }

            const snapshotData = snapshot.val() as { contentJson?: TiptapContent | null };
            const nextContentJson = snapshotData.contentJson ?? null;

            if (
              isLocalChangeRef.current &&
              isContentJsonEqual(nextContentJson, lastSavedContentRef.current)
            ) {
              isLocalChangeRef.current = false;
              return;
            }

            if (isContentJsonEqual(nextContentJson, lastContentJsonRef.current)) {
              return;
            }

            clearSaveTimer();
            pendingSaveRef.current = false;
            isLocalChangeRef.current = false;
            lastContentJsonRef.current = nextContentJson;
            setContentJsonState(nextContentJson);

            if (nextContentJson) {
              onContentChangeRef.current?.(nextContentJson);
            }
          },
          (snapshotError) => {
            setIsConnected(false);
            setError(snapshotError instanceof Error ? snapshotError : new Error('실시간 동기화 실패'));
          }
        );
      } catch (subscribeError) {
        setIsConnected(false);
        setError(subscribeError instanceof Error ? subscribeError : new Error('실시간 동기화 실패'));
      }
    };

    void subscribe();

    return () => {
      disposed = true;
      unsubscribe();
      setIsConnected(false);
    };
  }, [clearSaveTimer, noteId]);

  useEffect(() => clearSaveTimer, [clearSaveTimer]);

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
