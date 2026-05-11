# Cloud Run Preview QA Report

Date: 2026-05-12
Branch: `infra/firebase-cloud-run-migration`
Status: PARTIAL — local migration implementation verified; cloud preview/production deploy blocked by missing Firebase/GCloud authentication and Docker daemon not running.

## Checks run

| Check | Result | Evidence |
|---|---:|---|
| Firebase/RTDB local connectivity spike | PASS | `docs/reports/2026-05-12-firebase-connectivity-spike.md` |
| Rate limiter unit tests | PASS | `npm test -- tests/rate-limit-service.test.ts` → 3 tests passed |
| Next production build | PASS | `npm run build` compiled successfully and produced standalone output |
| Local Next server smoke | PASS | `npm start` on `127.0.0.1:8080`; `/` returned 200, `/api/notes?limit=1` returned 200 JSON |
| Lint | PASS with warnings | `npm run lint` returned exit 0 with 3 pre-existing warnings in `tests/e2e/qa-2026-04-18.spec.ts` |
| Client static secret scan | PASS | no `PRIVATE KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `PASSWORD_PEPPER`, or `BEGIN PRIVATE KEY` found in `.next/static` |
| Docker build | BLOCKED | Docker CLI exists, but daemon unavailable: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock` |
| Firebase Hosting preview deploy | BLOCKED | Firebase CLI not authenticated: `Failed to authenticate, have you run firebase login?` |
| Cloud Run deploy | BLOCKED | no active gcloud account and no configured project |

## Implemented migration artifacts

- `Dockerfile` for Next standalone Cloud Run container
- `.dockerignore`
- `next.config.ts` now sets `output: 'standalone'`
- `firebase.json` now includes Firebase Hosting rewrite to Cloud Run service `livenote-web` in `asia-northeast3`
- `.firebaserc` points default project alias at `livenote-caf0d`
- `.env.example` documents public and server-only env names without secret values
- `docs/runbooks/cloud-run-local-run.md`
- `docs/runbooks/firebase-hosting-cloud-run-deploy.md`
- `src/lib/rate-limit-service.ts` with RTDB transaction-backed failure increments
- `tests/rate-limit-service.test.ts`
- API verify/delete routes now use RTDB-backed, per-note rate limit store instead of process-local `Map`

## Known limitations before production cutover

1. Docker Desktop/daemon must be started before validating the actual container image.
2. Firebase CLI login and GCloud auth are required before preview deploy.
3. Company-network Firebase/RTDB connectivity remains unverified because this machine is not on the company network.
4. The existing working tree had pre-existing QA/test artifacts before migration. Final commit should stage only intended files or intentionally include those QA artifacts in a separate commit.
5. `npm install --save-dev vitest` surfaced 22 npm audit findings already in the dependency graph; no forced audit fix was run because it could introduce breaking changes.

## Cutover gate verdict

- Local implementation gate: PASS
- Cloud preview gate: BLOCKED
- Production cutover gate: BLOCKED

Do not cut over production until Docker build, Cloud Run preview, Firebase Hosting preview, and company-network realtime QA pass.
