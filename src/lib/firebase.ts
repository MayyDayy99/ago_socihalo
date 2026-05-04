import { initializeApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"

const firebaseConfig = {
  apiKey:        import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:     import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:         import.meta.env.VITE_FIREBASE_APP_ID,
  // storageBucket / messagingSenderId are only needed if those services are used
}

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  throw new Error(
    "Missing VITE_FIREBASE_* env vars. " +
    "Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID " +
    "in .env.local (dev) and as GitHub Action secrets (prod)."
  )
}

const app: FirebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(firebaseAuth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  await fbSignOut(firebaseAuth)
}

export { onAuthStateChanged }
export type { User }
