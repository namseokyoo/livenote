'use client';

import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  type Unsubscribe,
} from 'firebase/database';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { getRtdb, signInAnonymouslyIfNeeded } from '@/lib/firebase';

const FIREBASE_AWARENESS_ORIGIN = 'firebase-awareness';

type AwarenessRecord = {
  clientId?: number;
  update?: string;
};

function uint8ArrayToBase64(value: Uint8Array): string {
  let binary = '';

  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export class FirebaseAwarenessProvider {
  awareness: Awareness;

  private localRef;
  private roomRef;
  private unsubscribeRoom: Unsubscribe | null = null;
  private remoteClients = new Map<string, number>();
  private remoteUpdates = new Map<string, string>();
  private destroyed = false;

  constructor(
    private readonly noteId: string,
    private readonly userId: string,
    private readonly ydoc: Y.Doc
  ) {
    this.awareness = new Awareness(ydoc);
    const rtdb = getRtdb();
    this.localRef = ref(rtdb, `awareness/${noteId}/${userId}`);
    this.roomRef = ref(rtdb, `awareness/${noteId}`);
    this.handleLocalAwarenessUpdate = this.handleLocalAwarenessUpdate.bind(this);
    this.handleRoomSnapshot = this.handleRoomSnapshot.bind(this);

    this.awareness.on('update', this.handleLocalAwarenessUpdate);
    void this.connect();
  }

  private async connect() {
    if (!this.noteId || !this.userId || this.destroyed) {
      return;
    }

    try {
      await signInAnonymouslyIfNeeded();

      if (this.destroyed) {
        return;
      }

      this.unsubscribeRoom = onValue(this.roomRef, this.handleRoomSnapshot);
      await this.writeLocalState();
      await onDisconnect(this.localRef).remove();
    } catch (error) {
      console.error('[FirebaseAwarenessProvider] 연결 실패:', error);
    }
  }

  private handleRoomSnapshot(snapshot: { val: () => Record<string, AwarenessRecord> | null }) {
    if (this.destroyed) {
      return;
    }

    const roomData = snapshot.val() ?? {};
    const nextRemoteClients = new Map<string, number>();

    Object.entries(roomData).forEach(([remoteUserId, record]) => {
      if (remoteUserId === this.userId) {
        return;
      }

      if (typeof record?.clientId !== 'number' || typeof record?.update !== 'string') {
        return;
      }

      nextRemoteClients.set(remoteUserId, record.clientId);

      if (this.remoteUpdates.get(remoteUserId) === record.update) {
        return;
      }

      applyAwarenessUpdate(
        this.awareness,
        base64ToUint8Array(record.update),
        FIREBASE_AWARENESS_ORIGIN
      );
      this.remoteUpdates.set(remoteUserId, record.update);
    });

    this.remoteClients.forEach((clientId, remoteUserId) => {
      if (nextRemoteClients.has(remoteUserId)) {
        return;
      }

      removeAwarenessStates(this.awareness, [clientId], FIREBASE_AWARENESS_ORIGIN);
      this.remoteUpdates.delete(remoteUserId);
    });

    this.remoteClients = nextRemoteClients;
  }

  private handleLocalAwarenessUpdate(
    payload: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) {
    if (this.destroyed || origin === FIREBASE_AWARENESS_ORIGIN) {
      return;
    }

    const changedClients = [...payload.added, ...payload.updated, ...payload.removed];

    if (!changedClients.includes(this.awareness.clientID)) {
      return;
    }

    void this.writeLocalState();
  }

  private async writeLocalState() {
    if (this.destroyed) {
      return;
    }

    const encodedUpdate = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);

    await set(this.localRef, {
      clientId: this.awareness.clientID,
      update: uint8ArrayToBase64(encodedUpdate),
      updatedAt: serverTimestamp(),
    });
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.unsubscribeRoom?.();
    this.unsubscribeRoom = null;
    this.awareness.off('update', this.handleLocalAwarenessUpdate);

    if (this.remoteClients.size > 0) {
      removeAwarenessStates(
        this.awareness,
        Array.from(this.remoteClients.values()),
        FIREBASE_AWARENESS_ORIGIN
      );
    }

    void onDisconnect(this.localRef).cancel().catch(() => undefined);
    void remove(this.localRef).catch(() => undefined);
    this.awareness.destroy();
  }
}
