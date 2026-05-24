# LiveNote Goal Plan — Release Readiness / PR Prep

Core remains commander/verifier. Codex `/goal` is executor only for bounded local repository cleanup, docs, test configuration, and evidence generation.

## Task ID

`livenote-release-readiness-2026-05-24`

## Goal

Bring the LiveNote `infra/firebase-cloud-run-migration` branch to a **local release-candidate / PR-ready** state by fixing the current unit/E2E test command split, replacing the default README with accurate LiveNote product/deployment docs, classifying untracked residue, and producing task-specific harness evidence.

This is **not** a deploy/cutover sprint. Cloud Run/Firebase preview, company-network smoke, production cutover, and public marketing publication remain separate gates.

## Architecture / Approach

- Preserve the current product architecture: Next.js app + Firebase RTDB collaboration/persistence + Firebase Hosting rewrite to Cloud Run migration path.
- Keep LiveNote product work inside the product repo `/Volumes/external/project/SidequestLab/projects/livenote/app`; do not treat it as SidequestLab homepage/company deployment work.
- Split verification surfaces:
  - `npm run test` = Vitest unit tests only.
  - `npm run test:e2e` = Playwright E2E tests only.
  - `npm run build` = Next production build.
- Rewrite README around current, verified capabilities only.
- Use claim-safety: LiveNote can support realtime shared note capture, host/guest flows, and structured summary/decisions/action-items **as human-captured meeting notes**. Do not claim automatic AI summarization/action item generation as shipped.
- Do not delete existing screenshots/test-results/runtime residue; classify first.

## Tech Stack

- Next.js 16.1.6 / React 19.2.3 / TypeScript
- Firebase RTDB + Firebase Admin SDK
- Firebase Hosting rewrite to Cloud Run migration target
- Vitest 4.1.6 for unit tests
- Playwright 1.59.1 for E2E
- Docker/Cloud Run/Firebase CLI for later deploy-preview gates only

## Boundary Preflight

- Lab repo root: `/Volumes/external/project/SidequestLab`
- Project container: `/Volumes/external/project/SidequestLab/projects/livenote`
- Product repo root: `/Volumes/external/project/SidequestLab/projects/livenote/app`
- Product GitHub remote: `https://github.com/namseokyoo/livenote.git`
- Product branch at plan time: `infra/firebase-cloud-run-migration`
- Deploy boundary: LiveNote product repo only; **no deploy/push/merge/tag/PR in this goal**
- Ignored/local context boundary: `.env.local`, Firebase service account material, `.firebase/`, `.omx/`, `.next/`, `test-results/`, generated screenshots, runtime logs, and local harness residue must not be accidentally committed.
- Existing boundary note: `docs/repo-boundary.md`
- Existing migration decision: `docs/reports/2026-05-12-migration-decision.md`
- Existing Cloud Run QA state: `docs/reports/2026-05-12-cloud-run-preview-qa.md`
- Existing settlement/marketing draft: `docs/marketing/livenote-settlement.md`

## Current Evidence at Plan Time

Recorded by Core at `2026-05-24 11:16:18 KST`.

### Calendar freeze correction

The mistaken Desktop Calendar `/goal` work was frozen before this LiveNote plan rewrite.

- Calendar repo: `/Users/namseokyoo/projects/desktop-calendar-overlay`
- Freeze action: `git stash push -u -m "freeze mistaken calendar goal work before LiveNote sprint 2026-05-24 11:14:08 KST"`
- Calendar post-freeze status: clean against `origin/release/v0.95.0-official-oauth-client`
- No calendar push/tag/release/PR/workflow/OAuth changes were performed.

### LiveNote repo state

```text
repo root: /Volumes/external/project/SidequestLab/projects/livenote/app
branch: infra/firebase-cloud-run-migration
remote: https://github.com/namseokyoo/livenote.git
status: untracked residue exists; no tracked modifications at preflight
```

Current recent commits:

```text
2922342 Define Firebase Cloud Run migration gates
24509ed fix: include public Firebase env at image build
8c1a89f fix: defer RTDB rate limit admin initialization
99d224f infra: prepare firebase cloud run migration
be44451 docs: Firebase 전환 관련 문서 추가 — DEC-230
```

Current untracked groups observed:

```text
.firebase/
.hermes/
.omx/
docs/marketing/
docs/plans/
playwright.config.ts
test-results/
tests/e2e/*.spec.ts
tests/e2e/screenshots/*.png
```

