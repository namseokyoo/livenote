# LiveNote Company Network Connectivity Checklist

Date: 2026-05-12
Task ID: `livenote-firebase-cloud-run-migration`
Status: Required before production cutover

## Purpose

The migration is only useful if the replacement path works from the target company network. A Vercel block does not guarantee Firebase, Cloud Run, or RTDB realtime traffic will pass.

## Test environments

Record results separately for each network:

| Network | Required? | Notes |
|---|---:|---|
| Home / unrestricted network | Yes | Baseline to separate app bugs from company-network policy. |
| Company network | Yes | Primary go/no-go environment. |
| Mobile hotspot | Optional | Useful third baseline when company network fails. |

## Endpoints to test

Fill concrete endpoints during execution.

| Endpoint class | Example / target | Required result |
|---|---|---|
| Firebase Hosting | `https://<project>.web.app` or custom domain | HTTP 200/3xx and app shell loads. |
| Firebase Hosting alternate | `https://<project>.firebaseapp.com` | HTTP 200/3xx and app shell loads. |
| Cloud Run direct | `https://<service>-<hash>-<region>.run.app` | HTTP 200/3xx or expected auth redirect. |
| Firebase RTDB REST | `https://<db>.firebaseio.com/.json` or scoped test path | Reachable; expected auth/permission response is acceptable. |
| Firebase RTDB realtime/WebSocket | App collaboration path | Realtime sync observed between two clients or clear failure logged. |
| Static assets | JS/CSS/font/image assets under Hosting/Cloud Run | No blocked asset classes. |

## Command checks

Use these as templates; replace placeholders.

```bash
# DNS / TLS / HTTP reachability
curl -I https://<firebase-hosting-domain>
curl -I https://<cloud-run-domain>

# RTDB REST reachability; 401/403 can be acceptable if it proves network reachability
curl -i https://<database>.firebaseio.com/.json

# Asset reachability
curl -I https://<firebase-hosting-domain>/_next/static/<asset>
```

## Browser smoke checks

| Check | Expected result | Evidence |
|---|---|---|
| Open landing page | No company-network block page; app loads. | Screenshot or browser log. |
| Create note | New note code/link generated. | Screenshot/log. |
| Open note by code/link | Note page loads. | Screenshot/log. |
| Type and persist content | Content remains after refresh. | Screenshot/log. |
| Two-client collaboration | Client A update appears in Client B without manual refresh. | Screenshot/video/log. |
| Auth/private note flow | Private access prompt/session works as designed. | Screenshot/log. |

## Pass / conditional / fail

- `PASS`: Firebase Hosting or Cloud Run entrypoint works from company network, and RTDB REST + realtime collaboration are verified.
- `CONDITIONAL`: Main app loads but RTDB realtime is blocked or untested; migration may continue only as preview/spike.
- `FAIL`: Replacement entrypoint is also blocked, or core note open/edit flow fails on the target network.

## Reporting format

Final report must include:

```yaml
task_id: livenote-firebase-cloud-run-migration
network: <home|company|hotspot>
entrypoint_tested: <url>
rtdb_rest_result: <PASS|CONDITIONAL|FAIL>
rtdb_realtime_result: <PASS|CONDITIONAL|FAIL>
app_smoke_result: <PASS|CONDITIONAL|FAIL>
evidence_refs:
  - <screenshot/log/command output path or URL>
verdict: <PASS|CONDITIONAL|FAIL>
notes: <blocked domains, errors, or policy observations>
```
