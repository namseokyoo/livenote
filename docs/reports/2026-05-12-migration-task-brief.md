# LiveNote Migration Task Brief / Adaptive Harness

Date: 2026-05-12
Task ID: `livenote-firebase-cloud-run-migration`
Status: Ready for OMX/Codex execution planning

## Boundary preflight

```yaml
boundary_preflight:
  lab_repo_root: /Volumes/external/project/SidequestLab
  lab_repo_projects_ignored: true
  project_container: /Volumes/external/project/SidequestLab/projects/livenote
  product_repo_root: /Volumes/external/project/SidequestLab/projects/livenote/app
  product_repo_remote: https://github.com/namseokyoo/livenote.git
  product_branch: infra/firebase-cloud-run-migration
  deployment_boundary: LiveNote product repo, not SidequestLab deploy surface
```

## Harness

```yaml
task_id: livenote-firebase-cloud-run-migration
task_type: mixed
risk_tier: high
intent_lock:
  - Provide a LiveNote deployment path that is more likely to work from the company network than the current Vercel path.
  - Preserve LiveNote's core user journey: create note, open private note, edit content, retain content, and collaborate in realtime.
  - Preserve server runtime boundaries for auth, secrets, pepper, and Admin SDK usage.
context_lock:
  references:
    - docs/repo-boundary.md
    - docs/reports/2026-05-12-migration-decision.md
    - docs/reports/2026-05-12-migration-preflight.md
    - docs/reports/2026-05-12-firebase-connectivity-spike.md
    - docs/reports/2026-05-12-cloud-run-preview-qa.md
    - docs/runbooks/cloud-run-local-run.md
    - docs/runbooks/firebase-hosting-cloud-run-deploy.md
  source_of_truth_update:
    - SidequestLab `projects/` is ignored; LiveNote app work belongs to the product repo at `projects/livenote/app`.
    - Current Lab structure remains Core=router/verifier and OMX/Codex=execution+harness; oh-my-hermes is reference-only for later.
  must_preserve:
    - No client exposure of Admin SDK keys, service account JSON, pepper, or Secret Manager payloads.
    - No static-only migration that removes required server runtime behavior.
    - No claim of company-network readiness without connectivity evidence.
  allowed_adaptations:
    - Firebase Hosting rewrite to Cloud Run.
    - Cloud Run-only preview fallback if Firebase Hosting is not yet wired.
    - App Hosting spike only if Cloud Run baseline is understood.
negative_criteria:
  hard_fail:
    - Treating `projects/livenote` as SidequestLab tracked deployment surface.
    - Shipping or logging secrets.
    - Claiming migration PASS without build/start evidence and at least one smoke path.
    - Claiming collaboration PASS without RTDB REST/realtime evidence or an explicit network limitation note.
    - Using only in-memory rate limit for production cutover without shared-state mitigation or waiver.
  warnings:
    - Firebase App Hosting chosen before proving Next 16 / React 19 / native bcrypt compatibility.
    - Cloud Run preview works locally but has no target-network test.
    - Rate limit mitigation deferred beyond preview.
role_split:
  planner: Turn this brief into a minimal execution sequence and identify irreversible or credential-gated steps.
  builder: Implement only the approved migration/config/test changes inside the LiveNote product repo.
  critic: Attack boundary drift, secret exposure, network assumptions, and false PASS conditions.
  verifier: Produce command outputs, URLs/log handles, and manual/browser evidence against this harness.
artifact_evidence:
  required:
    - command:npm/build or container build result
    - command:Cloud Run local or preview start result
    - command:Firebase Hosting rewrite or deploy dry-run/config verification
    - report:company-network connectivity checklist result
    - report:Firebase RTDB REST + realtime collaboration result
    - report:secret handling check result
    - report:rate limit shared-state decision/result
  optional:
    - screenshot:preview smoke path
    - log:Cloud Run request log excerpt
    - URL:preview endpoint, if created
verdict:
  allowed_values: [PASS, CONDITIONAL, FAIL]
  pass_rule: PASS only if build/start, preview smoke, RTDB collaboration, secret handling, and rate-limit shared-state gates are satisfied or explicitly scoped as preview-only with a waiver.
  escalation_rule: If company network blocks Firebase/RTDB too, stop migration execution and return to Core with alternatives.
update_rule:
  when_gap_found: Update this brief or the relevant runbook before continuing. Do not bury a new gate only in chat.
```

## Execution sequence

1. Confirm repo boundary and current branch.
2. Run local build/container smoke from the LiveNote product repo.
3. Verify Firebase config and Hosting rewrite target.
4. Verify Cloud Run runtime secrets are runtime-only.
5. Run company-network connectivity checklist.
6. Run Cloud Run preview QA checklist.
7. Decide and implement shared-state rate limit mitigation for production cutover.
8. Produce a final report using the required harness fields:
   - `task_id`
   - `harness_ref`
   - `harness_verdict`
   - `artifact_refs`

## Stop conditions

Stop and report to Core instead of guessing if:

- credentials or production project access is required;
- deploy would affect a public/production URL;
- target company-network testing cannot be performed from the available environment;
- Firebase/Cloud Run quota, billing, or project ownership is unclear;
- required secrets are missing or appear in unsafe locations.
