import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"

interface CardDavStepProps {
  onParsed: (candidates: unknown[]) => void
}

export default function CardDavStep({ onParsed }: CardDavStepProps) {
  const [appleId, setAppleId] = useState("")
  const [appPassword, setAppPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState("")

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setProgress("Kapcsolódás az iCloud-hoz...")

    try {
      const { data, error } = await supabase.functions.invoke("carddav-import", {
        body: { appleId, appPassword },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      setProgress(`${data.count} névjegy megtalálva`)
      onParsed(data.people)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba")
    }

    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div className="bg-surface-2 border border-border rounded-lg p-4 text-sm space-y-1">
        <p className="text-white font-medium">iCloud névjegyek importálása</p>
        <p className="text-muted text-xs">
          App-specifikus jelszó szükséges: <span className="text-accent">appleid.apple.com → Bejelentkezés és biztonság → App-specifikus jelszavak</span>
        </p>
        <p className="text-yellow-400/80 text-xs">A jelszó csak az import során kerül felhasználásra, nem tároljuk.</p>
      </div>

      <form onSubmit={handleImport} className="space-y-4">
        <Input
          label="Apple ID (e-mail)"
          type="email"
          value={appleId}
          onChange={e => setAppleId(e.target.value)}
          placeholder="te@icloud.com"
          required
        />
        <Input
          label="App-specifikus jelszó"
          type="password"
          value={appPassword}
          onChange={e => setAppPassword(e.target.value)}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          required
        />

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
        )}
        {progress && !error && (
          <p className="text-accent text-sm">{progress}</p>
        )}

        <Button type="submit" variant="primary" disabled={loading || !appleId || !appPassword} className="w-full justify-center">
          {loading ? "Importálás..." : "Névjegyek letöltése"}
        </Button>
      </form>
    </div>
  )
}
