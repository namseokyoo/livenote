# Firebase/RTDB Connectivity Spike

Date: 2026-05-12
Environment: local Core machine, not company network.

## Result

```json
[
  {
    "check": "env:NEXT_PUBLIC_FIREBASE_DATABASE_URL",
    "ok": true,
    "detail": "livenote-caf0d-default-rtdb.asia-southeast1.firebasedatabase.app"
  },
  {
    "check": "env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "ok": true,
    "detail": "livenote-caf0d.firebaseapp.com"
  },
  {
    "check": "env:NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "ok": true,
    "detail": "livenote-caf0d"
  },
  {
    "check": "RTDB REST reachable",
    "ok": true,
    "detail": "HTTP 401"
  },
  {
    "check": "Firebase Anonymous Auth",
    "ok": true,
    "detail": "uid-prefix:vuByTs"
  },
  {
    "check": "RTDB client realtime connection",
    "ok": true,
    "detail": "connected=true"
  }
]

[Command timed out after 45s]
```

## Interpretation

- Local network Firebase/RTDB connectivity is validated if all checks show `ok: true`.
- This does **not** prove company-network access. Company-network verification remains required before production cutover.
- If company network blocks RTDB/WebSocket, migration must pause for allowlisting or alternative realtime backend design.

## Company-network manual check needed

Run the same deployed preview URL from company network and verify:
1. page load,
2. create note API,
3. password verify API,
4. two-tab realtime text propagation within 3 seconds.
