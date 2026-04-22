import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Search, X } from "lucide-react"
import { Button } from "./ui/Button"
import type { Person } from "../store/types"
import { GROUPS } from "../lib/constants"

interface Props {
  fromPerson: Person
  people: Person[]
  onPick: (toId: string) => void
  onCancel: () => void
}

export default function PathFindDialog({ fromPerson, people, onPick, onCancel }: Props) {
  const [q, setQ] = useState("")

  const candidates = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return people
      .filter(p => p.id !== fromPerson.id && !p.archived)
      .filter(p => !ql || p.display_name.toLowerCase().includes(ql))
      .slice(0, 30)
  }, [people, fromPerson.id, q])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.12 }}
        onClick={e => e.stopPropagation()}
        className="bg-surface border border-border-strong rounded-xl w-full max-w-md shadow-panel overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-text font-semibold text-sm">Útvonal keresése</h2>
            <p className="text-muted text-xs mt-0.5">Innen: {fromPerson.display_name}</p>
          </div>
          <button onClick={onCancel} className="text-muted hover:text-text p-1" aria-label="Bezárás">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 bg-surface-2 border border-border rounded px-2.5 py-1.5">
            <Search size={13} className="text-muted" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Név keresése…"
              className="bg-transparent text-sm text-text placeholder-muted focus:outline-none flex-1"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">Nincs találat</p>
          ) : (
            candidates.map(p => {
              const g = p.group_key ? GROUPS[p.group_key] : null
              return (
                <button
                  key={p.id}
                  onClick={() => onPick(p.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-2 text-left transition-colors"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                    style={{
                      background: g ? g.color + "22" : "#F3F4F6",
                      color: g ? g.color : "#6B7280",
                    }}
                  >
                    {(p.display_name[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="text-sm text-text flex-1 truncate">{p.display_name}</span>
                  {g && <span className="text-xs text-muted">{g.label}</span>}
                </button>
              )
            })
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onCancel}>Mégse</Button>
        </div>
      </motion.div>
    </div>
  )
}
