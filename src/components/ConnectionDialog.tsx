import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "./ui/Button"
import type { Person } from "../store/types"
import type { ConnectionType } from "../store/types"
import { CONNECTION_COLORS } from "../lib/constants"

interface ConnectionDialogProps {
  fromId: string
  toId: string
  people: Person[]
  onConfirm: (type: ConnectionType, strength: number, context: string) => Promise<void>
  onCancel: () => void
}

const TYPES: Array<{ value: ConnectionType; label: string }> = [
  { value: "friend",       label: "Barát" },
  { value: "work",         label: "Munka" },
  { value: "family",       label: "Család" },
  { value: "business",     label: "Üzleti" },
  { value: "acquaintance", label: "Ismerős" },
  { value: "community",    label: "Közösség" },
  { value: "bridge",       label: "Híd" },
  { value: "other",        label: "Egyéb" },
]

export default function ConnectionDialog({ fromId, toId, people, onConfirm, onCancel }: ConnectionDialogProps) {
  const [type, setType] = useState<ConnectionType>("friend")
  const [strength, setStrength] = useState(3)
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)

  const from = people.find(p => p.id === fromId)
  const to   = people.find(p => p.id === toId)

  async function handle() {
    setLoading(true)
    await onConfirm(type, strength, context)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-surface border border-border rounded-xl p-6 w-96 font-mono shadow-2xl"
      >
        <h2 className="text-text font-bold mb-1">Kapcsolat létrehozása</h2>
        <p className="text-muted text-sm mb-5">
          {from?.display_name} ↔ {to?.display_name}
        </p>

        <div className="mb-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Típus</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={type === t.value ? {
                  background: CONNECTION_COLORS[t.value] + "33",
                  borderColor: CONNECTION_COLORS[t.value],
                  color: CONNECTION_COLORS[t.value],
                } : undefined}
                className={`px-2 py-1.5 rounded text-xs border transition-colors ${
                  type === t.value ? "" : "border-border text-muted hover:border-border-strong/30 hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Erősség: {strength}</p>
          <input
            type="range" min={1} max={5} value={strength}
            onChange={e => setStrength(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>Gyenge</span><span>Erős</span>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Kontextus (opcionális)</p>
          <input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="pl. Egyetemen ismerkedtük meg"
            className="w-full bg-app border border-border rounded px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent font-mono"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Mégse</Button>
          <Button variant="primary" onClick={handle} disabled={loading}>
            {loading ? "Mentés..." : "Létrehozás"}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
