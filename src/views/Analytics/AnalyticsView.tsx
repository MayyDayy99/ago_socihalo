import { useMemo } from "react"
import { usePeople } from "../../hooks/usePeople"
import { useConnections } from "../../hooks/useConnections"
import { useMetrics } from "../../hooks/useMetrics"
import { useAppStore } from "../../store/useAppStore"
import { GROUPS, ROLES } from "../../lib/constants"
import { SkeletonCard } from "../../components/ui/Skeleton"
import { EmptyState } from "../../components/ui/EmptyState"

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 shadow-card border-l-2 border-l-accent/50">
      <p className="text-xs text-muted uppercase tracking-widest mb-1.5">{label}</p>
      <p className="text-3xl font-bold text-text leading-none">{value}</p>
      {sub && <p className="text-xs text-muted mt-1.5 leading-relaxed">{sub}</p>}
    </div>
  )
}

export default function AnalyticsView() {
  const { data: people = [], isLoading } = usePeople()
  const { data: connections = [] } = useConnections()
  const { setSelectedPersonId, setActiveView } = useAppStore()

  const activePeople = useMemo(() => people.filter(p => !p.archived), [people])
  // Metrics must be computed over the SAME node set the UI reports on (active only),
  // otherwise density/averages mix an active denominator with archived-inclusive counts.
  const activeConnections = useMemo(() => {
    const activeIds = new Set(activePeople.map(p => p.id))
    return connections.filter(c => activeIds.has(c.from_id) && activeIds.has(c.to_id))
  }, [activePeople, connections])
  const metrics = useMetrics(activePeople, activeConnections)

  const groupDist = useMemo(() => {
    const total = activePeople.length || 1
    return Object.entries(GROUPS).map(([key, g]) => ({
      key, g,
      count: metrics.groupCounts.get(key) ?? 0,
      pct: Math.round(((metrics.groupCounts.get(key) ?? 0) / total) * 100),
    })).filter(x => x.count > 0).sort((a, b) => b.count - a.count)
  }, [metrics.groupCounts, activePeople.length])

  const roleDist = useMemo(() => {
    const m = new Map<string, number>()
    activePeople.forEach(p => m.set(p.role_key, (m.get(p.role_key) ?? 0) + 1))
    return Object.entries(ROLES)
      .map(([key, r]) => ({ key, r, count: m.get(key) ?? 0 }))
      .filter(x => x.count > 0 && x.key !== "none")
      .sort((a, b) => b.count - a.count)
  }, [activePeople])

  function jumpTo(id: string) {
    setSelectedPersonId(id)
    setActiveView("map")
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-app p-6">
        <div className="h-6 w-48 bg-surface-2 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
        </div>
      </div>
    )
  }

  if (activePeople.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Még nincs mit elemezni"
        sub="Add hozzá az első személyeket, hogy megjelenjenek a statisztikák"
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-app p-6">
      <h1 className="text-xl font-bold text-text mb-6">Hálózat elemzése</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Személyek" value={activePeople.length} sub={`${people.filter(p => p.archived).length} archivált`} />
        <StatCard label="Kapcsolatok" value={activeConnections.length} />
        <StatCard label="Sűrűség" value={(metrics.density * 100).toFixed(2) + "%"} sub="0% = izolált, 100% = teljesen összekapcsolt" />
        <StatCard label="Átl. kapcsolat" value={
          activePeople.length > 0
            ? (activeConnections.length * 2 / activePeople.length).toFixed(1)
            : "0"
        } sub="személyenként" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Top connectors */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-text mb-3">Top összekötők (legtöbb kapcsolat)</h2>
          <div className="space-y-2">
            {metrics.topConnectors.slice(0, 10).map(({ person, degree }, i) => (
              <div key={person.id} className="flex items-center gap-2">
                <span className="text-xs text-muted w-4 flex-shrink-0">{i + 1}.</span>
                <button
                  onClick={() => jumpTo(person.id)}
                  className="text-sm text-text hover:text-accent truncate flex-1 text-left"
                >
                  {person.display_name}
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="h-1.5 rounded-full bg-accent opacity-60"
                    style={{ width: `${Math.max(8, (degree / (metrics.topConnectors[0]?.degree || 1)) * 80)}px` }}
                  />
                  <span className="text-xs text-muted w-5 text-right">{degree}</span>
                </div>
              </div>
            ))}
            {metrics.topConnectors.length === 0 && (
              <p className="text-muted text-sm">Még nincs elegendő adat.</p>
            )}
          </div>
        </div>

        {/* Top bridges */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-text mb-3">Híd-személyek (betweenness)</h2>
          <div className="space-y-2">
            {metrics.topBridges.slice(0, 10).map(({ person, score }, i) => (
              <div key={person.id} className="flex items-center gap-2">
                <span className="text-xs text-muted w-4 flex-shrink-0">{i + 1}.</span>
                <button
                  onClick={() => jumpTo(person.id)}
                  className="text-sm text-text hover:text-accent truncate flex-1 text-left"
                >
                  {person.display_name}
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="h-1.5 rounded-full bg-yellow-400 opacity-60"
                    style={{ width: `${Math.max(8, (score / (metrics.topBridges[0]?.score || 1)) * 80)}px` }}
                  />
                  <span className="text-xs text-muted w-10 text-right">{(score * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
            {metrics.topBridges.length === 0 && (
              <p className="text-muted text-sm">Nincs elég adat a számításhoz.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Group distribution */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-text mb-3">Csoportok szerinti megoszlás</h2>
          <div className="space-y-2">
            {groupDist.map(({ key, g, count, pct }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: g.color }}>{g.icon} {g.label}</span>
                  <span className="text-muted">{count} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role distribution */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-sm font-bold text-text mb-3">Szerepek megoszlása</h2>
          {roleDist.length === 0 ? (
            <p className="text-muted text-sm">Még egyetlen személynek sincs szerepe beállítva.</p>
          ) : (
            <div className="space-y-2">
              {roleDist.map(({ key, r, count }) => (
                <div key={key} className="flex items-center gap-3">
                  <span style={{ color: r.color }} className="text-sm w-6 text-center">{r.badge}</span>
                  <span className="text-sm text-text/80 flex-1">{r.label}</span>
                  <span className="text-xs text-muted">{count} fő</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
