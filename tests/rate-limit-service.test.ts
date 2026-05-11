import { describe, expect, it } from 'vitest';
import {
  clearRateLimit,
  createMemoryRateLimitStore,
  getRateLimitStatus,
  recordRateLimitFailure,
} from '../src/lib/rate-limit-service';

describe('rate-limit-service', () => {
  it('locks after the configured number of failures and reports remaining milliseconds', async () => {
    let now = 1_000;
    const store = createMemoryRateLimitStore();
    const key = 'verify:ABC123:client-a';

    for (let attempt = 1; attempt < 5; attempt += 1) {
      const result = await recordRateLimitFailure(store, key, {
        maxFailures: 5,
        lockDurationMs: 600_000,
        now: () => now,
      });
      expect(result.locked).toBe(false);
      expect(result.failCount).toBe(attempt);
    }

    const locked = await recordRateLimitFailure(store, key, {
      maxFailures: 5,
      lockDurationMs: 600_000,
      now: () => now,
    });

    expect(locked.locked).toBe(true);
    expect(locked.failCount).toBe(0);
    expect(locked.lockedUntil).toBe(601_000);

    now = 301_000;
    const status = await getRateLimitStatus(store, key, { now: () => now });
    expect(status.locked).toBe(true);
    expect(status.remainingMs).toBe(300_000);
  });

  it('clears an existing lock after successful verification', async () => {
    const store = createMemoryRateLimitStore();
    const key = 'verify:ABC123:client-b';

    await recordRateLimitFailure(store, key, {
      maxFailures: 1,
      lockDurationMs: 600_000,
      now: () => 1_000,
    });

    expect((await getRateLimitStatus(store, key, { now: () => 2_000 })).locked).toBe(true);

    await clearRateLimit(store, key);

    const status = await getRateLimitStatus(store, key, { now: () => 2_000 });
    expect(status.locked).toBe(false);
    expect(status.failCount).toBe(0);
  });

  it('expires stale lock state when lockedUntil is in the past', async () => {
    const store = createMemoryRateLimitStore();
    const key = 'verify:ABC123:client-c';

    await recordRateLimitFailure(store, key, {
      maxFailures: 1,
      lockDurationMs: 10_000,
      now: () => 1_000,
    });

    const status = await getRateLimitStatus(store, key, { now: () => 20_000 });

    expect(status.locked).toBe(false);
    expect(status.failCount).toBe(0);
    expect(await store.get(key)).toBeNull();
  });
});
