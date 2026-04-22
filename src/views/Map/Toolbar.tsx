import { Search, UserPlus, Link2, X, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../../components/ui/Button"
import { GROUPS, ROLES } from "../../lib/constants"
import type { GroupKey, RoleKey } from "../../lib/constants"

export default function Toolbar() {
  const {
    filters, setFilter, resetFilters,
    connectMode, setConnectMode, setConnectFromId,
    setCreatePersonOpen,
    setPathHighlight, pathHighlight,
  } = useAppStore()

  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount =
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

  function toggleConnect() {
    const next = !connectMode
    setConnectMode(next)
    if (!next) setConnectFromId(null)
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 w-auto max-w-[92vw]">
      {/* Main bar */}
      <div className="flex items-center gap-1 bg-surface border border-border-strong rounded-lg pl-2.5 pr-1.5 py-1 shadow-card">
        <Search size={13} className="text-muted flex-shrink-0" />
        <input
          value={filters.search}
          onChange={e => setFilter("search", e.target.value)}
          placeholder="Keresés név, e-mail, címke…"
          className="bg-transparent text-sm text-text placeholder-muted focus:outline-none w-52"
        />
        {filters.search && (
          <button
            onClick={() => setFilter("search", "")}
            className="text-muted hover:text-text p-1"
            aria-label="Keresés törlése"
            type="button"
          >
            <X size={12} />
          </button>
        )}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className={`flex items-center gap-1.5 px-2 h-7 rounded text-xs transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? "bg-surface-2 text-text"
              : "text-muted hover:text-text hover:bg-surface-2"
          }`}
          title="Szűrők"
          type="button"
        >
          <SlidersHorizontal size={12} />
          <span>Szűrők</span>
          {activeFilterCount > 0 && (
            <span className="bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>

        <Button size="sm" variant="ghost" onClick={() => setCreatePersonOpen(true)} title="Új személy">
          <UserPlus size={13} />
        </Button>

        <Button
          size="sm"
          variant={connectMode ? "primary" : "ghost"}
          onClick={toggleConnect}
          title={connectMode ? "Kilépés a kapcsolat módból" : "Kapcsolat létrehozása két személy között"}
        >
          <Link2 size={13} />
          {!connectMode && <span className="text-xs hidden sm:inline">Kapcsolat</span>}
        </Button>

        {pathHighlight && (
          <Button size="sm" variant="ghost" onClick={() => setPathHighlight(null)} title="Útvonal kiemelés törlése">
            <RotateCcw size={13} />
          </Button>
        )}
      </div>

      {/* Filters dropdown */}
      {filtersOpen && (
        <div className="bg-surface border border-border-strong rounded-lg p-3 shadow-card w-[420px] max-w-[92vw] space-y-3">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Csoport</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(GROUPS).map(([key, g]) => {
                const active = filters.groups.includes(key as GroupKey)
                return (
                  <button
                    key={key}
                    onClick={() => toggleGroup(key as GroupKey)}
                    style={active ? { background: g.color + "1A", borderColor: g.color, color: g.color } : undefined}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      active ? "" : "border-border-strong text-muted hover:text-text hover:border-text/40"
                    }`}
                    type="button"
                  >
                    {g.icon} {g.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Szerep</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ROLES).filter(([k]) => k !== "none").map(([key, r]) => {
                const active = filters.roles.includes(key as RoleKey)
                return (
                  <button
                    key={key}
                    onClick={() => toggleRole(key as RoleKey)}
                    style={active ? { background: r.color + "1A", borderColor: r.color, color: r.color } : undefined}
                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                      active ? "" : "border-border-strong text-muted hover:text-text hover:border-text/40"
                    }`}
                    type="button"
                  >
                    {r.badge} {r.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Min. erősség: {filters.strengthMin}</p>
              <input
                type="range"
                min={1}
                max={5}
                value={filters.strengthMin}
                onChange={e => setFilter("strengthMin", Number(e.target.value))}
                className="w-full"
                aria-label="Minimum kapcsolat-erősség"
                title="Minimum kapcsolat-erősség"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.showArchived}
                onChange={e => setFilter("showArchived", e.target.checked)}
                className="accent-accent"
              />
              Archivált
            </label>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-1 border-t border-border">
              <button onClick={resetFilters} className="text-xs text-muted hover:text-text" type="button">
                Szűrők törlése
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
