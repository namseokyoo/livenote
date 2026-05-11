# LiveNote Migration Preflight Report

Date: 2026-05-12
Branch: `infra/firebase-cloud-run-migration`
Project path: `/Volumes/external/project/SidequestLab/projects/livenote/app`

## Tooling

```text
v22.17.1
10.9.2
14.11.1
Google Cloud SDK 557.0.0
Updates are available for some Google Cloud CLI components.  To install them,
please run:
  $ gcloud components update
Docker version 29.1.3, build f52814d
```

## Git remotes

```text
origin	https://github.com/namseokyoo/livenote.git (fetch)
origin	https://github.com/namseokyoo/livenote.git (push)
```

## Dirty working tree at start

These changes pre-existed this migration run and must not be lost. Migration work is continuing on the same working tree/branch because 형 asked to proceed, but final review must separate pre-existing QA/test artifacts from migration edits.

```text
M package-lock.json
 M package.json
?? .omx/
?? playwright.config.ts
?? test-results/
?? tests/e2e/qa-2026-04-18.spec.ts
?? tests/e2e/screenshots/p0-1-step1-main.png
?? tests/e2e/screenshots/p0-1-step2-form.png
?? tests/e2e/screenshots/p0-1-step3-filled.png
?? tests/e2e/screenshots/p0-1-step4-note-page.png
?? tests/e2e/screenshots/p0-1-step5-editor-visible.png
?? tests/e2e/screenshots/p0-3-step1-auth-modal.png
?? tests/e2e/screenshots/p0-3-step2-after-entry.png
?? tests/e2e/screenshots/p0-3-step3-editor-loaded.png
?? tests/e2e/screenshots/p0-3b-step1-before-refresh.png
?? tests/e2e/screenshots/p0-3b-step2-after-refresh.png
?? tests/e2e/screenshots/p0-3b-step3-reauth-done.png
?? tests/e2e/screenshots/p0-step1-main.png
?? tests/e2e/screenshots/p0-step2-form.png
?? tests/e2e/screenshots/p0-step3-filled.png
?? tests/e2e/screenshots/p0-step4-note-page.png
?? tests/e2e/screenshots/p0-step5-editor-visible.png
?? tests/e2e/screenshots/p0-step6-typed.png
?? tests/e2e/screenshots/p0-step7-autosave.png
?? tests/e2e/screenshots/p1-1-main-page.png
?? tests/e2e/smoke.spec.ts
```

## Environment inventory, keys only

No secret values were copied into this report.

| file | key |
|---|---|
| `.env.local` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `.env.local` | `NEXT_PUBLIC_FIREBASE_APP_ID` |
| `.env.local` | `FIREBASE_SERVICE_ACCOUNT_KEY` |
| `.env.local` | `PASSWORD_PEPPER` |
| `.env.local` | `NEXT_PUBLIC_SENTRY_DSN` |

## Runtime risks found

- Server-only Firebase Admin path exists: `src/lib/firebase-admin.ts` uses `FIREBASE_SERVICE_ACCOUNT_KEY`.
- Native password hashing exists: `bcrypt` in `src/lib/note-service-firebase.ts`.
- Existing verify/delete API routes use in-memory `Map` rate limit state, unsuitable for multi-instance Cloud Run.
- Existing `firebase.json` only declares RTDB rules; Hosting rewrite is not configured yet.
- `next.config.ts` does not yet set `output: 'standalone'`.

## Preflight verdict

CONDITIONAL PASS for local migration work. Production deploy/cutover still requires live Firebase/GCP project confirmation and preview QA.
