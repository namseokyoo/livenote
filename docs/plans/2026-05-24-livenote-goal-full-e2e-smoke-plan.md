# LiveNote Goal Plan — Deployed E2E Smoke with Host/Guest Collaboration

Core remains commander/verifier. Codex `/goal` is executor only for bounded deployed-site E2E smoke hardening, host/guest collaboration coverage, evidence generation, and no external publication beyond browser/API traffic to the already-deployed LiveNote site.

## Task ID

`livenote-deployed-e2e-smoke-2026-05-24`

## Goal

Run and harden a **full deployed-site Playwright E2E smoke** for LiveNote before pushing any further changes. The test target is the deployed Firebase Hosting site, not a local dev server.

Primary target:

```text
https://livenote-caf0d.web.app
```

Alternate reachability target:

```text
https://livenote-caf0d.firebaseapp.com
```

The test must cover the app's core concept: a host and a guest entering the same note at the same time, with separate roles/passwords, and validating realtime collaboration/permission behavior.

This goal should produce a truthful PASS/PARTIAL/FAIL verdict with screenshots, console/network evidence, cleanup notes, and exact commands. It should not deploy, push, open PRs, or claim production readiness.

## Architecture / Approach

- Use the current LiveNote product repo and branch for test code/harness only.
- Use the deployed Firebase Hosting entrypoint for browser E2E:
  - `LIVENOTE_E2E_BASE_URL=https://livenote-caf0d.web.app`
- Use the alternate Firebase Hosting URL only for reachability comparison or fallback, not as a second write target unless the primary is blocked.
- Do not start `npm run dev` or `npm run start` for the browser E2E. Local commands are allowed only for static regression gates such as lint/unit/build/e2e-list.
- Keep tests deterministic and bounded:
  - unique note titles prefixed with `E2E_DEPLOYED_SMOKE_YYYYMMDD_HHMMSS`.
  - strict timeouts.
  - screenshots/videos/traces saved under local generated paths.
  - no infinite waits.
- Treat existing `tests/e2e/qa-2026-04-18.spec.ts` S2 as useful prior coverage, but improve/add a dedicated host/guest test because current S2 uses the host password for both contexts. The required concept test must use:
  - host context authenticated with `hostPassword`.
  - guest context authenticated with `guestPassword`.
  - separate browser contexts/pages.
  - simultaneous presence on the same deployed note.
- Validate both app behavior and test harness behavior. A green test that accidentally runs both contexts as host is not acceptable.

## Tech Stack

- Next.js 16 / React 19 / TypeScript
- Firebase Hosting deployed entrypoint with Cloud Run-backed app behavior
- Firebase RTDB used by deployed site
- Playwright 1.59.1
- Vitest 4.1.6 for unit regression guard

## Boundary Preflight

- Lab repo root: `/Volumes/external/project/SidequestLab`
- Project container: `/Volumes/external/project/SidequestLab/projects/livenote`
- Product repo root: `/Volumes/external/project/SidequestLab/projects/livenote/app`
- Product GitHub remote: `https://github.com/namseokyoo/livenote.git`
- Product branch at plan time: `infra/firebase-cloud-run-migration`
- Current local commit at plan time: `52b077b test: split unit and e2e verification`
- Remote state at plan time: local branch is `ahead 1`; do not push in this goal.
- Deployed test boundary: Firebase Hosting deployed site `https://livenote-caf0d.web.app`; alternate `https://livenote-caf0d.firebaseapp.com` for reachability comparison.
- Deploy boundary: no new deploy in this goal; no Cloud Run/Firebase/Vercel deployment actions.
- Ignored/local context boundary: `.env.local`, service account material, `.firebase/`, `.hermes/`, `.next/`, `test-results/`, `playwright-report/`, screenshots/videos/traces are local artifacts unless explicitly approved.
- Existing plan: `docs/plans/2026-05-24-livenote-goal-release-readiness-plan.md`
- Existing Core review: `.hermes/harness/livenote-release-readiness-2026-05-24/core-final-review.md`

## Current Evidence at Plan Time

Recorded by Core at plan creation/update:

