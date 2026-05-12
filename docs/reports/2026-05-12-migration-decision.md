# LiveNote Firebase / Cloud Run Migration Decision

Date: 2026-05-12
Status: Adopted for migration planning
Task family: `livenote-firebase-cloud-run-migration`

## Decision

Proceed with a Firebase-fronted Cloud Run migration path for LiveNote.

The preferred production shape is:

```text
Firebase Hosting
  → rewrite dynamic traffic to Cloud Run
  → retain Firebase RTDB for collaboration
  → keep server runtime and secrets off the client
```

Firebase App Hosting remains a spike-only option until compatibility is proven with the current stack.

## Why

The current risk is that Vercel may be blocked or unreliable from the company network. Moving the public entrypoint to Firebase/Google-managed domains has a higher chance of clearing that network path, while Cloud Run preserves the server runtime required by the current Next.js app.

## Chosen path

| Area | Decision |
|---|---|
| Front door | Firebase Hosting |
| Dynamic app runtime | Cloud Run container |
| Rewrites | Firebase Hosting rewrites dynamic routes to Cloud Run |
| Collaboration | Firebase RTDB retained |
| Secrets | Google Secret Manager / runtime env only |
| App Hosting | Spike only; not the primary migration path yet |
| Static Hosting only | Rejected |

## Rejected / deferred options

### Static Firebase Hosting only — rejected

Reason:
- LiveNote requires server runtime behavior.
- Static-only migration risks exposing Admin SDK credentials, pepper values, or server-only logic.

### Firebase App Hosting as primary — deferred

Reason:
- It may work, but must first prove compatibility with Next 16, React 19, and native bcrypt/runtime dependencies.
- Cloud Run gives more explicit control over container build, runtime, secrets, and diagnostics.

### Cloud Run only — acceptable fallback

Reason:
- It preserves runtime control, but loses some Firebase Hosting front-door advantages.
- Use only if Firebase Hosting rewrite adds avoidable complexity or network testing shows `run.app` is sufficient.

## Primary risks

| Risk | Mitigation / gate |
|---|---|
| Company network blocks RTDB WebSocket/realtime traffic | Run RTDB REST + realtime connection checks from the company network before declaring migration successful. |
| Next 16 / React 19 / native bcrypt compatibility issues | Prefer Cloud Run container spike first; keep App Hosting as secondary spike. |
| Secret exposure | Keep Admin SDK/service account/pepper in server runtime only; use Secret Manager or Cloud Run runtime env. |
| Rate limit weakens under scale-out | Replace or supplement in-memory limiter with Firebase-backed or external shared limiter before production cutover. |
| Preview appears healthy but collaboration fails | Require note create/read/update and multi-client RTDB sync evidence. |

## Go / no-go gates

A migration may proceed toward production only when all are satisfied:

1. Cloud Run container builds and starts successfully.
2. Firebase Hosting rewrite reaches the Cloud Run service.
3. Company network can access the selected public entrypoint.
4. Firebase RTDB REST and realtime collaboration both work from the target network.
5. Auth/session and private note access flows remain intact.
6. Secrets are runtime-only and not included in client bundle, logs, repository, or generated artifacts.
7. Rate limiting has a shared-state design appropriate for Cloud Run scale-out or is explicitly waived for a preview-only stage.

## Next work order

Use `docs/reports/2026-05-12-migration-task-brief.md` as the task-specific harness for the next OMX/Codex execution pass.
