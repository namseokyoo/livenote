# LiveNote Access UX Goal Plan

> Core remains verifier; Codex is bounded executor for implementation only.

**Task ID:** `2026-05-25-livenote-access-ux`

**Goal:** Implement phases 1-6 from the commander thread: public/unlisted note option, password/retention guidance, create/join feedback, landing one-line value prop, edit/share/read-only guidance, and console warning cleanup without a broader design redesign.

**Architecture / Approach:** Add a minimal `visibility: public | unlisted` field to note records and API contracts. Keep public as the default and filter unlisted notes out of public/recent/search lists. Improve existing React components with clear inline guidance, loading/disabled states, and read-only/share notices while preserving current visual system.

**Tech Stack:** Next.js 16, React 19, TypeScript, Firebase RTDB, Vitest, Playwright.

---

## Boundary Preflight

- Lab repo root: `/Volumes/external/project/SidequestLab`
- Product repo root: `/Volumes/external/project/SidequestLab/projects/livenote/app`
- Product GitHub remote: `https://github.com/namseokyoo/livenote.git`
- Product branch at plan time: `infra/firebase-cloud-run-migration`
- Deploy boundary: local repo only; no deploy, push, merge, tag, or external service change.
- Ignored/local context boundary: parent SidequestLab may ignore `projects/livenote/app`; verify product repo directly.
- Existing boundary note: AGENTS.md requires task harness under `.hermes/harness/<task-id>/`.

## Current Evidence at Plan Time

- `git status --short --branch`: clean on `infra/firebase-cloud-run-migration...origin/infra/firebase-cloud-run-migration`.
- Existing UI files:
  - `src/app/page.tsx`
  - `src/components/CreateNoteForm.tsx`
  - `src/components/JoinNoteForm.tsx`
  - `src/components/NoteEditor.tsx`
  - `src/components/NoteList.tsx`
- Existing API/service files:
  - `src/app/api/notes/route.ts`
  - `src/lib/note-service-firebase.ts`
  - `src/types/note.ts`

## Non-Goals / Hard Stops

Do not:
- Redesign the visual identity or run a design overhaul.
- Add auth/accounts or true private user-owned note lists.
- Deploy, push, merge, tag, publish, or post externally.
- Touch credentials, Firebase project settings, secrets, or production data manually.
- Delete generated/untracked artifacts silently.

Stop and report if:
- A schema migration requiring production data rewrite is necessary.
- Firebase rules/admin settings must be changed.
- Tests require real credentials unavailable locally.

## Completion Criteria

1. Public is default; unlisted is selectable at create time.
2. Unlisted notes are not returned in public recent/search listing but remain accessible by note code/link.
3. Create form explains visibility, code/link retention, and 4-digit numeric password rule.
4. Create/join buttons show clear in-progress state and prevent duplicate submission.
5. Landing has a concise one-line feature statement and no overloaded password/share policy text.
6. Edit screen explains share/code access and clearly marks read-only guest mode with a noticeable but non-annoying banner.
7. Meaningful console warnings/errors introduced by the changes are removed.
8. Local gates pass or any environmental blocker is recorded truthfully.

## Measurable Goal Gates

| Gate ID | Gate | Required command / check | PASS threshold | FAIL / BLOCK condition |
|---|---|---|---|---|
| G0 | Boundary safety | `git rev-parse --show-toplevel`; `git branch --show-current`; `git remote -v`; `git status --short --branch` | Correct repo/branch/remote; changes classified | Wrong repo/branch or unrelated dirty state |
| G1 | Type/lint | `npm run lint` | Exit 0 or only pre-existing warnings documented | New lint errors |
| G2 | Unit tests | `npm run test` | Exit 0 | Nonzero exit from changed code |
| G3 | Build | `npm run build` | Exit 0 | Build failure |
| G4 | Visibility behavior | unit/manual code inspection | `visibility` defaults public, unlisted filtered from list/search, code access unchanged | unlisted leaks into public list or code access breaks |
| G5 | UX copy | inspect rendered/source copy | landing one-liner, create guidance, join feedback, share/read-only guidance present | missing required guidance or excessive landing copy |
| G6 | Browser console smoke | run local app and inspect main flows if possible | no new meaningful console error/warning on landing/create/join/note entry smoke | console errors from changed code |
| G7 | Harness evidence | `python3 -m json.tool .hermes/harness/2026-05-25-livenote-access-ux/evidence.json` | valid evidence JSON with gate results | missing/invalid evidence |
| G8 | Diff hygiene | `git diff --check` | Exit 0 | whitespace/conflict marker errors |
| G9 | Side-effect guard | inspect git/history/report | no deploy/push/merge/tag/publish | unauthorized side effect |

