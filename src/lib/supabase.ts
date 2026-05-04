import { createClient } from "@supabase/supabase-js"
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
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers)
      try {
        const token = await firebaseAuth.currentUser?.getIdToken()
        if (token) headers.set("Authorization", `Bearer ${token}`)
      } catch {
        // No-op: if the token fetch fails we send an unauthenticated request and Supabase RLS rejects.
      }
      return fetch(input, { ...init, headers })
    },
  },
})
