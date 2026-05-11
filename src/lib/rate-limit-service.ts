import { createHash } from 'crypto';
import { getAdminRtdb } from './firebase-admin';

export type RateLimitRecord = {
  failCount: number;
  lockedUntil: number;
  updatedAt: number;
};

export type RateLimitStatus = RateLimitRecord & {
  locked: boolean;
  remainingMs: number;
};

export type RateLimitOptions = {
  maxFailures?: number;
  lockDurationMs?: number;
  now?: () => number;
};

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  set(key: string, record: RateLimitRecord): Promise<void>;
  remove(key: string): Promise<void>;
  recordFailure?(key: string, options: Required<Pick<RateLimitOptions, 'maxFailures' | 'lockDurationMs' | 'now'>>): Promise<RateLimitRecord>;
}

function nextFailureRecord(
  current: RateLimitRecord | null,
  now: number,
  maxFailures: number,
  lockDurationMs: number
): RateLimitRecord {
  const activeRecord = current && current.lockedUntil > now ? current : current?.lockedUntil && current.lockedUntil <= now ? null : current;
  const nextFailCount = (activeRecord?.failCount ?? 0) + 1;

  return nextFailCount >= maxFailures
    ? {
        failCount: 0,
        lockedUntil: now + lockDurationMs,
        updatedAt: now,
      }
    : {
        failCount: nextFailCount,
        lockedUntil: 0,
        updatedAt: now,
      };
}

const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_LOCK_DURATION_MS = 10 * 60 * 1000;

function getNow(options?: RateLimitOptions): number {
  return options?.now?.() ?? Date.now();
}

function normalizeRecord(record: Partial<RateLimitRecord> | null | undefined): RateLimitRecord | null {
  if (!record) {
    return null;
  }

  return {
    failCount: Number.isFinite(record.failCount) ? Number(record.failCount) : 0,
    lockedUntil: Number.isFinite(record.lockedUntil) ? Number(record.lockedUntil) : 0,
    updatedAt: Number.isFinite(record.updatedAt) ? Number(record.updatedAt) : 0,
  };
}

export function createMemoryRateLimitStore(seed: Record<string, RateLimitRecord> = {}): RateLimitStore & {
  dump(): Record<string, RateLimitRecord>;
} {
  const records = new Map<string, RateLimitRecord>(Object.entries(seed));

  return {
    async get(key: string) {
      return records.get(key) ?? null;
    },
    async set(key: string, record: RateLimitRecord) {
      records.set(key, { ...record });
    },
    async remove(key: string) {
      records.delete(key);
    },
    async recordFailure(key: string, options: Required<Pick<RateLimitOptions, 'maxFailures' | 'lockDurationMs' | 'now'>>) {
      const now = options.now();
      const nextRecord = nextFailureRecord(records.get(key) ?? null, now, options.maxFailures, options.lockDurationMs);
      records.set(key, { ...nextRecord });
      return nextRecord;
    },
    dump() {
      return Object.fromEntries(records.entries());
    },
  };
}

export function createRtdbRateLimitStore(pathPrefix = 'rateLimits'): RateLimitStore {
  const getRoot = () => getAdminRtdb().ref(pathPrefix);

  return {
    async get(key: string) {
      const snapshot = await getRoot().child(key).get();
      return normalizeRecord(snapshot.val() as Partial<RateLimitRecord> | null);
    },
    async set(key: string, record: RateLimitRecord) {
      await getRoot().child(key).set(record);
    },
    async remove(key: string) {
      await getRoot().child(key).remove();
    },
    async recordFailure(key: string, options: Required<Pick<RateLimitOptions, 'maxFailures' | 'lockDurationMs' | 'now'>>) {
      const now = options.now();
      let committedRecord: RateLimitRecord | null = null;

      const result = await getRoot().child(key).transaction((current) => {
        const nextRecord = nextFailureRecord(
          normalizeRecord(current as Partial<RateLimitRecord> | null),
          now,
          options.maxFailures,
          options.lockDurationMs
        );
        committedRecord = nextRecord;
        return nextRecord;
      });

      return normalizeRecord(result.snapshot.val() as Partial<RateLimitRecord> | null)
        ?? committedRecord
        ?? {
          failCount: 0,
          lockedUntil: 0,
          updatedAt: now,
        };
    },
  };
}

export function hashRateLimitPart(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function buildRateLimitKey(scope: string, noteCode: string, clientFingerprint: string): string {
  return [
    scope,
    hashRateLimitPart(noteCode.trim().toUpperCase()),
    hashRateLimitPart(clientFingerprint || 'unknown-client'),
  ].join('/');
}

export function getClientFingerprint(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();
  const userAgent = headers.get('user-agent')?.trim();

  return [forwardedFor || realIp || 'unknown-ip', userAgent || 'unknown-ua'].join('|');
}

export async function getRateLimitStatus(
  store: RateLimitStore,
  key: string,
  options: Pick<RateLimitOptions, 'now'> = {}
): Promise<RateLimitStatus> {
  const now = getNow(options);
  const record = normalizeRecord(await store.get(key));

  if (!record) {
    return {
      failCount: 0,
      lockedUntil: 0,
      updatedAt: now,
      locked: false,
      remainingMs: 0,
    };
  }

  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    await store.remove(key);
    return {
      failCount: 0,
      lockedUntil: 0,
      updatedAt: now,
      locked: false,
      remainingMs: 0,
    };
  }

  const remainingMs = Math.max(0, record.lockedUntil - now);

  return {
    ...record,
    locked: remainingMs > 0,
    remainingMs,
  };
}

export async function recordRateLimitFailure(
  store: RateLimitStore,
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitStatus> {
  const now = getNow(options);
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES;
  const lockDurationMs = options.lockDurationMs ?? DEFAULT_LOCK_DURATION_MS;
  const current = await getRateLimitStatus(store, key, { now: () => now });

  if (current.locked) {
    return current;
  }

  if (store.recordFailure) {
    const atomicRecord = await store.recordFailure(key, {
      maxFailures,
      lockDurationMs,
      now: () => now,
    });
    return getRateLimitStatus({ ...store, get: async () => atomicRecord }, key, { now: () => now });
  }

  const nextRecord = nextFailureRecord(current, now, maxFailures, lockDurationMs);

  await store.set(key, nextRecord);
  return getRateLimitStatus(store, key, { now: () => now });
}

export async function clearRateLimit(store: RateLimitStore, key: string): Promise<void> {
  await store.remove(key);
}
