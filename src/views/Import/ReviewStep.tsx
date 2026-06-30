import { useEffect, useMemo, useState } from "react"
import { Button } from "../../components/ui/Button"
import { usePeople, useCreatePerson } from "../../hooks/usePeople"
import { toast } from "../../components/ui/Toast"

interface Candidate {
  display_name: string
  phone_numbers?: string[]
  emails?: string[]
  sources: Array<{ type: string; imported_at: string }>
}

interface ReviewStepProps {
  candidates: Candidate[]
  onDone: () => void
}

export default function ReviewStep({ candidates, onDone }: ReviewStepProps) {
  const { data: existingData } = usePeople()
  const existing = useMemo(() => existingData ?? [], [existingData])
  const createPerson = useCreatePerson()
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())

  const existingNames = useMemo(() => new Set(existing.map(p => p.display_name.toLowerCase())), [existing])

  // Collapse candidates by normalised name *within the batch*, merging their emails/phones,
  // so two entries for the same person don't import as two partial-data people. Also guards
  // against missing/blank names (which would otherwise crash on .toLowerCase()).
  const merged = useMemo(() => {
    const uniq = (a: string[]) => [...new Set(a.filter(Boolean))]
    const byName = new Map<string, Candidate>()
    for (const c of candidates) {
      const name = (c.display_name ?? "").trim()
      if (!name) continue
      const key = name.toLowerCase()
      const prev = byName.get(key)
      if (prev) {
        prev.phone_numbers = uniq([...(prev.phone_numbers ?? []), ...(c.phone_numbers ?? [])])
        prev.emails = uniq([...(prev.emails ?? []), ...(c.emails ?? [])])
      } else {
        byName.set(key, {
          ...c,
          display_name: name,
          phone_numbers: uniq(c.phone_numbers ?? []),
          emails: uniq(c.emails ?? []),
        })
      }
    }
    return [...byName.values()]
  }, [candidates])

  const rows = useMemo(() =>
    merged.map((c, i) => ({
      ...c,
      i,
      duplicate: existingNames.has(c.display_name.toLowerCase()),
    })),
    [merged, existingNames]
  )

  useEffect(() => {
    setSelected(new Set(rows.filter(r => !r.duplicate).map(r => r.i)))
  }, [rows])

  const selectableCount = rows.filter(r => !r.duplicate).length
  const allSelected = selectableCount > 0 && rows.every(r => r.duplicate || selected.has(r.i))
  const newCount = rows.filter(r => !r.duplicate && selected.has(r.i)).length

  function toggle(i: number) {
    setSelected(s => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.filter(r => !r.duplicate).map(r => r.i)))
    }
  }

  async function importSelected() {
    setImporting(true)
    try {
      const toImport = rows.filter(r => selected.has(r.i) && !r.duplicate)
      for (const c of toImport) {
        await createPerson.mutateAsync({
          display_name: c.display_name,
          phone_numbers: c.phone_numbers ?? [],
          emails: c.emails ?? [],
          sources: c.sources as never,
        })
      }
      setImportedCount(toImport.length)
      setDone(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Importálás sikertelen")
    } finally {
      setImporting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-text font-bold mb-1">Importálás kész!</p>
        <p className="text-muted text-sm mb-5">{importedCount} személy hozzáadva</p>
        <Button variant="primary" onClick={onDone}>Bezárás</Button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted">
          {rows.length} névjegy · {rows.filter(r => r.duplicate).length} duplikált · <span className="text-text">{newCount} új kerülne be</span>
        </p>
        <button onClick={toggleAll} className="text-xs text-accent hover:underline">
          {allSelected ? "Mindent le" : "Mindent be"}
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border/30 mb-4">
        {rows.map(r => (
          <div
            key={r.i}
            className={`flex items-center gap-3 px-3 py-2 ${r.duplicate ? "opacity-40" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.has(r.i) && !r.duplicate}
              disabled={r.duplicate}
              onChange={() => toggle(r.i)}
              className="accent-accent"
            />
            <span className="text-sm text-text flex-1 truncate">{r.display_name}</span>
            {r.duplicate && <span className="text-xs text-yellow-400">már létezik</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onDone}>Mégse</Button>
        <Button variant="primary" onClick={importSelected} disabled={newCount === 0 || importing}>
          {importing ? "Importálás..." : `${newCount} személy importálása`}
        </Button>
      </div>
    </div>
  )
}
