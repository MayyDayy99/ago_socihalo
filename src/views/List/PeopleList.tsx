import { useState, useMemo } from "react"
import { UserPlus, ArrowUpDown } from "lucide-react"
import { usePeople } from "../../hooks/usePeople"
import { useConnections } from "../../hooks/useConnections"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../../components/ui/Button"
import { SkeletonRow } from "../../components/ui/Skeleton"
import { EmptyState } from "../../components/ui/EmptyState"
import { GROUPS, ROLES } from "../../lib/constants"
import type { Person } from "../../store/types"

type SortKey = "display_name" | "group_key" | "role_key" | "strength" | "degree" | "last_contact"

export default function PeopleList() {
  const { data: people = [], isLoading } = usePeople()
  const { data: connections = [] } = useConnections()
  const { filters, selectedPersonId, setSelectedPersonId, setCreatePersonOpen, setActiveView } = useAppStore()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "display_name", dir: 1 })

  const degreeMap = useMemo(() => {
    const m = new Map<string, number>()
    people.forEach(p => m.set(p.id, 0))
    connections.forEach(c => {
      m.set(c.from_id, (m.get(c.from_id) ?? 0) + 1)
      m.set(c.to_id,   (m.get(c.to_id)   ?? 0) + 1)
    })
    return m
  }, [people, connections])

  const filtered = useMemo(() => {
    return people.filter(p => {
      if (!filters.showArchived && p.archived) return false
      if (filters.groups.length && !filters.groups.includes(p.group_key!)) return false
      if (filters.roles.length && !filters.roles.includes(p.role_key)) return false
      if (p.strength < filters.strengthMin) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!p.display_name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [people, filters])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number = ""
      let vb: string | number = ""
      switch (sort.key) {
        case "display_name":  va = a.display_name;       vb = b.display_name; break
        case "group_key":     va = a.group_key ?? "";    vb = b.group_key ?? ""; break
        case "role_key":      va = a.role_key;           vb = b.role_key; break
        case "strength":      va = a.strength;           vb = b.strength; break
        case "degree":        va = degreeMap.get(a.id) ?? 0; vb = degreeMap.get(b.id) ?? 0; break
        case "last_contact":  va = a.last_contact ?? ""; vb = b.last_contact ?? ""; break
      }
      if (va < vb) return -sort.dir
      if (va > vb) return sort.dir
      return 0
    })
  }, [filtered, sort, degreeMap])

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 })
  }

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="text-left text-xs text-muted uppercase tracking-wider px-3 py-2 cursor-pointer hover:text-text select-none"
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-1">
          {label}
          {sort.key === col && <ArrowUpDown size={10} className={sort.dir === 1 ? "" : "rotate-180"} />}
        </span>
      </th>
    )
  }

  return (
    <div className="h-full flex flex-col bg-app font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <span className="text-sm text-muted">{sorted.length} / {people.length} személy</span>
        <Button
          variant="primary" size="sm"
          onClick={() => setCreatePersonOpen(true)}
        >
          <UserPlus size={13} /> Új személy
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="👤"
            title={people.length === 0 ? "Még nincs senki a hálóban" : "Nincs találat"}
            sub={people.length === 0 ? "Add hozzá az első személyt, vagy importálj névjegyeket" : "Próbálj más keresési feltételt"}
            action={people.length === 0
              ? <Button variant="primary" size="sm" onClick={() => setCreatePersonOpen(true)}><UserPlus size={13} /> Személy hozzáadása</Button>
              : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <SortHeader col="display_name"  label="Név" />
                <SortHeader col="group_key"     label="Csoport" />
                <SortHeader col="role_key"      label="Szerep" />
                <SortHeader col="strength"      label="Erősség" />
                <SortHeader col="degree"        label="Kapcs." />
                <SortHeader col="last_contact"  label="Utolsó kont." />
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <PersonRow
                  key={p.id}
                  person={p}
                  degree={degreeMap.get(p.id) ?? 0}
                  isSelected={selectedPersonId === p.id}
                  onSelect={() => {
                    setSelectedPersonId(p.id)
                    setActiveView("map")
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function PersonRow({ person: p, degree, isSelected, onSelect }: { person: Person; degree: number; isSelected: boolean; onSelect: () => void }) {
  const group = p.group_key ? GROUPS[p.group_key] : null
  const role  = ROLES[p.role_key]
  return (
    <tr
      onClick={onSelect}
      className={`border-b border-border/30 cursor-pointer transition-colors hover:bg-surface
        ${isSelected ? "bg-surface-2" : ""}
        ${p.archived ? "opacity-40" : ""}
      `}
    >
      <td className="px-3 py-2 text-text font-medium font-serif">{p.display_name}</td>
      <td className="px-3 py-2">
        {group ? (
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: group.color + "22", color: group.color }}>
            {group.icon} {group.label}
          </span>
        ) : <span className="text-muted">—</span>}
      </td>
      <td className="px-3 py-2">
        {role.badge ? (
          <span className="text-xs" style={{ color: role.color }}>{role.badge} {role.label}</span>
        ) : <span className="text-muted">—</span>}
      </td>
      <td className="px-3 py-2 text-accent text-xs">{"★".repeat(p.strength)}{"☆".repeat(5 - p.strength)}</td>
      <td className="px-3 py-2 text-center text-muted">{degree}</td>
      <td className="px-3 py-2 text-muted text-xs">{p.last_contact ?? "—"}</td>
    </tr>
  )
}