```text
branch: infra/firebase-cloud-run-migration
head: 52b077b
status: ahead 1 plus this new plan if uncommitted
unit/lint/build/e2e-list: previously PASS by Core after commit
E2E discovery: 15 Playwright tests in 2 files
known gap: full browser E2E has not run yet against the deployed Firebase Hosting site
known concept gap: current S2 collaboration test uses host password for both contexts; host+guest simultaneous role coverage must be made explicit
primary deployed URL: https://livenote-caf0d.web.app => HTTP 200 observed by Core curl preflight
alternate deployed URL: https://livenote-caf0d.firebaseapp.com => HTTP 200 observed by Core curl preflight
```

Relevant existing code evidence:

- `.firebaserc` default project: `livenote-caf0d`.
- `firebase.json` Hosting rewrites `**` to Cloud Run service `livenote-web` in `asia-northeast3`.
- Firebase verification distinguishes host and guest passwords in `src/lib/note-service-firebase.ts`.
- Verification flow assigns `role: 'host'` for host password and `role: 'guest'` for guest password.
- Host gets `canEdit: true`; guest gets `canEdit: false` / permission status `none` by default.
- Request/response edit permission APIs exist under `/api/notes/[code]/request-edit` and `/api/notes/[code]/respond-edit`.
- Delete endpoint exists: `DELETE /api/notes/[code]` with note password; use it only for notes created by this E2E if cleanup is safe.

## Non-Goals / Hard Stops

Do not:

- Deploy to Firebase, Cloud Run, Vercel, or any external service.
- Push, merge, tag, open PR, publish release, or dispatch workflows.
- Touch or print secrets, service account JSON, password peppers, tokens, production data, or private meeting content.
- Run against any target other than `https://livenote-caf0d.web.app` unless the alternate Firebase Hosting URL is explicitly used as a documented fallback/reachability check.
- Start a local dev/start server for the browser E2E.
- Delete existing screenshots/test-results/runtime residue silently.
- Overclaim production readiness, company-network readiness, or audited automatic AI summarization.

Stop and report if:

- The repo/branch/remote differs from the boundary.
- The deployed URL is unreachable, points to the wrong app, or returns an auth/admin wall.
- The deployed target appears to contain private/real user data rather than safe test data.
- The host/guest role distinction cannot be measured from UI/API behavior.
- Browser E2E attempts to use real user data or external admin credentials.

## Completion Criteria

The goal is complete only when all are true:

1. Boundary and deployed target readiness are recorded without exposing secret values.
2. Primary deployed URL returns reachable app evidence before browser tests start.
3. Existing local regression gates still pass: `npm run lint`, `npm run test`, `npm run test:unit`, `npm run build`, `npm run test:e2e -- --list`.
4. Full Playwright smoke runs against `https://livenote-caf0d.web.app`.
5. A dedicated host+guest simultaneous scenario is present and executed against the deployed site.
6. The scenario proves that host and guest are separate roles/passwords, not two host sessions.
7. Realtime collaboration or permission flow is measured with concrete assertions, not only screenshots/logs.
8. Screenshots/traces/results are saved and referenced.
9. Test-created note data is cleaned up when safe, or residual test data is documented with note code/title prefix and cleanup blocker.
10. `git diff --check` passes.
11. Harness evidence exists and validates as JSON.
12. No deploy/push/PR/tag/release/workflow dispatch occurred.
13. No accidental local server process remains.

## Measurable Goal Gates

