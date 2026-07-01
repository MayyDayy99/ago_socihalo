import { createClient } from "@supabase/supabase-js"
import { onIdTokenChanged } from "firebase/auth"
import { firebaseAuth } from "./firebase"

const url     = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error("Hiányzó VITE_SUPABASE_URL vagy VITE_SUPABASE_ANON_KEY")
}

// Auth model: Firebase issues the user identity, Supabase verifies the Firebase JWT
// as a third-party auth provider. Every Supabase request is authenticated by attaching
// the current Firebase ID token as the Authorization header.
//
// REQUIRED Supabase setup (one-time, dashboard or SQL):
//   - Authentication → Sign In / Up → Third Party Auth → add Firebase
//     OR: SELECT auth.set_third_party_auth_provider(jsonb_build_object(
//           'firebase_project_id', 'your-firebase-project-id'))
//   - RLS policies must use (auth.jwt() ->> 'sub') = user_id (text-typed)
//
// We disable Supabase's own session machinery — we have no Supabase users.
//
// `accessToken` is the supported hook for third-party auth: supabase-js calls it whenever
// it needs a bearer token and attaches the result to BOTH PostgREST (REST) requests and the
// Realtime websocket. REST re-invokes it per request, so REST is always fresh. The Realtime
// socket, however, only gets the token at connect time and does NOT re-fetch it once an
// explicit token has been set, so we refresh it ourselves on token rotation below.
// A previous global.fetch wrapper only covered REST, leaving Realtime unauthenticated.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  accessToken: async () => {
    try {
      return (await firebaseAuth.currentUser?.getIdToken()) ?? null
    } catch {
      // If the token fetch fails we send an unauthenticated request and Supabase RLS rejects.
      return null
    }
  },
})

// Firebase rotates the ID token (~hourly, and on sign-in/out) and fires onIdTokenChanged.
// Push each fresh token to the Realtime socket so RLS-gated postgres_changes keep flowing;
// without this the live map would silently stop updating after the first token expires.
onIdTokenChanged(firebaseAuth, (user) => {
  if (!user) return
  user.getIdToken().then((token) => supabase.realtime.setAuth(token)).catch(() => {})
})
