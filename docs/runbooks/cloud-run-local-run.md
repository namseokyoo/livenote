# Cloud Run local runbook

## Build locally

```bash
cd /Volumes/external/project/SidequestLab/projects/livenote/app
npm ci
npm run build
docker build -t livenote-cloudrun:local .
```

## Run locally

Use a real local env file with server-only values. Do not commit it.

```bash
docker run --rm \
  -p 8080:8080 \
  --env-file .env.local \
  -e PORT=8080 \
  livenote-cloudrun:local
```

Open `http://localhost:8080`.

## Expected checks

1. Homepage loads.
2. `/api/notes?limit=1` returns JSON or an expected auth/config error, not a process crash.
3. Create note works with valid Firebase credentials.
4. Verify password works.
5. RTDB-backed realtime editing still works in browser because client Firebase config remains public `NEXT_PUBLIC_*` config.

## Notes

- The Dockerfile uses Next standalone output from `.next/standalone`.
- Server secrets stay runtime-only via env/Secret Manager.
- Native `bcrypt` is installed inside the Linux container during `npm ci`.