| Gate ID | Gate | Required command / check | PASS threshold | FAIL / BLOCK condition |
|---|---|---|---|---|
| G0 | Boundary safety | `git rev-parse --show-toplevel`; `git branch --show-current`; `git remote -v`; `git status --short --branch`; `git rev-parse --short HEAD` | Correct repo/branch/remote; local head `52b077b` or later intentional local commit; no unexpected tracked edits | Wrong repo/branch/remote or unexplained dirty state |
| G1 | Deployed target safety | `curl -I -L --max-time 20 https://livenote-caf0d.web.app`; compare alternate `https://livenote-caf0d.firebaseapp.com`; Playwright app-shell preflight | Primary URL returns HTTP 200/3xx, expected app shell, no auth/admin wall, no private data exposure | Target unreachable, wrong app, production/private data risk, or secret values exposed |
| G2 | No local browser server | Process check before and after E2E: `ps ... | grep -E 'next dev|next start'` | No accidental local app server used for browser E2E | Browser E2E is run against localhost/local server |
| G3 | Regression local gates | `npm run lint`; `npm run test`; `npm run test:unit`; `/opt/homebrew/bin/timeout 240s npm run build`; `npm run test:e2e -- --list` | All pass; E2E list still shows expected tests | Any regression failure |
| G4 | Host+guest test design | Inspect test file(s), preferably `tests/e2e/host-guest-collab.spec.ts` or updated smoke file | Test uses `browser.newContext()` for host and guest; host authenticates with host password; guest authenticates with guest password; assertions prove role distinction | Both contexts use the same password/role or role distinction is only implied |
| G5 | Host+guest simultaneous deployed entry | `LIVENOTE_E2E_BASE_URL=https://livenote-caf0d.web.app npm run test:e2e -- tests/e2e/host-guest-collab.spec.ts --workers=1 --trace=retain-on-failure` | Host and guest pages both enter the same deployed note; screenshots captured; no critical console/page errors | One side cannot enter, auth fails incorrectly, or critical JS/page errors occur |
| G6 | Realtime collaboration assertion | In the targeted test, host types a unique token and guest sees it within bounded wait OR guest permission request + host approval lets guest edit and host sees guest token | Concrete assertion passes with unique token visible on the opposite context | Only screenshots/logs; no DOM/API assertion; propagation never happens |
| G7 | Permission/role assertion | Check guest cannot edit before approval if that is current product behavior, and/or request-edit/approve path updates guest can-edit state | Assertion matches current intended role behavior and is recorded | Guest has unintended host privileges, or current intended behavior cannot be determined |
| G8 | Full deployed E2E smoke run | `LIVENOTE_E2E_BASE_URL=https://livenote-caf0d.web.app npm run test:e2e -- --workers=1` | Full suite exits 0, or known non-product blocker is isolated and targeted host+guest test passes | Full suite fails with product regression, flaky uncontrolled failures, or missing evidence |
| G9 | Artifact capture | `test-results/`, `playwright-report/`, screenshots/traces, `.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/screenshots.md` | Artifacts exist and are referenced without leaking secrets | Missing artifacts or private data exposure risk |
| G10 | Cleanup / data residue | Delete only test-created notes via safe API if possible; record note codes/titles and cleanup status | Created test notes cleaned up or residual test data documented with reason | Unknown test data left behind silently |
| G11 | Evidence validity | `python3 -m json.tool .hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/evidence.json` | Valid JSON with G0-G13, command exit codes, artifact refs, residual risks | Invalid/missing evidence |
| G12 | Diff hygiene | `git diff --check`; `git diff --cached --check` if anything staged | Exit 0 | Whitespace/conflict-marker errors |
| G13 | External side-effect guard | Inspect final report/history/logs/processes | No deploy/push/merge/tag/PR/release/workflow dispatch; no accidental local server | Unauthorized external side effect or leaked process |

### Verdict Rules

- `PASS`: G0-G13 pass; host+guest role/collaboration scenario passes on the deployed site; evidence is complete; no accidental local server remains.
- `PARTIAL`: regression gates pass and host+guest targeted test passes, but full suite has a documented non-product blocker or safe cleanup is blocked.
- `FAIL`: any boundary/target safety, host+guest role/collab assertion, regression gate, evidence, diff hygiene, or external-side-effect guard fails.

## Required Harness Files

Codex must create/update:

```text
.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/spec.md
.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/checklist.md
.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/screenshots.md
.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/evidence.json
.hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/final-report.md
```

`evidence.json` must include:

- `task_id`
- `boundary`
- `target_url` with primary/alternate deployed URLs, readiness status, and HTTP summaries
- `artifacts`
- `gates` G0-G13 with status, command, exit code, expected result, actual result
- `host_guest_scenario` with host password role, guest password role, note code/title prefix, assertion summaries, screenshots/traces
- `cleanup` status for created test notes
- `external_side_effects`
- `residual_risks`
- `next_decision_needed`

