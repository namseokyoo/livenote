import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let rtdbInstance: Database | null = null;
let authInstance: Auth | null = null;
let authInitPromise: Promise<void> | null = null;
let signInPromise: Promise<string> | null = null;
let cachedUid: string | null = null;

function waitForAuthInit(auth: Auth): Promise<void> {
  if (!authInitPromise) {
    authInitPromise = typeof auth.authStateReady === 'function'
      ? auth.authStateReady()
      : new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          });
        });
  }

  return authInitPromise;
}

export function getRtdb(): Database {
  if (!rtdbInstance) {
    rtdbInstance = getDatabase(firebaseApp);
  }

  return rtdbInstance;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
    onAuthStateChanged(authInstance, (user) => {
      cachedUid = user?.uid ?? null;
    });
  }

  return authInstance;
}

export async function signInAnonymouslyIfNeeded(): Promise<string> {
  if (cachedUid) {
    return cachedUid;
  }

  if (signInPromise) {
    return signInPromise;
  }

  const auth = getFirebaseAuth();

  signInPromise = (async () => {
    await waitForAuthInit(auth);

    if (auth.currentUser) {
      cachedUid = auth.currentUser.uid;
      return cachedUid;
    }

    const credential = await signInAnonymously(auth);
    cachedUid = credential.user.uid;
    return cachedUid;
  })();

  return signInPromise;
}