## Bite-Sized Task Sequence

### Task 1: Harness and boundary evidence
- Advance: G0, G7, G9
- Create/update `.hermes/harness/2026-05-25-livenote-access-ux/{spec.md,checklist.md,implementation-map.md,evidence.json,final-report.md}`.
- Record initial boundary and commands.

### Task 2: Add visibility model/API
- Advance: G4
- Modify `src/types/note.ts`, `src/lib/note-service-firebase.ts`, and `src/app/api/notes/route.ts`.
- Add `NoteVisibility = 'public' | 'unlisted'`.
- Default missing visibility to `public` for backward compatibility.
- Store `visibility` on new notes.
- Filter list/search results to public only.
- Return visibility in note create/get payloads where appropriate.

### Task 3: Create form UX
- Advance: G5
- Modify `src/components/CreateNoteForm.tsx`.
- Add public/unlisted selector, default public.
- Send visibility to POST body.
- Add 4-digit numeric password guidance.
- Add unlisted retention warning when selected.
- Improve loading text/disabled duplicate submission.

### Task 4: Join form feedback
- Advance: G5
- Modify `src/components/JoinNoteForm.tsx`.
- Improve loading text, disabled duplicate submission, and clearer error text.
- Add compact note that link/code is required for unlisted notes.

### Task 5: Landing copy simplification
- Advance: G5
- Modify `src/app/page.tsx`.
- Add concise one-line value prop: generated notes can be reopened later and multiple people can watch/write in realtime.
- Keep detailed password/privacy explanation out of landing.

### Task 6: Editor share/read-only guidance
- Advance: G5
- Modify `src/components/NoteEditor.tsx` and note page plumbing if needed.
- Add share/code guidance near copy button.
- Add clear read-only guest banner with subtle pulse or emphasis; avoid infinite aggressive blinking.
- If note visibility is available, show public/unlisted-specific access guidance.

### Task 7: Console warning cleanup
- Advance: G1, G6
- Fix introduced React warnings (keys, controlled inputs, invalid attrs, effect deps where practical).
- Do not suppress warnings blindly unless the existing code already intentionally documents an exception.

### Task 8: Verification and report
- Advance: G1-G9
- Run lint/test/build/diff checks.
- If runtime smoke is possible, run local app and browser/Playwright smoke for landing/create/join/read-only copy.
- Update evidence JSON and final report with PASS/PARTIAL/FAIL.

## Verdict Rules

- `PASS`: all required gates pass and evidence is complete.
- `PARTIAL`: core implementation gates pass, but an environmental runtime/browser/Firebase blocker prevents full smoke and is documented.
- `FAIL`: boundary, safety, build/test, visibility, diff-hygiene, or side-effect gate fails.

## Core Verification After Goal Completion

Core must rerun/inspect:

```bash
git status --short --branch
npm run lint
npm run test
npm run build
git diff --check
python3 -m json.tool .hermes/harness/2026-05-25-livenote-access-ux/evidence.json
```

Core should inspect changed source, harness final report, and if possible run a local browser smoke for console errors.

## Copy-Paste Codex Goal Prompt

```text
/goal LiveNote access UX phases 1-6

Boundary:
- Product repo root: /Volumes/external/project/SidequestLab/projects/livenote/app
- Product remote: https://github.com/namseokyoo/livenote.git
- Branch: infra/firebase-cloud-run-migration
- Deploy boundary: local changes only; no deploy/push/merge/tag/publish

Use plan:
/Volumes/external/project/SidequestLab/projects/livenote/app/docs/plans/2026-05-25-livenote-access-ux-goal-plan.md

Mode: builder, bounded to phases 1-6 only.

Goal:
Implement public default plus unlisted link/code option, required create/join feedback and guidance, landing one-line value prop, edit/share/read-only notices, and console warning cleanup. Do not perform design redesign.

Hard stops:
- No external side effects.
- No credential or Firebase admin setting changes.
- No broad visual redesign.
- Stop if production data migration or Firebase rules changes are required.

Done when:
- Required source changes are implemented.
- Harness files are complete.
- lint/test/build/diff/json gates are run and recorded.
- Final report states PASS/PARTIAL/FAIL with residual risks.

Return only a short summary plus changed paths, harness path, exact verification results, and residual risks. Core will independently verify.
```