## Bite-sized Task Sequence

1. **G0 Boundary preflight**
   - Expected: repo root, branch, remote, and head match this plan.
   - Check: git commands in G0.
   - Stop if boundary is wrong.

2. **G1 Deployed target readiness**
   - Expected: `https://livenote-caf0d.web.app` returns HTTP 200/3xx and app shell is reachable.
   - Check: bounded `curl -I -L --max-time 20` and Playwright page-load preflight.
   - Stop if the deployed target is unreachable or points to the wrong app.

3. **Harness skeleton**
   - Expected: required harness files exist before browser runs.
   - Check: file existence and checklist with G0-G13.
   - Stop if evidence slots are not prepared.

4. **Add/fix host+guest scenario**
   - Expected: a dedicated test such as `tests/e2e/host-guest-collab.spec.ts` exists.
   - Required behavior:
     - create note with distinct host/guest passwords against the deployed site.
     - host context enters with host password.
     - guest context enters with guest password.
     - both remain open simultaneously.
     - assert role/permission distinction from UI or API-observable behavior.
     - assert realtime propagation or permission request/approval flow.
   - Stop if current UI/API cannot expose enough role/collab state; report what needs instrumentation.

5. **G2 No local server check**
   - Expected: no `next dev` / `next start` is used for browser E2E.
   - Check: process list before/after.
   - Stop if E2E target is localhost instead of deployed URL.

6. **G3 Regression gates**
   - Expected: lint/unit/build/e2e-list still pass locally.
   - Check: commands in G3.
   - Stop on regression.

7. **G5-G7 Targeted deployed host+guest test**
   - Expected: targeted test passes with screenshots/traces.
   - Check: targeted Playwright command with `--workers=1` and deployed base URL.
   - Stop on role/collab assertion failure and preserve trace.

8. **G8 Full deployed E2E run**
   - Expected: full suite passes against deployed site.
   - Check: `LIVENOTE_E2E_BASE_URL=https://livenote-caf0d.web.app npm run test:e2e -- --workers=1`.
   - If full suite fails but targeted host+guest passes, classify whether failure is product regression, test fragility, deployed data/state dependency, or environment/network dependency.

9. **G9-G10 Artifacts and cleanup**
   - Expected: artifacts referenced; test notes cleaned or residuals documented.
   - Check: screenshots/traces/results paths; safe DELETE API for test-created notes if possible.
   - Stop if cleanup would require unsafe credentials/admin access.

10. **G11-G13 Final gates**
    - Expected: evidence JSON valid, diff clean, no local server, no external side effects beyond deployed-site test traffic.
    - Check: `python3 -m json.tool`, `git diff --check`, process list.

11. **Final report**
    - Expected: PASS/PARTIAL/FAIL with exact test results, artifact refs, screenshots/traces, and next decision.
    - Stop before push/PR/deploy.

## Core Verification After Goal Completion

Core should independently run:

```bash
git status --short --branch
curl -I -L --max-time 20 https://livenote-caf0d.web.app
curl -I -L --max-time 20 https://livenote-caf0d.firebaseapp.com
npm run lint
npm run test
npm run test:unit
/opt/homebrew/bin/timeout 240s npm run build
npm run test:e2e -- --list
LIVENOTE_E2E_BASE_URL=https://livenote-caf0d.web.app npm run test:e2e -- tests/e2e/host-guest-collab.spec.ts --workers=1 --trace=retain-on-failure
LIVENOTE_E2E_BASE_URL=https://livenote-caf0d.web.app npm run test:e2e -- --workers=1
python3 -m json.tool .hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/evidence.json
git diff --check
ps -axo pid,ppid,stat,etime,command | grep -F 'livenote/app' | grep -E 'next dev|next start|codex' | grep -v grep || true
```

Core should inspect:

```bash
git diff -- tests/e2e package.json playwright.config.ts docs/plans .hermes/harness/livenote-deployed-e2e-smoke-2026-05-24
```

Core acceptance checks:

- E2E base URL is `https://livenote-caf0d.web.app`, not localhost.
- Host+guest scenario does not use host password for both contexts.
- Realtime/permission behavior is asserted with DOM/API outcomes, not only screenshots.
- All artifacts are local and safe.
- No accidental local server process remains.
- No push/PR/deploy occurred.

