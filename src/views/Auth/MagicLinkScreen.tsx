import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { motion } from "framer-motion"

function getAuthRedirectTo() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes("signup") || lower.includes("signups") || lower.includes("not allowed")) {
    return "Ez az e-mail még nincs beengedve, és a Supabase-ben tiltva van az új felhasználók regisztrációja. Kapcsold be: Authentication → Providers → Email → Allow new users to sign up."
  }

  if (lower.includes("rate") || lower.includes("too many")) {
    return "Túl sok belépési linket kértél rövid idő alatt. Várj egy kicsit, aztán próbáld újra."
  }

  if (lower.includes("redirect")) {
    return `A belépési átirányítás nincs engedélyezve Supabase-ben: ${getAuthRedirectTo()}`
  }

  return message
}

export default function MagicLinkScreen() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const normalizedEmail = email.trim().toLowerCase()
    setEmail(normalizedEmail)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getAuthRedirectTo(),
          shouldCreateUser: true,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-app flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="5" fill="#374151"/>
              <circle cx="6" cy="8" r="3" fill="#059669"/>
              <circle cx="26" cy="8" r="3" fill="#DC2626"/>
              <circle cx="6" cy="24" r="3" fill="#D97706"/>
              <circle cx="26" cy="24" r="3" fill="#7C3AED"/>
              <line x1="16" y1="16" x2="6" y2="8" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
              <line x1="16" y1="16" x2="26" y2="8" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
              <line x1="16" y1="16" x2="6" y2="24" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
              <line x1="16" y1="16" x2="26" y2="24" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
            </svg>
            <span className="text-2xl font-semibold tracking-tight text-text">Nexus</span>
          </div>
          <p className="text-muted text-sm">Személyes kapcsolati háló</p>
        </div>

        {sent ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center shadow-card">
            <div className="text-3xl mb-3">✉️</div>
            <p className="text-text font-medium mb-1">Link elküldve</p>
            <p className="text-muted text-sm">Nézd meg a postaládádat: <span className="text-accent">{email}</span></p>
            <button
              onClick={() => { setSent(false); setEmail("") }}
              className="mt-4 text-xs text-muted hover:text-text transition-colors"
            >
              Másik e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-6 space-y-4 shadow-card">
            <div>
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="te@example.com"
                className="w-full bg-app border border-border rounded px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <p className="text-family text-xs bg-family/10 border border-family/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-accent hover:bg-accent-2 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded transition-colors"
            >
              {loading ? "Küldés..." : "Magic link küldése"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
