import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { motion } from "framer-motion"

function getAuthRedirectTo() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes("provider is not enabled") || lower.includes("provider not enabled")) {
    return "A Google bejelentkezés még nincs bekapcsolva a Supabase oldalán. Lépj be a Supabase Dashboardra → Authentication → Providers → Google → kapcsold be."
  }
  if (lower.includes("redirect")) {
    return `A bejelentkezési átirányítás nincs engedélyezve Supabase-ben: ${getAuthRedirectTo()}`
  }
  if (lower.includes("popup_closed") || lower.includes("popup closed")) {
    return "Bezártad a Google ablakot. Próbáld újra."
  }
  return message
}

// Google's brand "G" mark — colored. The Google brand guidelines forbid recoloring or
// distorting it, so this is the official multi-color version.
function GoogleGIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5832-5.0364-3.7104H.957v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
      <path d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.957C.3477 6.1732 0 7.5477 0 9c0 1.4523.3477 2.8268.957 4.0418l3.0066-2.3318z" fill="#FBBC05"/>
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.957 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z" fill="#EA4335"/>
    </svg>
  )
}

export default function MagicLinkScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectTo(),
        },
      })
      if (error) throw error
      // Success path: the browser is redirected to Google. No state change needed.
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-app flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="5" fill="#374151"/>
              <circle cx="6" cy="8" r="3" fill="#059669"/>
              <circle cx="26" cy="8" r="3" fill="#DC2626"/>
              <circle cx="6" cy="24" r="3" fill="#D97706"/>
              <circle cx="26" cy="24" r="3" fill="#7C3AED"/>
              <line x1="16" y1="16" x2="6"  y2="8"  stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
              <line x1="16" y1="16" x2="26" y2="8"  stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
              <line x1="16" y1="16" x2="6"  y2="24" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
              <line x1="16" y1="16" x2="26" y2="24" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
            </svg>
            <span className="text-3xl font-semibold tracking-tight text-text">Nexus</span>
          </div>
          <p className="text-muted text-sm">Személyes kapcsolati háló</p>
        </div>

        {/* Sign-in card */}
        <div className="bg-surface border border-border-strong rounded-xl p-6 shadow-card">
          <h1 className="text-text font-semibold text-base mb-1 text-center">Bejelentkezés</h1>
          <p className="text-muted text-xs text-center mb-5">
            Kattints a gombra és válaszd a Google fiókodat.
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed border border-border-strong text-text text-sm font-medium py-3 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                <span>Átirányítás…</span>
              </>
            ) : (
              <>
                <GoogleGIcon size={20} />
                <span>Belépés Google-fiókkal</span>
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 leading-relaxed">
              {error}
            </div>
          )}

          <p className="text-[11px] text-muted text-center mt-5 leading-relaxed">
            A Google ablak megnyílik egy új lapon. Engedélyezd hogy a Nexus<br />olvashassa az e-mail címedet — semmi mást nem kérünk.
          </p>
        </div>

        <p className="text-[11px] text-muted text-center mt-4">
          Probléma a bejelentkezéssel? Próbáld másik böngészőben<br />vagy törölsd a sütiket.
        </p>
      </motion.div>
    </div>
  )
}
