import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Search, Map, List, BarChart2, Upload, Settings, Route } from "lucide-react"
import { useAppStore } from "../../store/useAppStore"
import { usePeople } from "../../hooks/usePeople"
import { useConnections } from "../../hooks/useConnections"
import { shortestPath } from "../../lib/metrics"
import { GROUPS } from "../../lib/constants"

interface Action {
  id: string
  label: string
  sub?: string
  icon: React.ReactNode
  run: () => void
}

export default function CommandPalette() {
  const {
    setCommandPaletteOpen, setActiveView, setSelectedPersonId,
    selectedPersonId, setPathHighlight,
  } = useAppStore()
  const { data: people = [] } = usePeople()
  const { data: connections = [] } = useConnections()

  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function close() { setCommandPaletteOpen(false) }

  const navActions: Action[] = [
    { id: "nav-map",       label: "Térkép",       icon: <Map size={14} />,      run: () => { setActiveView("map");       close() } },
    { id: "nav-list",      label: "Lista",        icon: <List size={14} />,     run: () => { setActiveView("list");      close() } },
    { id: "nav-analytics", label: "Elemzés",      icon: <BarChart2 size={14} />,run: () => { setActiveView("analytics"); close() } },
    { id: "nav-import",    label: "Importálás",   icon: <Upload size={14} />,   run: () => { setActiveView("import");    close() } },
    { id: "nav-settings",  label: "Beállítások",  icon: <Settings size={14} />, run: () => { setActiveView("settings");  close() } },
  ]

  const personActions: Action[] = people
    .filter(p => !p.archived && p.display_name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
    .map(p => ({
      id: "person-" + p.id,
      label: p.display_name,
      sub: p.group_key ? GROUPS[p.group_key]?.label : undefined,
      icon: <span className="text-xs w-5 h-5 rounded-full inline-flex items-center justify-center" style={{ background: p.group_key ? GROUPS[p.group_key]?.color + "22" : "#F3F4F6", color: p.group_key ? GROUPS[p.group_key]?.color : "#6B7280" }}>{(p.display_name[0] ?? "?").toUpperCase()}</span>,
      run: () => { setSelectedPersonId(p.id); setActiveView("map"); close() },
    }))

  const pathActions: Action[] = selectedPersonId
    ? people
        .filter(p => p.id !== selectedPersonId && !p.archived && p.display_name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(p => {
          const from = people.find(x => x.id === selectedPersonId)
          return {
            id: "path-" + p.id,
            label: `Útvonal → ${p.display_name}`,
            sub: `${from?.display_name ?? "?"} → ${p.display_name}`,
            icon: <Route size={14} className="text-accent" />,
            run: () => {
              const path = shortestPath(selectedPersonId, p.id, connections)
              setPathHighlight(path)
              setActiveView("map")
              close()
            },
          }
        })
    : []

  const q = query.toLowerCase()
  const allActions: Action[] = [
    ...(q ? [] : navActions),
    ...personActions,
    ...(q ? pathActions : []),
  ]

  useEffect(() => { setHighlighted(0) }, [query])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, allActions.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === "Enter")     { allActions[highlighted]?.run() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={close}>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={14} className="text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Keresés vagy parancs..."
            className="flex-1 bg-transparent text-text text-sm focus:outline-none placeholder-muted"
          />
          <kbd className="text-xs text-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {allActions.length === 0 && (
            <p className="text-center text-muted text-sm py-6">Nincs találat</p>
          )}
          {allActions.map((action, i) => (
            <button
              key={action.id}
              onClick={action.run}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                ${i === highlighted ? "bg-surface-2 text-text" : "text-text/70 hover:bg-surface-2 hover:text-text"}`}
            >
              <span className="flex-shrink-0 text-muted">{action.icon}</span>
              <span className="flex-1 text-left">{action.label}</span>
              {action.sub && <span className="text-xs text-muted">{action.sub}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted">
          <span>↑↓ navigáció</span>
          <span>↵ megnyitás</span>
          <span>ESC bezárás</span>
        </div>
      </motion.div>
    </div>
  )
}