## Copy-pasteable `/goal` Prompt

```text
/goal LiveNote deployed E2E smoke with host/guest collaboration

Boundary:
- Product repo root: /Volumes/external/project/SidequestLab/projects/livenote/app
- Product remote: https://github.com/namseokyoo/livenote.git
- Branch: infra/firebase-cloud-run-migration
- Current local commit: 52b077b test: split unit and e2e verification
- Primary deployed target: https://livenote-caf0d.web.app
- Alternate deployed target: https://livenote-caf0d.firebaseapp.com
- Deploy boundary: browser/API traffic to the already-deployed Firebase Hosting site only; no new deploy/push/merge/tag/PR/publication

Use plan:
/Volumes/external/project/SidequestLab/projects/livenote/app/docs/plans/2026-05-24-livenote-goal-full-e2e-smoke-plan.md

Mode: builder, bounded to deployed-site Playwright E2E hardening, host/guest scenario coverage, and harness evidence only.

Goal:
Before push/PR, run and harden a full deployed-site Playwright E2E smoke for LiveNote against https://livenote-caf0d.web.app. Add or fix a dedicated host+guest simultaneous collaboration test where host logs in with hostPassword, guest logs in with guestPassword, both are open at the same time on the deployed site, and realtime collaboration or permission request/approval behavior is asserted with concrete checks. Produce evidence and stop before push/PR/deploy.

Hard stops:
- No deploy, push, merge, tag, PR, workflow dispatch, release, or external publication.
- No credentials/secrets/service accounts/tokens/production data printed or modified.
- Do not run browser E2E against localhost/local server; use https://livenote-caf0d.web.app.
- Do not delete existing generated artifacts silently; classify or document.
- Stop if the deployed target is unreachable, appears wrong/private, or host/guest role distinction cannot be measured safely.

Measurable gates:
- G0 boundary safety.
- G1 deployed target readiness and safety.
- G2 no accidental local browser server.
- G3 lint/unit/build/e2e-list regression gates.
- G4 host+guest test design proves separate roles/passwords.
- G5 targeted host+guest simultaneous deployed entry passes.
- G6 realtime collaboration or permission flow assertion passes.
- G7 permission/role assertion passes.
- G8 full deployed E2E smoke run completes or a truthful PARTIAL blocker is documented.
- G9 screenshots/traces/results captured and referenced.
- G10 test data cleanup or residual documentation.
- G11 evidence JSON valid.
- G12 git diff hygiene passes.
- G13 no external side effects and no accidental local server process.

Done when:
- Required local gates and targeted deployed host+guest test pass, or a precise PARTIAL/FAIL blocker is documented with artifacts.
- .hermes/harness/livenote-deployed-e2e-smoke-2026-05-24/{spec.md,checklist.md,screenshots.md,evidence.json,final-report.md} exists with real evidence.
- Final report contains exact commands, exit codes, deployed target URL, screenshots/traces, host/guest assertion summary, residual risks, cleanup status, and next decision.
- No push/PR/deploy occurred.

Return only a short summary plus artifact paths and exact verification results. Core will independently verify before accepting PASS.
```

## Active Supervision Plan for Core

Because this goal uses a deployed site and browser automation, Core must actively supervise instead of just leaving a background process:

- Poll Codex/process logs every 2-5 minutes while active.
- Check child processes if output is spinner-only for more than 5 minutes.
- Kill only the specific hung child process if a bounded command exceeds its timeout; preserve Codex session for steering when possible.
- Verify no accidental local app server was started with `ps` after completion.
- Independently rerun the targeted host+guest test against `https://livenote-caf0d.web.app` before accepting PASS.

## Next After This Goal

If PASS:

1. Commit the E2E hardening changes locally.
2. Push `infra/firebase-cloud-run-migration` only after 형 approval.
3. Open PR with deployed-site test evidence and explicitly state that production/Cloud Run/company-network gates are separate.

If PARTIAL/FAIL:

1. Do not push.
2. Fix the exact blocker or split a smaller follow-up plan.
3. Preserve screenshots/traces for review.