Current command results:

```text
node --version => v22.17.1
npm --version => 10.9.2
npm run lint => PASS, 3 warnings in tests/e2e/qa-2026-04-18.spec.ts
npm run test => FAIL: Vitest imports Playwright specs under tests/e2e/*.spec.ts
tests/rate-limit-service.test.ts => 3 tests passed inside failing Vitest run
npm run build => PASS, Next production build and route summary produced
npm run test:e2e -- --list => FAIL: missing script test:e2e
```

Current README state:

- `README.md` is still the default create-next-app README.
- It does not document LiveNote, Firebase/Cloud Run migration, verification commands, or claim boundaries.

Current docs evidence:

- `docs/reports/2026-05-12-migration-decision.md`: adopted Firebase Hosting → Cloud Run + Firebase RTDB direction.
- `docs/reports/2026-05-12-cloud-run-preview-qa.md`: local implementation PASS, cloud preview/production cutover BLOCKED by Docker/Firebase/GCloud auth and company-network checks.
- `.hermes/harness/settle-livenote-2026-05-21/final-report.md`: settlement preflight drafted; README was intentionally left unmodified; safe claims avoid automatic AI summarization.

## Non-Goals / Hard Stops

Do not:

- Deploy to Firebase, Cloud Run, Vercel, or any external service.
- Push, merge, tag, open PR, publish release, or post marketing copy externally.
- Touch or request real Firebase/GCloud/GitHub credentials, secrets, service account JSON, Secret Manager payloads, password peppers, tokens, or production data.
- Delete or overwrite `.firebase/`, `.omx/`, `test-results/`, screenshots, `.hermes/`, or any untracked residue silently.
- Claim Cloud Run/Firebase production readiness, company-network accessibility, or public release readiness.
- Claim automatic AI summarization/action-item generation as shipped unless code/tests prove it.
- Change product behavior beyond what is required for test/config/docs consistency.
- Route LiveNote product work into the SidequestLab homepage/company repo surface.

Stop and report if:

- Real deploy credentials or external admin access are required.
- A generated screenshot/log/artifact appears to contain private calendar/meeting/user data.
- The repo/branch/remote boundary differs from this plan.
- Existing untracked groups cannot be safely classified.
- Fixing a local gate requires broad product refactor or dependency upgrade.

## Completion Criteria

The goal is complete only when all are true:

1. The currently broken test setup is fixed: Vitest no longer imports Playwright files under `tests/e2e/**`.
2. `npm run test` runs Vitest unit tests only and passes; it must include `tests/rate-limit-service.test.ts` and exclude all `*.spec.ts` Playwright tests.
3. `npm run test:unit` exists and is equivalent to the unit-only Vitest command.
4. `npm run test:e2e -- --list` exists and lists Playwright E2E tests without running full browser flows.
5. `playwright.config.ts` exists or is updated only as needed for E2E discovery; it must not force deploy credentials or external production URLs for the list gate.
6. `npm run lint` exits 0; the existing 3 warnings are either fixed or explicitly recorded with no unexplained increase.
7. `npm run build` exits 0 and produces the Next route summary.
8. `README.md` is LiveNote-specific and no longer contains create-next-app template text.
9. README documents current product, Firebase/Cloud Run migration boundary, local commands, verification commands, and secret/deploy safety.
10. Unsupported claims are absent: no automatic AI summarization/action-item generation claim; no Cloud Run/Firebase production readiness claim.
11. All major untracked groups are classified as `keep candidate`, `ignore/generated`, or `review-before-commit`.
12. `.gitignore` is updated only if needed to protect generated artifacts, without ignoring source/config/docs that should be versioned.
13. Task harness exists under `.hermes/harness/livenote-release-readiness-2026-05-24/` with real evidence and per-gate measurements.
14. `git diff --check` passes.
15. No external side effects occurred.

## Measurable Goal Gates

