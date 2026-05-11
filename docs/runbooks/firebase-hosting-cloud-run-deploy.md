# Firebase Hosting + Cloud Run deploy runbook

## Variables

```bash
export PROJECT_ID="livenote-caf0d"
export REGION="asia-northeast3"
export SERVICE="livenote-web"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/livenote/${SERVICE}:$(git rev-parse --short HEAD)"
```

## One-time setup

```bash
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com firebasehosting.googleapis.com

gcloud artifacts repositories create livenote \
  --repository-format=docker \
  --location="$REGION" \
  --description="LiveNote Cloud Run images"
```

Create secrets manually or through a secure secret source. Do not paste values into committed files.

```bash
gcloud secrets create livenote-firebase-service-account-key --replication-policy=automatic
gcloud secrets create livenote-password-pepper --replication-policy=automatic
```

Grant the Cloud Run runtime service account secret access. Replace the service account if you use a custom runtime identity.

```bash
export RUNTIME_SA="${PROJECT_ID}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding livenote-firebase-service-account-key \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding livenote-password-pepper \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

## Build and deploy Cloud Run

```bash
gcloud builds submit --tag "$IMAGE" .

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production,NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",NEXT_PUBLIC_FIREBASE_DATABASE_URL="$NEXT_PUBLIC_FIREBASE_DATABASE_URL",NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" \
  --set-secrets FIREBASE_SERVICE_ACCOUNT_KEY=livenote-firebase-service-account-key:latest,PASSWORD_PEPPER=livenote-password-pepper:latest
```

Load the `NEXT_PUBLIC_FIREBASE_*` values from a secure local shell/session before running this command. They are public Firebase client config, but keeping them in env avoids drift between local and Cloud Run.

## Deploy Firebase Hosting preview

`firebase.json` rewrites all traffic to Cloud Run service `livenote-web` in `asia-northeast3`.

```bash
firebase use livenote-caf0d
firebase hosting:channel:deploy migration-preview --expires 7d
```

## Production cutover

Only after preview QA PASS:

```bash
firebase deploy --only hosting
```

## Rollback

1. In Firebase Hosting console, roll back to the previous release, or redeploy previous config.
2. If DNS/custom domain was changed, restore prior target.
3. Keep previous Vercel deployment alive until 24-72h observation is PASS.
