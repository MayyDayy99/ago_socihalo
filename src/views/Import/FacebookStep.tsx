import { useState } from "react"
import { parseFacebookExport } from "../../lib/fb-import"

interface FacebookStepProps {
  onParsed: (candidates: unknown[]) => void
}

export default function FacebookStep({ onParsed }: FacebookStepProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const candidates = await parseFacebookExport(file)
      onParsed(candidates)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba")
    }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div className="bg-surface-2 border border-border rounded-lg p-4 text-sm text-muted space-y-2">
        <p className="text-text font-medium">Facebook adatexport szükséges</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Menj a Facebook → Beállítások → Adataid letöltése</li>
          <li>Válaszd a JSON formátumot</li>
          <li>Töltsd le az archívumot (ZIP)</li>
          <li>Töltsd fel ide a ZIP fájlt</li>
        </ol>
      </div>

      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors">
        <span className="text-muted text-sm mb-1">{loading ? "Feldolgozás..." : "Kattints vagy húzz ide egy ZIP fájlt"}</span>
        <span className="text-xs text-muted">facebook-*.zip</span>
        <input
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFile}
          disabled={loading}
        />
      </label>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
      )}
    </div>
  )
}