| Gate ID | Gate | Required command / check | PASS threshold | FAIL / BLOCK condition |
|---|---|---|---|---|
| G0 | Boundary safety | `git rev-parse --show-toplevel`; `git branch --show-current`; `git remote -v`; `git status --short --branch` | Correct product repo, branch, remote; no pre-existing tracked modifications; untracked groups recorded | Wrong repo/branch/remote, unclassified tracked changes, or SidequestLab boundary confusion |
| G1 | Current test bug diagnosis | Inspect `package.json`; inspect/create `vitest.config.ts`; confirm observed failure text in harness | Root cause recorded: `npm run test` used `vitest run` over `tests/e2e/**/*.spec.ts`, causing Playwright `test.describe()` import failure | Root cause not identified or fix attempts proceed without documenting current wrong test scope |
| G2 | Unit test split fix | `npm run test`; `npm run test:unit`; optionally `npx vitest list --config vitest.config.ts` if available | Exit 0; Vitest runs unit tests only; `tests/rate-limit-service.test.ts` is included; `tests/e2e/**` and `*.spec.ts` are excluded | Playwright `test.describe()` Vitest error, no unit tests discovered, or nonzero exit |
| G3 | E2E script separation | `npm run test:e2e -- --list` | Exit 0; Playwright lists tests from `tests/e2e`; full browser run not required | Missing script, wrong runner, no tests listed, or list command tries to deploy/use production secrets |
| G4 | Test config hygiene | Review `package.json`, `vitest.config.ts`, `playwright.config.ts` | Scripts are explicit: `test`/`test:unit` = unit-only Vitest, `test:watch` = unit watch, `test:e2e` = Playwright; config names and globs are readable | Ambiguous scripts, Vitest still has broad default discovery, Playwright config overwrites unit config, or source tests ignored accidentally |
| G5 | Lint | `npm run lint` | Exit 0; warning count recorded; no ESLint errors; previous 3 warnings in E2E are fixed or justified | Any ESLint error or unexplained new warning increase |
| G6 | Production build | `npm run build` | Exit 0; Next build completes and route summary appears | Nonzero exit or build/runtime/TypeScript failure |
| G7 | README replacement | `grep -q "# LiveNote" README.md`; `grep -q "Firebase" README.md`; `grep -q "Cloud Run" README.md`; `! grep -q "create-next-app" README.md` | README is product-specific and includes architecture, commands, test split, claim boundaries, and deploy notes | Default template remains, test/deployment model missing, or unsupported claim introduced |
| G8 | Claim safety | Manual/grep review of `README.md`, `docs/marketing/livenote-settlement.md`, harness final report | No public-readiness, production-readiness, or shipped-AI claim beyond evidence | Unsupported AI/production/public release claim |
| G9 | Residue classification | `.hermes/harness/livenote-release-readiness-2026-05-24/untracked-classification.md`; `git status --short --branch` | Every major untracked group classified; generated/private artifacts not deleted or staged silently | Untracked groups unexplained or private/generated artifacts staged |
| G10 | Ignore safety | `git check-ignore -v .firebase test-results .next .omx || true`; `git check-ignore -v playwright.config.ts tests/e2e/smoke.spec.ts docs/marketing/livenote-settlement.md || true` | Generated dirs ignored or explicitly classified; source/config/docs not accidentally ignored | Reusable config/tests/docs ignored accidentally; generated dirs remain high accidental-stage risk without explanation |
| G11 | Harness evidence validity | `python3 -m json.tool .hermes/harness/livenote-release-readiness-2026-05-24/evidence.json` | Valid JSON with G0-G13 gate results, commands, exit codes, artifact refs, residual risks, and expected-vs-actual outcomes | Invalid JSON or missing gate result |
| G12 | Diff hygiene | `git diff --check` | Exit 0 | Whitespace/conflict-marker errors |
| G13 | External side-effect guard | Inspect final report/history/logs | No deploy/push/merge/tag/PR/publish/workflow dispatch/external admin action | Unauthorized external side effect |

### Verdict Rules

- `PASS`: G0-G13 pass and final report contains artifact refs, verification results, residual risks, and next decision.
- `PARTIAL`: useful local fixes land and major local gates pass, but a non-risk blocker remains documented, such as Playwright browser install/network dependency for full E2E execution.
- `FAIL`: any boundary, unit test, build, README claim-safety, diff-hygiene, or external side-effect gate fails.

## Required Harness Files

Codex must create/update:

```text
.hermes/harness/livenote-release-readiness-2026-05-24/spec.md
.hermes/harness/livenote-release-readiness-2026-05-24/checklist.md
.hermes/harness/livenote-release-readiness-2026-05-24/untracked-classification.md
.hermes/harness/livenote-release-readiness-2026-05-24/evidence.json
.hermes/harness/livenote-release-readiness-2026-05-24/final-report.md
```

`evidence.json` must include:

- `task_id`
- `boundary`
- `artifacts`
- `gates` G0-G13 with status and command summaries
- `external_side_effects`
- `residual_risks`
- `next_decision_needed`

