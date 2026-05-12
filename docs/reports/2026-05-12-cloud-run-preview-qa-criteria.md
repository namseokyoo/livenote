# LiveNote Cloud Run Preview QA Criteria

Date: 2026-05-12
Task ID: `livenote-firebase-cloud-run-migration`
Status: Required before declaring migration preview ready

## Purpose

Define the minimum evidence required before Core accepts a Cloud Run / Firebase Hosting preview as usable for LiveNote migration testing.

## Scope

In scope:
- Build and container/runtime startup checks.
- Firebase Hosting rewrite or Cloud Run direct preview smoke.
- Core LiveNote journeys: create, open, edit, persist, collaborate.
- Runtime secret handling checks.
- Basic observability/log sanity.

Out of scope:
- Full production cutover.
- DNS/custom-domain finalization.
- Long-run load testing.
- Billing/quota optimization beyond obvious blocker checks.

## Required gates

| Gate | Required evidence | Pass condition |
|---|---|---|
| Build | `npm run build` or container build output | Build exits 0. |
| Container start | Cloud Run local run or deployed preview log | Service starts and listens on expected `PORT`. |
| Health / landing | `curl` or browser smoke | HTTP 200/3xx; no crash page. |
| Firebase rewrite | `firebase.json` and preview/deploy evidence | Hosting routes dynamic app traffic to Cloud Run target or direct Cloud Run fallback is documented. |
| Create note | Browser or API evidence | New note can be created. |
| Open note | Browser evidence | Generated note opens by URL/code. |
| Edit + persist | Browser evidence | Edited content remains after refresh/reopen. |
| Realtime collaboration | Two-client/browser evidence | Update from one client appears in the other without manual refresh. |
| Auth/private flow | Browser evidence | Private note/access code flow still behaves as expected. |
| Error path | Browser/log evidence | Invalid note/code produces controlled error, not server crash. |
| Logs | Cloud Run/local logs | No secret leakage; no repeated startup/runtime errors. |

## Minimum command set

Use the closest available commands for the current environment.

```bash
npm run lint
npm run build
npm run test -- --runInBand  # if available; otherwise document not available
npm run test:e2e             # if configured; otherwise run manual browser smoke
```

Container / Cloud Run checks:

```bash
docker build -t livenote-cloud-run-preview .
docker run --rm -p 8080:8080 --env-file <safe-preview-env> livenote-cloud-run-preview
curl -I http://localhost:8080
```

Firebase config checks:

```bash
firebase hosting:channel:list
firebase deploy --only hosting --dry-run  # if supported in the current CLI/project context
```

If a command is unavailable, the report must say why and provide an equivalent artifact.

## Preview verdict

- `PASS`: all required gates pass with evidence.
- `CONDITIONAL`: app runtime works but company-network or RTDB realtime evidence is missing; preview can continue but not production cutover.
- `FAIL`: build/start/core note journey fails, or secrets appear in logs/client bundle.

## Required final report fields

```yaml
task_id: livenote-firebase-cloud-run-migration
harness_ref: docs/reports/2026-05-12-migration-task-brief.md
harness_verdict: <PASS|CONDITIONAL|FAIL>
artifact_refs:
  - command:<build command output handle>
  - command:<container/cloud-run start output handle>
  - screenshot:<browser smoke evidence>
  - log:<cloud run/local log evidence>
  - report:docs/reports/2026-05-12-company-network-connectivity-checklist.md
```
