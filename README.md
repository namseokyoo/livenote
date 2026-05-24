# LiveNote

LiveNote is a Next.js app for creating one shared meeting note, inviting participants with a note code and password, and capturing the meeting record while the conversation is still live.

The current product supports realtime shared note capture, host and guest entry flows, role-aware editing controls, presence, and Firebase-backed note persistence. It can be used to structure human-captured summaries, decisions, and action items, but this branch does not ship audited automatic AI summarization or automatic action-item generation.

## Current Architecture

- App runtime: Next.js 16 with React 19 and TypeScript.
- Collaboration and persistence: Firebase Realtime Database.
- Client Firebase access: public `NEXT_PUBLIC_FIREBASE_*` values from local or runtime environment.
- Server Firebase access: Firebase Admin SDK with `FIREBASE_SERVICE_ACCOUNT_KEY` and `PASSWORD_PEPPER` kept server-only.
- Migration target: Firebase Hosting rewrite to a Cloud Run service named `livenote-web` in `asia-northeast3`.
- Previous Supabase files remain in the repository for migration history, but active note storage is Firebase-backed.

Cloud Run and Firebase Hosting production readiness is not claimed here. The migration branch has local implementation evidence, while cloud preview, company-network access, RTDB realtime checks from the target network, and production cutover remain separate gates.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for local development.

Required local environment values are documented in `.env.example`. Keep service account JSON, password peppers, tokens, and production data out of commits and generated artifacts. Do not expose server-only values with a `NEXT_PUBLIC_` prefix.

## Verification Commands

```bash
npm run lint
npm run test
npm run test:unit
npm run build
npm run test:e2e -- --list
```

`npm run test` and `npm run test:unit` run Vitest unit tests only through `vitest.config.ts`. Playwright specs under `tests/e2e/**` are intentionally excluded from Vitest.

`npm run test:e2e` is reserved for Playwright browser tests. Use `npm run test:e2e -- --list` during local PR prep to verify discovery without running browser flows. Full E2E execution defaults to `http://127.0.0.1:3000`; set `LIVENOTE_E2E_BASE_URL` explicitly when targeting another environment.

## Deployment Boundary

This repository is the LiveNote product repository:

```text
/Volumes/external/project/SidequestLab/projects/livenote/app
https://github.com/namseokyoo/livenote.git
branch: infra/firebase-cloud-run-migration
```

LiveNote deployment work belongs to this product repo, not to the SidequestLab homepage or Lab governance surface. This cleanup pass does not deploy, push, merge, tag, open a PR, dispatch workflows, publish a release, or change external services.

## Release Readiness Notes

- Local unit tests, lint, production build, and Playwright test discovery are the release-prep checks for this branch.
- Docker, Firebase CLI, GCloud auth, Firebase Hosting preview, Cloud Run preview, company-network access, and production cutover are later approval gates.
- Generated outputs such as `.firebase/`, `.omx/`, `.hermes/`, `test-results/`, and E2E screenshots are local residue unless specifically reviewed for inclusion.
- Product claims should stay limited to verified realtime shared note capture, host/guest flows, human-authored meeting structure, and Firebase/Cloud Run migration preparation.
