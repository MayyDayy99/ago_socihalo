import { useState } from "react"
import { parseVCardFile } from "../../lib/vcard"

interface VcfStepProps {
  onParsed: (candidates: unknown[]) => void
}

const SOURCES = [
  { label: "Google Névjegyek", steps: ["Nyisd meg: contacts.google.com", "Exportálás → vCard (.vcf)", "Töltsd fel az itt kapott fájlt"] },
  { label: "macOS Névjegyek", steps: ["Névjegyek app → Fájl → Exportálás → vCard", "Töltsd fel az itt kapott fájlt"] },
  { label: "Outlook", steps: ["Outlook → Fájl → Importálás/Exportálás → Exportálás fájlba → vCard", "Töltsd fel az itt kapott fájlt"] },
  { label: "Bármilyen más", steps: ["Exportálj .vcf fájlt az alkalmazásból", "Töltsd fel ide"] },
]

export default function VcfStep({ onParsed }: VcfStepProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openGuide, setOpenGuide] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const contacts = parseVCardFile(text)
      if (contacts.length === 0) throw new Error("Nem találtam névjegyeket a fájlban. Biztos .vcf formátumban exportáltad?")
      onParsed(contacts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba")
    }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Bármilyen alkalmazásból exportált <span className="text-white">.vcf fájlt</span> elfogad — egy névjegy vagy ezres lista is működik.
      </p>

      {/* Source guides */}
      <div className="space-y-1.5">
        {SOURCES.map(s => (
          <div key={s.label} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenGuide(openGuide === s.label ? null : s.label)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-surface-2 transition-colors"
            >
              <span>{s.label}</span>
              <span className="text-muted text-xs">{openGuide === s.label ? "▲" : "▼"}</span>
            </button>
            {openGuide === s.label && (
              <ol className="list-decimal list-inside text-xs text-muted px-4 pb-3 space-y-1 bg-surface-2/30">
                {s.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      {/* Upload area */}
      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors">
        <span className="text-2xl mb-1">📁</span>
        <span className="text-muted text-sm">{loading ? "Feldolgozás..." : "Kattints vagy húzz ide egy .vcf fájlt"}</span>
        <input
          type="file"
          accept=".vcf,.vcard"
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
