# LiveNote Secret Manager / Runtime Env Handling Decision

Date: 2026-05-12
Task ID: `livenote-firebase-cloud-run-migration`
Status: Adopted for migration planning

## Decision

Use server-side runtime secrets only for Cloud Run / Firebase migration. Prefer Google Secret Manager for production-sensitive values and Cloud Run runtime environment binding for non-secret configuration.

## Secret classes

| Class | Examples | Handling |
|---|---|---|
| Public client config | Firebase public client config, public project ID | May be exposed only if Firebase client-safe by design. Prefix with `NEXT_PUBLIC_` only when intentionally public. |
| Server runtime secret | pepper, server auth/session secret, Admin SDK credential, service account data | Secret Manager or Cloud Run secret env binding only. Never client bundle. |
| Operational config | Firebase project ID, RTDB URL, Cloud Run region | Runtime env or build/deploy config; not secret unless containing credentials. |
| Local dev placeholder | `.env.example`, `.env.local.example` | Placeholder values only. No real credentials. |

## Rules

1. Do not commit real `.env`, service account JSON, private keys, pepper values, or Secret Manager payloads.
2. Do not place Admin SDK/service account values in `NEXT_PUBLIC_*` variables.
3. Do not solve Firebase Hosting migration by moving server-only logic into client code.
4. Cloud Run production/preview should read sensitive values from Secret Manager or secret-bound runtime env.
5. Logs must not print secret values, JSON credentials, or decoded private keys.
6. Generated artifacts, screenshots, reports, and command outputs must redact secret values.

## Recommended Cloud Run mapping

| Variable | Exposure | Source | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client-public | Env/config | Acceptable only for Firebase client SDK. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client-public | Env/config | Acceptable. |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Client-public | Env/config | Acceptable if RTDB rules are correct. |
| `FIREBASE_ADMIN_PROJECT_ID` | Server-only | Runtime env / Secret Manager | Do not expose to client bundle. |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Server-only | Secret Manager | If used. |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Server-only | Secret Manager | Preserve newline handling; never log. |
| `NOTE_CODE_PEPPER` | Server-only | Secret Manager | Must not be static/client-visible. |
| `SESSION_SECRET` / equivalent | Server-only | Secret Manager | Required if session signing exists. |

## Verification

Before preview PASS:

```bash
# Ensure real env files are not tracked
git status --short -- .env .env.local .env.production serviceAccount*.json

# Search source for dangerous public exposure patterns
# Use ripgrep or equivalent; redact results if values appear.
rg "NEXT_PUBLIC_.*(SECRET|PRIVATE|PEPPER|ADMIN|SERVICE|KEY_JSON)|serviceAccount|private_key|NOTE_CODE_PEPPER|SESSION_SECRET" src next.config.ts firebase.json Dockerfile .env*.example

# Inspect built output only for variable names/patterns, not secret values.
# If any real value is found, FAIL.
```

## Verdict

- `PASS`: secret classes are mapped, real secrets are absent from repo/client/logs, and runtime binding path is documented.
- `CONDITIONAL`: preview uses placeholder/dev secrets only and is not public; production cutover blocked until Secret Manager binding is verified.
- `FAIL`: any real secret appears in git, client bundle, logs, or generated artifacts.
