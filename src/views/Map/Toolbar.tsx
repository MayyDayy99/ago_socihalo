import { Search, UserPlus, Link2, X, RotateCcw } from "lucide-react"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../../components/ui/Button"
import { GROUPS, ROLES } from "../../lib/constants"
import type { GroupKey, RoleKey } from "../../lib/constants"

export default function Toolbar() {
  const {
    filters, setFilter, resetFilters,
    connectMode, setConnectMode, connectFromId,
    setCreatePersonOpen,
    setPathHighlight, pathHighlight,
  } = useAppStore()

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    filters.groups.length +
    filters.roles.length +
    (filters.strengthMin > 1 ? 1 : 0) +
    (filters.showArchived ? 1 : 0)

  function toggleGroup(key: GroupKey) {
    const next = filters.groups.includes(key)
      ? filters.groups.filter(g => g !== key)
      : [...filters.groups, key]
    setFilter("groups", next)
  }

  function toggleRole(key: RoleKey) {
    const next = filters.roles.includes(key)
      ? filters.roles.filter(r => r !== key)
      : [...filters.roles, key]
    setFilter("roles", next)
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
      {/* Search bar */}
      <div className="flex items-center gap-2 bg-surface/95 backdrop-blur border border-border rounded-lg px-3 py-1.5 shadow-xl">
        <Search size={13} className="text-muted flex-shrink-0" />
        <input
          value={filters.search}
          onChange={e => setFilter("search", e.target.value)}
          placeholder="Keresés..."
          className="bg-transparent text-sm text-text placeholder-muted focus:outline-none w-44 font-mono"
        />
        {filters.search && (
          <button onClick={() => setFilter("search", "")} className="text-muted hover:text-white">
            <X size={12} />
          </button>
        )}
        <div className="w-px h-4 bg-border mx-1" />
        <Button size="sm" variant="ghost" onClick={() => setCreatePersonOpen(true)} title="Új személy">
          <UserPlus size={13} />
        </Button>
        <Button
          size="sm"
          variant={connectMode ? "primary" : "ghost"}
          onClick={() => { setConnectMode(!connectMode); }}
          title={connectMode ? "Kapcsolat mód ki" : "Kapcsolat mód be"}
        >
          <Link2 size={13} />
          {connectMode && <span className="text-xs">{connectFromId ? "→ kattints" : "kattints"}</span>}
        </Button>
        {pathHighlight && (
          <Button size="sm" variant="ghost" onClick={() => setPathHighlight(null)} title="Útvonal törlése">
            <RotateCcw size={13} />
          </Button>
        )}
        {activeFilterCount > 0 && (
          <button onClick={resetFilters} className="text-xs text-muted hover:text-text flex items-center gap-1">
            <X size={11} /> {activeFilterCount}
          </button>
        )}
      </div>

      {/* Group filter chips */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {Object.entries(GROUPS).map(([key, g]) => {
          const active = filters.groups.includes(key as GroupKey)
          return (
            <button
              key={key}
              onClick={() => toggleGroup(key as GroupKey)}
              style={active ? { background: g.color + "33", borderColor: g.color, color: g.color } : undefined}
              className={`px-2 py-0.5 rounded-full text-xs border font-mono transition-colors
                ${active ? "" : "border-border text-muted hover:border-text/30 hover:text-text"}`}
            >
              {g.icon} {g.label}
            </button>
          )
        })}
        {Object.entries(ROLES).filter(([k]) => k !== "none").map(([key, r]) => {
          const active = filters.roles.includes(key as RoleKey)
          return (
            <button
              key={key}
              onClick={() => toggleRole(key as RoleKey)}
              style={active ? { background: r.color + "33", borderColor: r.color, color: r.color } : undefined}
              className={`px-2 py-0.5 rounded-full text-xs border font-mono transition-colors
                ${active ? "" : "border-border text-muted hover:border-text/30 hover:text-text"}`}
            >
              {r.badge} {r.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