## Bite-sized Task Sequence

1. **G0 Boundary preflight** — re-run repo/branch/remote/status checks before editing.
   - Expected result: product root is `/Volumes/external/project/SidequestLab/projects/livenote/app`, branch is `infra/firebase-cloud-run-migration`, remote is `namseokyoo/livenote`, tracked workspace is clean except changes introduced by this goal.
   - Gate: stop immediately on wrong repo/branch/remote or unexpected tracked edits.
2. **Harness skeleton** — create/update required harness files before fixes.
   - Expected result: `spec.md` and `checklist.md` list G0-G13, commands, expected outcomes, and hard stops.
   - Gate: no implementation continues unless every gate has an evidence slot.
3. **G1 Diagnose current wrong test setup** — record the exact current bug before changing it.
   - Current known failure: `package.json` has `"test": "vitest run"` and there is no `vitest.config.ts`, so Vitest discovers Playwright `tests/e2e/*.spec.ts` and fails on `test.describe()`.
   - Expected result: harness explains root cause and target fix.
   - Gate: if the observed failure differs materially, update diagnosis and stop if broad refactor is needed.
4. **G2 Fix Vitest unit-only scope** — add/update `vitest.config.ts` with explicit unit include/exclude.
   - Expected shape: include unit files such as `tests/**/*.test.ts` / `tests/**/*.test.tsx`; exclude `tests/e2e/**`, `**/*.spec.ts`, `test-results/**`, `.next/**`, `node_modules/**`.
   - Expected result: `npm run test` and `npm run test:unit` both pass and include `tests/rate-limit-service.test.ts`.
   - Gate: fail if zero unit tests are discovered or Playwright specs are still imported by Vitest.
5. **G3/G4 Add Playwright E2E script/config separation** — add explicit scripts and ensure Playwright discovery is isolated.
   - Expected package scripts: `test` = unit-only, `test:unit` = unit-only, `test:watch` = unit watch, `test:e2e` = Playwright.
   - Expected Playwright behavior: `npm run test:e2e -- --list` lists `tests/e2e/qa-2026-04-18.spec.ts` and/or `tests/e2e/smoke.spec.ts` without running browser flows.
   - Gate: fail if the list command requires deploy credentials, hits production by default without clear opt-in, or discovers no E2E tests.
6. **G5 Lint gate** — run `npm run lint` after test config/script changes.
   - Expected result: exit 0; warning count and file locations recorded.
   - Gate: errors block completion; new warnings require fix or explicit explanation.
7. **G6 Build gate** — run `npm run build` after test/docs changes.
   - Expected result: exit 0 and Next route summary present.
   - Gate: any build failure blocks PASS.
8. **G7/G8 README and claim-safety gate** — replace default README with LiveNote-specific docs.
   - Expected result: README covers product purpose, verified architecture, local setup, test commands, Firebase/Cloud Run migration boundary, secret handling, and deploy hard stop.
   - Gate: fail if `create-next-app` remains or README claims shipped automatic AI summarization/action items, Cloud Run production readiness, public release readiness, or company-network accessibility.
9. **G9 Residue classification gate** — classify all major untracked groups.
   - Expected result: `untracked-classification.md` categorizes `.firebase/`, `.hermes/`, `.omx/`, `docs/marketing/`, `docs/plans/`, `playwright.config.ts`, `test-results/`, `tests/e2e/*.spec.ts`, and screenshots as `keep candidate`, `ignore/generated`, or `review-before-commit` with rationale.
   - Gate: do not delete or stage private/generated residue silently.
10. **G10 Ignore-safety gate** — update `.gitignore` only where needed.
    - Expected result: generated/runtime outputs are protected; source/config/docs candidates are not accidentally ignored.
    - Gate: fail if `playwright.config.ts`, `tests/e2e/*.spec.ts`, or `docs/marketing/*.md` become ignored when they should remain reviewable.
11. **G11-G13 Final verification gates** — run all local gates and validate evidence.
    - Required commands: `npm run lint`, `npm run test`, `npm run test:unit`, `npm run build`, `npm run test:e2e -- --list`, `git diff --check`, `python3 -m json.tool .hermes/harness/livenote-release-readiness-2026-05-24/evidence.json`.
    - Expected result: evidence JSON is valid and records each gate with command, exit code, expected result, actual result, status, and artifact refs.
    - Gate: any missing evidence or unauthorized side effect makes verdict FAIL.
