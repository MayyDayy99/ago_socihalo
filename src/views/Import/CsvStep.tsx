import { useState } from "react"
import { parseCsv, autoDetectMapping, applyMapping } from "../../lib/csv-import"
import type { CsvMapping } from "../../lib/csv-import"
import { Select } from "../../components/ui/Select"
import { Button } from "../../components/ui/Button"

interface CsvStepProps {
  onParsed: (candidates: unknown[]) => void
}

export default function CsvStep({ onParsed }: CsvStepProps) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<CsvMapping>({ name: "", email: "", phone: "" })
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"upload" | "map">("upload")

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const text = await file.text()
      const { headers, rows } = parseCsv(text)
      if (headers.length === 0) throw new Error("Nem sikerült feldolgozni a CSV fájlt. Ellenőrizd a formátumot.")
      setHeaders(headers)
      setRows(rows)
      const auto = autoDetectMapping(headers)
      setMapping({ name: auto.name ?? "", email: auto.email ?? "", phone: auto.phone ?? "" })
      setStep("map")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba")
    }
  }

  function handleConfirm() {
    if (!mapping.name) { setError("A Név mező megadása kötelező."); return }
    const candidates = applyMapping(rows, mapping)
    if (candidates.length === 0) { setError("Egyetlen érvényes sor sem található."); return }
    onParsed(candidates)
  }

  const colOptions = [
    { value: "", label: "— kihagyás —" },
    ...headers.map(h => ({ value: h, label: h })),
  ]

  const preview = rows.slice(0, 4)

  return (
    <div className="space-y-5">
      {step === "upload" && (
        <>
          <div className="bg-surface-2 border border-border rounded-lg p-4 text-sm text-muted space-y-1">
            <p className="text-text font-medium">CSV / táblázat importálás</p>
            <p className="text-xs">Az első sor legyen az oszlopfejléc (Név, Email, Telefon stb.)</p>
            <p className="text-xs">Elfogad: .csv, .txt — vesszővel vagy pontosvesszővel tagolt</p>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors">
            <span className="text-2xl mb-1">📊</span>
            <span className="text-muted text-sm">Kattints vagy húzz ide egy CSV fájlt</span>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </label>
        </>
      )}

      {step === "map" && (
        <>
          <p className="text-sm text-muted">
            <span className="text-text">{rows.length}</span> sor találva. Párosítsd az oszlopokat:
          </p>

          <div className="space-y-3">
            <Select
              label="Név oszlop *"
              options={colOptions}
              value={mapping.name}
              onChange={e => setMapping(m => ({ ...m, name: e.target.value }))}
            />
            <Select
              label="E-mail oszlop"
              options={colOptions}
              value={mapping.email}
              onChange={e => setMapping(m => ({ ...m, email: e.target.value }))}
            />
            <Select
              label="Telefon oszlop"
              options={colOptions}
              value={mapping.phone}
              onChange={e => setMapping(m => ({ ...m, phone: e.target.value }))}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && mapping.name && (
            <div className="border border-border rounded-lg overflow-hidden">
              <p className="text-xs text-muted px-3 py-2 border-b border-border bg-surface-2">Előnézet ({preview.length} sor)</p>
              <div className="divide-y divide-border/30">
                {preview.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                    <span className="text-text font-medium flex-1 truncate">{row[mapping.name] || "—"}</span>
                    {mapping.email && <span className="text-muted truncate max-w-[120px]">{row[mapping.email] || "—"}</span>}
                    {mapping.phone && <span className="text-muted">{row[mapping.phone] || "—"}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setStep("upload"); setHeaders([]); setRows([]) }}>← Vissza</Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!mapping.name}>
              Tovább ({rows.length} sor)
            </Button>
          </div>
        </>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
      )}
    </div>
  )
}
