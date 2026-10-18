// src/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics';

console.log("🔑 Meri API Key:", import.meta.env.VITE_FIREBASE_API_KEY);

// ==========================================
// FIREBASE CONFIG — Shadowverse Realtime DB
// ==========================================
// Yahan ": any" lagana zaroori hai warna TypeScript error dega
const firebaseConfig: any = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Dev sanity check — config load hui ya nahi
if (import.meta.env.DEV) {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.warn('[Firebase] Missing env vars:', missing);
  }
}

// Prevent duplicate init during HMR (Vite hot reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ==========================================
// SERVICES
// ==========================================
export const auth = getAuth(app);
export const db = getFirestore(app);        // Rooms, users, messages
export const rtdb = getDatabase(app);       // Live canvas, presence
export const storage = getStorage(app);     // Avatars, uploads

// ==========================================
// AUTH PERSISTENCE — browser reload ke baad bhi logged in
// ==========================================
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Persistence setup failed:', err);
});

// ==========================================
// FIRESTORE OFFLINE CACHE — offline bhi kaam kare
// ==========================================
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err: any) => {
    // Multi-tab ya unsupported browser mein silently ignore
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore] Persistence disabled: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore] Persistence not supported in this browser.');
    }
  });
}

// ==========================================
// ANALYTICS — sirf supported env mein
// ==========================================
export let analytics: any = null;
if (typeof window !== 'undefined') {
  analyticsSupported().then((ok) => {
    if (ok) analytics = getAnalytics(app);
  });
}

// ==========================================
// HELPER — Firestore collection paths
// ==========================================
export const COLLECTIONS = {
  USERS: 'users',
  ROOMS: 'rooms',
  DMS: 'dms',
};

// Yahan (roomId: string) lagana zaroori tha
export const RTDB_PATHS = {
  CANVAS: (roomId: string) => `canvases/${roomId}`,
  PRESENCE: (roomId: string) => `presence/${roomId}`,
};

export default app;