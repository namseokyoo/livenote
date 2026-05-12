# LiveNote Rate Limit Shared-State Decision

Date: 2026-05-12
Task ID: `livenote-firebase-cloud-run-migration`
Status: Adopted for migration planning

## Problem

The current in-memory rate limit model is weak under Cloud Run scale-out. Each container instance has its own memory, so a user or attacker can exceed the intended global limit when traffic is distributed across instances or instances restart.

## Decision

For production cutover, LiveNote must use a shared-state limiter or explicitly scope in-memory limiting to preview-only.

Recommended migration path:

1. **Preview stage**: in-memory limiter may remain only if documented as preview-only and combined with low-traffic/manual testing.
2. **Production cutover gate**: implement a Firebase-backed shared limiter first, unless a stronger external store is selected.
3. **Future hardening**: consider Redis/Memorystore if Firebase-backed limiter becomes too slow, costly, or contention-prone.

## Preferred MVP implementation

Use Firebase RTDB or Firestore as shared state for rate limits.

Suggested keys:

```text
rateLimits/ip/<hash(ip)>/<window>
rateLimits/note/<noteCodeHash>/<window>
rateLimits/action/<action>/<hash(subject)>/<window>
```

Suggested action dimensions:

| Action | Subject | Purpose |
|---|---|---|
| `create_note` | IP/device/session | Prevent note creation abuse. |
| `verify_note` | IP + note code hash | Prevent brute-force private note access. |
| `request_edit` | IP + note code hash | Prevent edit request spam. |
| `respond_edit` | IP + note code hash | Prevent response spam. |
| `save_note` | note code hash + session/client | Prevent write flood. |

## Atomicity requirement

The limiter must use an atomic transaction or equivalent server-side compare/update where available.

Acceptable MVP:
- RTDB transaction on the counter node; or
- Firestore transaction; or
- another shared service with atomic increment + expiry.

Not acceptable for production:
- process-local memory only;
- client-enforced limits only;
- non-atomic read-then-write counters under concurrent requests.

## Expiry / cleanup

Use one of:

- windowed keys that can be periodically cleaned;
- TTL support if using Firestore TTL-compatible documents;
- scheduled cleanup job for old RTDB nodes.

## Privacy

Do not store raw IPs when a salted hash is sufficient. Keep any salt/pepper server-only.

## Preview waiver

A preview-only waiver may be used if all are true:

```yaml
waiver:
  task_id: livenote-firebase-cloud-run-migration
  approved_scope: preview-only
  reason: manual low-traffic Cloud Run/Firebase connectivity smoke
  expires: before production cutover
  required_followup: shared-state limiter before production PASS
```

## Verification

Before production PASS:

1. Demonstrate shared-state counter update from two separate requests.
2. Demonstrate limit exceeded response for the chosen action.
3. Confirm limiter survives process restart or Cloud Run instance change.
4. Confirm no raw secrets or raw unnecessary identifiers are stored.
5. Confirm old windows can be expired or cleaned.

## Verdict

- `PASS`: shared-state limiter implemented and verified for the selected production-critical actions.
- `CONDITIONAL`: in-memory limiter remains only for preview with explicit waiver and follow-up gate.
- `FAIL`: production migration claims readiness while relying solely on process-local memory.