12. **Final report** — write PASS/PARTIAL/FAIL with exact changed files, command outputs, residual risks, and next decision.
    - Expected result: short, auditable report; separates local PR-readiness from deploy/preview/cutover readiness.
    - Gate: stop before push/PR/deploy.

## Core Verification After Goal Completion

Core should independently run:

```bash
git status --short --branch
npm run lint
npm run test
npm run test:unit
npm run build
npm run test:e2e -- --list
git diff --check
python3 -m json.tool .hermes/harness/livenote-release-readiness-2026-05-24/evidence.json
```

Core should inspect:

```bash
git diff -- README.md package.json vitest.config.ts playwright.config.ts .gitignore docs .hermes/harness/livenote-release-readiness-2026-05-24
```

Core should verify:

- README does not contain `create-next-app`.
- README does not overclaim AI automation or production readiness.
- `.gitignore` does not ignore `playwright.config.ts`, `tests/e2e/*.spec.ts`, or `docs/marketing/*.md` if those are intended source/docs.
- final report separates `local release-readiness` from `Cloud Run/Firebase preview/cutover readiness`.

## Copy-pasteable `/goal` Prompt

```text
/goal LiveNote release-readiness / PR-prep cleanup

Boundary:
- Product repo root: /Volumes/external/project/SidequestLab/projects/livenote/app
- Product remote: https://github.com/namseokyoo/livenote.git
- Branch: infra/firebase-cloud-run-migration
- Lab repo root: /Volumes/external/project/SidequestLab
- Project container: /Volumes/external/project/SidequestLab/projects/livenote
- Deploy boundary: local product repo cleanup only; no deploy/push/merge/tag/PR/publication

Use plan:
/Volumes/external/project/SidequestLab/projects/livenote/app/docs/plans/2026-05-24-livenote-goal-release-readiness-plan.md

Mode: builder, bounded to local repository cleanup/docs/test config/harness evidence only.

Goal:
Make LiveNote locally release-candidate / PR-ready by separating Vitest unit tests from Playwright E2E tests, replacing the default README with accurate claim-safe LiveNote docs, classifying untracked residue, adding safe ignore rules if needed, and producing task-specific harness evidence.

Hard stops:
- No deploy, push, merge, tag, PR, workflow dispatch, release, or external publication.
- No credentials/secrets/service accounts/tokens/production data.
- Do not delete screenshots/test-results/.firebase/.omx/.hermes residue; classify first.
- Do not claim Cloud Run/Firebase production readiness, company-network accessibility, public release readiness, or shipped automatic AI summarization/action-item generation.
- Stop if the repo/branch/remote boundary differs or if a fix requires broad product refactor/dependency upgrade.

Measurable gates:
- G0 boundary safety.
- G1 current wrong test setup is diagnosed and recorded.
- G2 npm run test and npm run test:unit pass as Vitest unit-only; Playwright specs excluded.
- G3 npm run test:e2e -- --list lists Playwright tests without running full browser flows.
- G4 test scripts/config are explicit and isolated.
- G5 npm run lint exits 0 with warnings recorded.
- G6 npm run build exits 0 with route summary.
- G7 README is LiveNote-specific and no create-next-app template remains.
- G8 claim safety.
- G9 untracked residue classification.
- G10 ignore safety.
- G11 evidence JSON valid.
- G12 git diff --check passes.
- G13 no external side effects.

Done when:
- npm run lint/test/test:unit/build/test:e2e -- --list gates pass or a non-risk blocker is documented as PARTIAL.
- README.md, package.json, vitest.config.ts, optional .gitignore, and harness files are updated as needed.
- .hermes/harness/livenote-release-readiness-2026-05-24/{spec.md,checklist.md,untracked-classification.md,evidence.json,final-report.md} exists with real evidence.
- Final report contains task_id, harness_ref, harness_verdict, artifact_refs, verification results, residual risks, and next decision.

Return only a short summary plus artifact paths and exact verification results. Core will independently verify before accepting PASS.
```

## Next After This Goal

If this goal passes, the next decisions are separate:

1. Open a PR from `infra/firebase-cloud-run-migration` only after Core review.
2. Run Firebase/Cloud Run preview only after explicit deploy/auth approval.
3. Run company-network smoke when 형 can test target network access.
4. Update SidequestLab homepage/portfolio card only after LiveNote claims are verified and founder-approved.
