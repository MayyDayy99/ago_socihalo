import { useEffect, useMemo, useState } from "react"
import * as d3 from "d3"
import { X, Users, GitMerge, Route, EyeOff, ShieldOff, SlidersHorizontal } from "lucide-react"
import { useAppStore } from "../../store/useAppStore"
import { usePeople } from "../../hooks/usePeople"
import { useConnections } from "../../hooks/useConnections"
import {
  useMergeSessions, useMergeView, useComputeMatches, useMyIdentity,
  useSetMergeShareLevel, useRevokeMerge,
} from "../../hooks/useMerge"
import type { MergeView as MergeViewData, ShareLevel } from "../../lib/merge-types"
import { SHARE_LEVELS } from "../../lib/merge-types"
import { GROUPS } from "../../lib/constants"
import { Button } from "../../components/ui/Button"
import { Select } from "../../components/ui/Select"
import { toast } from "../../components/ui/Toast"
import MergeReview from "./MergeReview"

const COLOR = { own: "#3B82F6", both: "#7C3AED", partner: "#D97706" } as const
type MKind = keyof typeof COLOR

export default function MergeView() {
  const sessionId = useAppStore(s => s.activeMergeSessionId)
  const setActiveMergeSessionId = useAppStore(s => s.setActiveMergeSessionId)
  const close = () => setActiveMergeSessionId(null)

  const { uid } = useMyIdentity()
  const { data: sessions = [] } = useMergeSessions()
  const session = sessions.find(s => s.id === sessionId)
  const { data: view, isLoading, isError } = useMergeView(sessionId)
  const computeMatches = useComputeMatches()
  const [reviewOpen, setReviewOpen] = useState(false)

  // Kick off identity matching once when entering an active session.
  useEffect(() => {
    if (sessionId && session?.status === "active") computeMatches.mutate(sessionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.status])

  // Auto-exit if the session is no longer active (revoked/expired/declined via realtime).
  useEffect(() => {
    if (sessionId && session && session.status !== "active") {
      toast.info("A megosztás lezárult.")
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status])

  if (!sessionId) return null
  const myRole: "initiator" | "partner" = session?.initiator_id === uid ? "initiator" : "partner"

  return (
    <div className="fixed inset-0 z-40 flex bg-app">
      <div className="flex-1 relative min-w-0">
        {isLoading && <Centered>Merge nézet betöltése…</Centered>}
        {isError && <Centered>Nem sikerült betölteni a merge nézetet.</Centered>}
        {view && <MergeGraph view={view} />}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-surface/90 backdrop-blur border border-border rounded-lg px-3 py-1.5 text-sm">
          <GitMerge size={14} className="text-accent" />
          <span className="text-text font-medium">Hálók összefésülve</span>
        </div>
        <Legend />
      </div>

      <MergePanel
        view={view}
        partnerLabel={session ? (myRole === "initiator" ? session.partner_email : "a partnered") : "partner"}
        myLevel={session ? (myRole === "initiator" ? session.initiator_share_level : (session.partner_share_level ?? "standard")) : "standard"}
        expiresAt={session?.expires_at}
        onReview={() => setReviewOpen(true)}
        onClose={close}
      />

      {reviewOpen && sessionId && (
        <MergeReview sessionId={sessionId} myRole={myRole} onClose={() => setReviewOpen(false)} />
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">{children}</div>
}

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-surface/90 backdrop-blur border border-border rounded-lg px-3 py-1.5 text-xs">
      <Dot c={COLOR.own} l="csak te" />
      <Dot c={COLOR.both} l="közös" />
      <Dot c={COLOR.partner} l="csak ő (elérhető)" />
    </div>
  )
}
function Dot({ c, l }: { c: string; l: string }) {
  return <span className="inline-flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>
}

// ── Combined force graph (static layout, fit-to-view) ────────────────────────
interface GNode { id: string; name: string; group: string | null; kind: MKind }
interface GLink { source: string; target: string; kind: "own" | "partner" }

function MergeGraph({ view }: { view: MergeViewData }) {
  const { data: ownPeople = [] } = usePeople()
  const { data: ownConnections = [] } = useConnections()
  const [pos, setPos] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [hover, setHover] = useState<string | null>(null)

  const { nodes, links } = useMemo(() => {
    const mineSet = new Set(view.identity_pairs.map(p => p.mine))
    const theirsToMine = new Map(view.identity_pairs.map(p => [p.theirs, p.mine]))
    const nodes: GNode[] = []
    const ids = new Set<string>()
    for (const p of ownPeople) {
      if (p.archived) continue
      nodes.push({ id: p.id, name: p.display_name, group: p.group_key, kind: mineSet.has(p.id) ? "both" : "own" })
      ids.add(p.id)
    }
    for (const pp of view.partner_people) {
      if (pp.in_overlap) continue
      const id = "p:" + pp.id
      nodes.push({ id, name: pp.display_name, group: pp.group_key, kind: "partner" })
      ids.add(id)
    }
    const links: GLink[] = []
    for (const c of ownConnections) {
      if (ids.has(c.from_id) && ids.has(c.to_id)) links.push({ source: c.from_id, target: c.to_id, kind: "own" })
    }
    const remap = (pid: string) => theirsToMine.get(pid) ?? "p:" + pid
    for (const c of view.partner_connections) {
      const s = remap(c.from_id), t = remap(c.to_id)
      if (ids.has(s) && ids.has(t) && s !== t) links.push({ source: s, target: t, kind: "partner" })
    }
    return { nodes, links }
  }, [ownPeople, ownConnections, view])

  useEffect(() => {
    if (nodes.length === 0) { setPos(new Map()); return }
    type SNode = GNode & d3.SimulationNodeDatum
    const simNodes: SNode[] = nodes.map(n => ({ ...n }))
    const idToNode = new Map(simNodes.map(n => [n.id, n]))
    const simLinks: d3.SimulationLinkDatum<SNode>[] = links
      .map(l => ({ source: idToNode.get(l.source), target: idToNode.get(l.target) }))
      .filter((l): l is { source: SNode; target: SNode } => !!l.source && !!l.target)
    const s = d3.forceSimulation<SNode>(simNodes)
      .force("link", d3.forceLink<SNode, d3.SimulationLinkDatum<SNode>>(simLinks).id(d => d.id).distance(62).strength(0.3))
      .force("charge", d3.forceManyBody<SNode>().strength(-190))
      .force("collide", d3.forceCollide<SNode>(26))
      .force("center", d3.forceCenter(0, 0))
      .stop()
    for (let i = 0; i < 320; i++) s.tick()
    setPos(new Map(simNodes.map(n => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])))
  }, [nodes, links])

  const box = useMemo(() => {
    if (pos.size === 0) return { x: -200, y: -150, w: 400, h: 300 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    pos.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) })
    const pad = 60
    return { x: minX - pad, y: minY - pad, w: Math.max(1, maxX - minX) + pad * 2, h: Math.max(1, maxY - minY) + pad * 2 }
  }, [pos])

  if (nodes.length === 0) {
    return <Centered>Nincs megjeleníthető átfedés — futtasd az egyeztetést a jobb panelen.</Centered>
  }

  const neighbors = new Set<string>()
  if (hover) { neighbors.add(hover); links.forEach(l => { if (l.source === hover) neighbors.add(l.target); if (l.target === hover) neighbors.add(l.source) }) }

  return (
    <svg width="100%" height="100%" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet" className="block">
      {links.map((l, i) => {
        const a = pos.get(l.source), b = pos.get(l.target)
        if (!a || !b) return null
        const dim = hover !== null && !(neighbors.has(l.source) && neighbors.has(l.target))
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={l.kind === "partner" ? COLOR.partner : "#94A3B8"}
            strokeWidth={l.kind === "partner" ? 1.4 : 1}
            strokeDasharray={l.kind === "partner" ? "4,3" : undefined}
            style={{ strokeOpacity: dim ? 0.06 : l.kind === "partner" ? 0.5 : 0.35, transition: "stroke-opacity 160ms ease" }} />
        )
      })}
      {nodes.map(n => {
        const p = pos.get(n.id)
        if (!p) return null
        const g = n.group ? GROUPS[n.group as keyof typeof GROUPS] : null
        const r = n.kind === "partner" ? 12 : 15
        const dim = hover !== null && !neighbors.has(n.id)
        const first = n.name.split(/\s+/)[0]
        return (
          <g key={n.id} transform={`translate(${p.x},${p.y})`}
            style={{ opacity: dim ? 0.2 : 1, transition: "opacity 160ms ease", cursor: "pointer" }}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
            <circle r={r} fill={COLOR[n.kind]} />
            <circle r={r} fill="none" stroke={g?.color ?? "#fff"} strokeWidth={2.5} strokeOpacity={0.35} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.5} fontWeight={700} fill="white"
              style={{ pointerEvents: "none", userSelect: "none" }}>
              {first.length > 6 ? first.slice(0, 5) + "…" : first}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Insights / controls panel ────────────────────────────────────────────────
function MergePanel({
  view, partnerLabel, myLevel, expiresAt, onReview, onClose,
}: {
  view: MergeViewData | undefined
  partnerLabel: string
  myLevel: ShareLevel
  expiresAt?: string
  onReview: () => void
  onClose: () => void
}) {
  const sessionId = useAppStore(s => s.activeMergeSessionId)!
  const { data: ownPeople = [] } = usePeople()
  const setLevel = useSetMergeShareLevel()
  const revoke = useRevokeMerge()

  const ownById = useMemo(() => new Map(ownPeople.map(p => [p.id, p])), [ownPeople])
  const partnerById = useMemo(() => new Map((view?.partner_people ?? []).map(p => [p.id, p])), [view])

  const overlap = view?.identity_pairs.length ?? 0
  const bridges = (view?.partner_people ?? []).filter(p => !p.in_overlap)
  const hidden = view?.hidden_partner_count ?? 0

  const diffs = useMemo(() => {
    if (!view) return []
    return view.identity_pairs.map(pair => {
      const mine = ownById.get(pair.mine)
      const theirs = partnerById.get(pair.theirs)
      if (!mine || !theirs || theirs.strength == null) return null
      const d = Math.abs(mine.strength - theirs.strength)
      return d >= 2 ? { name: mine.display_name, mine: mine.strength, theirs: theirs.strength, d } : null
    }).filter((x): x is { name: string; mine: number; theirs: number; d: number } => !!x)
      .sort((a, b) => b.d - a.d).slice(0, 5)
  }, [view, ownById, partnerById])

  const expiresIn = useMemo(() => {
    if (!expiresAt) return null
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) return "lejárt"
    const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
    return h > 0 ? `${h} óra ${m} perc` : `${m} perc`
  }, [expiresAt])

  // Only downgrade options (<= current level).
  const levelOptions = SHARE_LEVELS
    .filter(l => ["minimum", "match_only", "standard", "full"].indexOf(l.value) <= ["minimum", "match_only", "standard", "full"].indexOf(myLevel))
    .map(l => ({ value: l.value, label: l.label }))

  return (
    <aside className="w-[340px] flex-shrink-0 bg-surface border-l border-border-strong flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <p className="text-text font-semibold text-sm truncate">↔ {partnerLabel}</p>
          {expiresIn && <p className="text-muted text-xs mt-0.5">Lejár: {expiresIn}</p>}
        </div>
        <button onClick={onClose} className="text-muted hover:text-text p-1" aria-label="Kilépés"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <Stat icon={<Users size={14} />} label="Átfedés" value={overlap} sub="közös ismerős" />

        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted uppercase tracking-wider mb-1.5"><Route size={12} /> Hidak — elérhető rajta keresztül</div>
          {bridges.length === 0 ? (
            <p className="text-muted text-sm">Nincs új elérhető személy ezen a szinten.</p>
          ) : (
            <div className="space-y-1">
              {bridges.slice(0, 8).map(b => (
                <div key={b.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLOR.partner }} />
                  <span className="text-text truncate">{b.display_name}</span>
                </div>
              ))}
              {bridges.length > 8 && <p className="text-xs text-muted">+{bridges.length - 8} további</p>}
            </div>
          )}
        </div>

        {diffs.length > 0 && (
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1.5">Erősség-eltérések</div>
            <div className="space-y-1">
              {diffs.map(d => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="text-text truncate">{d.name}</span>
                  <span className="text-muted text-xs flex-shrink-0">te ★{d.mine} · ő ★{d.theirs}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted bg-surface-2 rounded-lg px-3 py-2">
          <EyeOff size={14} className="flex-shrink-0" />
          <span>Rejtve: <span className="text-text">{hidden}</span> nem-kapcsolódó személy</span>
        </div>

        <Button variant="secondary" size="sm" onClick={onReview} className="w-full justify-center">
          <GitMerge size={13} /> Azonosságok egyeztetése
        </Button>
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-muted flex-shrink-0" />
          <Select
            label=""
            options={levelOptions}
            value={myLevel}
            onChange={e => setLevel.mutate({ sessionId, level: e.target.value as ShareLevel })}
          />
        </div>
        <p className="text-[11px] text-muted">A megosztási szint közben csak csökkenthető.</p>
        <Button variant="danger" size="sm" onClick={() => { revoke.mutate(sessionId); onClose() }} className="w-full justify-center">
          <ShieldOff size={13} /> Megosztás felbontása
        </Button>
      </div>
    </aside>
  )
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted uppercase tracking-wider mb-1">{icon} {label}</div>
      <p className="text-2xl font-bold text-text leading-none">{value}</p>
      <p className="text-xs text-muted mt-1">{sub}</p>
    </div>
  )
}
