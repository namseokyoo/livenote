# LiveNote Repository Boundary

## Purpose

This document prevents Lab-level and product-level work from being mixed during the Firebase/Cloud Run migration.

## Boundaries

| Boundary | Path / Remote | Tracked by | Purpose |
|---|---|---|---|
| Lab operating repo | `/Volumes/external/project/SidequestLab` | `namseokyoo/sidequestlab` | Lab governance, shared harness, company-level operating docs. |
| Lab project container | `/Volumes/external/project/SidequestLab/projects/livenote` | Not tracked by SidequestLab (`projects/` is ignored) | Local Lab context, notes, artifacts, metrics, and retrospective. |
| LiveNote product repo | `/Volumes/external/project/SidequestLab/projects/livenote/app` | `namseokyoo/livenote` | Product source code, deployment config, product docs, migration implementation. |

## Deployment boundary

LiveNote deployment belongs to the product repository, not to the SidequestLab deployment surface.

- SidequestLab deploy/tracking surface: files above `/Volumes/external/project/SidequestLab/projects/`.
- LiveNote deploy/tracking surface: `/Volumes/external/project/SidequestLab/projects/livenote/app` and GitHub remote `namseokyoo/livenote`.
- Do not treat `projects/livenote/*` files as SidequestLab tracked deployment artifacts.
- Do not place LiveNote production secrets or deployment-specific app changes in the SidequestLab tracked area.

## Current migration branch

- Product repo branch: `infra/firebase-cloud-run-migration`
- Migration target: Firebase Hosting rewrite to Cloud Run, with Firebase RTDB retained for collaboration.

## Required boundary preflight for future Core/OMX work

Every non-trivial LiveNote migration work order must state:

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

## Hard failures

A migration task must not be accepted as complete if it:

- claims SidequestLab tracks `projects/livenote` content;
- commits LiveNote app code to the SidequestLab repository;
- treats Lab-local notes/artifacts outside `app/` as product release artifacts;
- exposes Firebase Admin SDK credentials, pepper values, service account JSON, or Secret Manager payloads;
- removes server runtime requirements by forcing a static-only Firebase Hosting migration.
