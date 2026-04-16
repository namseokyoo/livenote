import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 필요합니다.');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);

  return initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export function getAdminRtdb() {
  return getDatabase(getAdminApp());
}
