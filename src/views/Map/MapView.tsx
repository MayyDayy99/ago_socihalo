import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import * as d3 from "d3"
import { usePeople, useUpdatePerson } from "../../hooks/usePeople"
import { useConnections, useCreateConnection } from "../../hooks/useConnections"
import { useAppStore } from "../../store/useAppStore"
import { useMetrics } from "../../hooks/useMetrics"
import type { Person, Connection } from "../../store/types"
import Node from "../../components/Node"
import Edge from "../../components/Edge"
import Legend from "./Legend"
import Toolbar from "./Toolbar"
import MiniMap from "./MiniMap"
import ConnectionDialog from "../../components/ConnectionDialog"
import ConnectModeBanner from "./ConnectModeBanner"
import { Button } from "../../components/ui/Button"
import { toast } from "../../components/ui/Toast"
import { UserPlus } from "lucide-react"

type SimNode = Person & d3.SimulationNodeDatum
type SimLink = d3.SimulationLinkDatum<SimNode> & { data: Connection }

const MIN_R = 5, MAX_R = 18

export default function MapView() {
  const { data: people = [], isLoading: peopleLoading } = usePeople()
  const { data: connections = [] } = useConnections()
  const updatePerson  = useUpdatePerson()
  const createConn    = useCreateConnection()
  const metrics       = useMetrics(people, connections)

  const {
    selectedPersonId, setSelectedPersonId,
    filters, connectMode, connectFromId, setConnectFromId, setConnectMode,
    pathHighlight,
    setCreatePersonOpen, setActiveView,
  } = useAppStore()

  const svgRef      = useRef<SVGSVGElement>(null)
  const gRef        = useRef<SVGGElement>(null)
  const simRef      = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const nodesRef    = useRef<SimNode[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const [tick, setTick]     = useState(0)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [size, setSize]     = useState({ w: 800, h: 600 })
  const [pendingConn, setPendingConn] = useState<{ fromId: string; toId: string } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null)
  const tickRafRef = useRef<number | null>(null)
  const transformRafRef = useRef<number | null>(null)

  // Container size — observe parent
  useEffect(() => {
    if (!svgRef.current) return
    const parent = svgRef.current.parentElement
    if (!parent) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  // Filter people
  const filteredPeople = useMemo(() => {
    return people.filter(p => {
      if (!filters.showArchived && p.archived) return false
      if (filters.groups.length && !filters.groups.includes(p.group_key!)) return false
      if (filters.roles.length && !filters.roles.includes(p.role_key)) return false
      if (p.strength < filters.strengthMin) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!p.display_name.toLowerCase().includes(q) &&
            !p.emails.some(e => e.toLowerCase().includes(q)) &&
            !p.tags.some(t => t.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [people, filters])

  const filteredIds = useMemo(() => new Set(filteredPeople.map(p => p.id)), [filteredPeople])

  const filteredConnections = useMemo(
    () => connections.filter(c => filteredIds.has(c.from_id) && filteredIds.has(c.to_id)),
    [connections, filteredIds]
  )

  // D3 simulation — RAF-throttled state ticks (no flicker)
  useEffect(() => {
    const nodeMap = new Map<string, SimNode>()
    filteredPeople.forEach(p => {
      const existing = nodesRef.current.find(n => n.id === p.id)
      const node: SimNode = { ...p, x: existing?.x, y: existing?.y, vx: existing?.vx, vy: existing?.vy }
      if (p.pinned_x !== null && p.pinned_y !== null) {
        node.fx = p.pinned_x; node.fy = p.pinned_y
        if (existing?.x === undefined) { node.x = p.pinned_x; node.y = p.pinned_y }
      }
      nodeMap.set(p.id, node)
    })
    const nodeList = [...nodeMap.values()]
    nodesRef.current = nodeList

    const linkList: SimLink[] = filteredConnections
      .filter(c => nodeMap.has(c.from_id) && nodeMap.has(c.to_id))
      .map(c => ({ source: nodeMap.get(c.from_id)!, target: nodeMap.get(c.to_id)!, data: c }))

    simRef.current?.stop()

    const sim = d3.forceSimulation<SimNode>(nodeList)
      .alpha(0.6)
      .alphaDecay(0.04)
      .force("link", d3.forceLink<SimNode, SimLink>(linkList).id(d => d.id).distance(90).strength(0.4))
      .force("charge", d3.forceManyBody<SimNode>().strength(-220))
      .force("collide", d3.forceCollide<SimNode>(28))
      .force("center", d3.forceCenter(0, 0))
      .on("tick", () => {
        nodesRef.current = sim.nodes()
        if (tickRafRef.current !== null) return
        tickRafRef.current = requestAnimationFrame(() => {
          tickRafRef.current = null
          setTick(t => t + 1)
        })
      })

    simRef.current = sim
    return () => {
      sim.stop()
      if (tickRafRef.current !== null) cancelAnimationFrame(tickRafRef.current)
      tickRafRef.current = null
    }
  }, [filteredPeople, filteredConnections])

  // D3 zoom — direct DOM updates only (React never touches the <g> transform).
  // This eliminates flicker AND fixes wheel-zoom-on-cursor (which only works
  // if there is no extra transform offset competing with d3's math).
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .filter(event => {
        // Allow wheel always, only allow drag pan on empty background (not on a node)
        if (event.type === "wheel") return true
        const target = event.target as Element
        return !target.closest("[data-node-id]")
      })
      .on("start", () => setIsPanning(true))
      .on("zoom", (e) => {
        transformRef.current = { x: e.transform.x, y: e.transform.y, k: e.transform.k }
        // Direct DOM update — React never reconciles this attribute
        gRef.current?.setAttribute(
          "transform",
          `translate(${e.transform.x},${e.transform.y}) scale(${e.transform.k})`
        )
        // Throttled React state for MiniMap viewport indicator
        if (transformRafRef.current !== null) return
        transformRafRef.current = requestAnimationFrame(() => {
          transformRafRef.current = null
          setTransform(transformRef.current)
        })
      })
      .on("end", () => setIsPanning(false))
    svg.call(zoom)

    // Center the initial view on the SVG's center — this becomes d3's
    // "identity translate", so all subsequent zoom math (including
    // wheel-zoom-from-cursor-position) works correctly with no extra offset.
    const w = svgEl.clientWidth || 800
    const h = svgEl.clientHeight || 600
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2))

    return () => {
      svg.on(".zoom", null)
      if (transformRafRef.current !== null) cancelAnimationFrame(transformRafRef.current)
      transformRafRef.current = null
    }
  }, [])

  // Node radius scaled by degree
  const maxDegree = useMemo(
    () => Math.max(1, ...filteredPeople.map(p => metrics.degreeMap.get(p.id) ?? 0)),
    [filteredPeople, metrics.degreeMap]
  )
  const nodeRadius = useCallback(
    (id: string) => {
      const d = metrics.degreeMap.get(id) ?? 0
      return MIN_R + (MAX_R - MIN_R) * (d / maxDegree)
    },
    [metrics.degreeMap, maxDegree]
  )

  // Hover neighborhood
  const neighborSet = useMemo(() => {
    if (!hoveredId) return null
    const s = new Set<string>([hoveredId])
    filteredConnections.forEach(c => {
      if (c.from_id === hoveredId) s.add(c.to_id)
      if (c.to_id === hoveredId) s.add(c.from_id)
    })
    return s
  }, [hoveredId, filteredConnections])

  const pathSet = useMemo(() => pathHighlight ? new Set(pathHighlight) : null, [pathHighlight])

  // ── Click + drag handlers ──────────────────────────────
  const handleNodeClick = useCallback((person: Person) => {
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(person.id)
      } else if (connectFromId !== person.id) {
        setPendingConn({ fromId: connectFromId, toId: person.id })
      } else {
        // clicked the source again — cancel
        setConnectFromId(null)
        setConnectMode(false)
      }
    } else {
      setSelectedPersonId(person.id)
    }
  }, [connectMode, connectFromId, setConnectFromId, setConnectMode, setSelectedPersonId])

  const handleNodePointerDown = useCallback((e: React.PointerEvent, person: Person) => {
    if (e.shiftKey) {
      e.stopPropagation()
      setConnectFromId(person.id)
      setConnectMode(true)
      return
    }
    if (connectMode) return
    e.stopPropagation()

    const isTouch = e.pointerType === "touch"
    // Touch: long-press (~400ms) before drag engages, so a tap remains a tap.
    // Mouse / pen: drag engages immediately on movement.
    const longPressMs = isTouch ? 400 : 0
    const moveThreshold = isTouch ? 8 : 2
    let dragActive = !isTouch
    let startFx = 0, startFy = 0
    let pinnedThisGesture = false

    dragRef.current = { id: person.id, sx: e.clientX, sy: e.clientY, moved: false }

    function pinNow() {
      if (pinnedThisGesture) return
      const n = nodesRef.current.find(x => x.id === person.id)
      if (!n) return
      startFx = n.x ?? 0
      startFy = n.y ?? 0
      n.fx = startFx
      n.fy = startFy
      pinnedThisGesture = true
    }

    let longPressTimer: number | null = null
    if (isTouch) {
      setPressedId(person.id)
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null
        dragActive = true
        pinNow()
        navigator.vibrate?.(15)
      }, longPressMs)
    }

    function cancelLongPress() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    function onMove(me: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = (me.clientX - drag.sx) / transformRef.current.k
      const dy = (me.clientY - drag.sy) / transformRef.current.k
      const dist = Math.hypot(dx, dy)
      if (dist > moveThreshold) drag.moved = true
      // Touch + movement before long-press fires → user is panning, abort drag attempt
      if (isTouch && !dragActive && drag.moved) {
        cancelLongPress()
        cleanup()
        return
      }
      if (!dragActive) return
      if (!pinnedThisGesture) pinNow()
      const n = nodesRef.current.find(x => x.id === drag.id)
      if (!n) return
      n.fx = startFx + dx
      n.fy = startFy + dy
      simRef.current?.alpha(0.15).restart()
    }

    function onUp() {
      cancelLongPress()
      const drag = dragRef.current
      if (drag && drag.moved && dragActive && pinnedThisGesture) {
        const n = nodesRef.current.find(x => x.id === drag.id)
        if (n && n.fx !== undefined && n.fx !== null) {
          updatePerson.mutate({ id: drag.id, pinned_x: n.fx, pinned_y: n.fy ?? null })
        }
      }
      cleanup()
    }

    function cleanup() {
      dragRef.current = null
      setPressedId(null)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }, [connectMode, setConnectFromId, setConnectMode, updatePerson])

  // ── ESC cancels connect mode ──────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pendingConn) { setPendingConn(null); return }
        if (connectMode) {
          setConnectMode(false)
          setConnectFromId(null)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [connectMode, pendingConn, setConnectMode, setConnectFromId])

  // Position lookup — only recomputed when sim ticks (RAF-throttled)
  const nodePositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    nodesRef.current.forEach(n => m.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 }))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, filteredPeople.length])

  const cursor = connectMode
    ? "crosshair"
    : isPanning ? "grabbing" : "grab"

  const showLoading = peopleLoading
  const showEmpty   = !peopleLoading && people.length === 0

  return (
    <div className="relative w-full h-full bg-app map-canvas overflow-hidden">
      <Toolbar />

      {/* Connect mode banner — slides in from top under the toolbar */}
      <ConnectModeBanner
        active={connectMode}
        sourceName={connectFromId ? people.find(p => p.id === connectFromId)?.display_name ?? null : null}
        onCancel={() => { setConnectMode(false); setConnectFromId(null) }}
      />

      {/* SVG is ALWAYS rendered so the d3.zoom useEffect can attach on mount.
          Loading/empty states are overlays on top. */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="block"
        style={{ cursor, touchAction: "none" }}
      >
        {/* Background capture rect — anchors d3 zoom on empty space */}
        <rect width="100%" height="100%" fill="white" fillOpacity={0} pointerEvents="all" />

        {/* Transform is owned imperatively by d3.zoom — never set via JSX */}
        <g ref={gRef}>
          {/* Edges */}
          {filteredConnections.map(c => {
            const from = nodePositions.get(c.from_id)
            const to   = nodePositions.get(c.to_id)
            if (!from || !to) return null
            const inPath = pathSet
              ? (pathSet.has(c.from_id) && pathSet.has(c.to_id))
              : false
            const dimmed = hoveredId !== null && neighborSet
              ? (!neighborSet.has(c.from_id) || !neighborSet.has(c.to_id))
              : false
            return (
              <Edge
                key={c.id}
                connection={c}
                fromX={from.x} fromY={from.y}
                toX={to.x}     toY={to.y}
                isDimmed={dimmed}
                isPathHighlighted={inPath}
              />
            )
          })}

          {/* Nodes — wrapped in data-attr group so zoom filter can detect node clicks */}
          {nodesRef.current.map(n => {
            const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 }
            const isSel = selectedPersonId === n.id
            const isSrc = connectFromId === n.id
            // Drop-target preview: in connect mode, hovering a node that is
            // not the source — visual cue to "click here to link"
            const isDrop = connectMode && !!connectFromId && hoveredId === n.id && connectFromId !== n.id
            // Don't dim the connect source — it must stay visible while picking the target
            const dimmed = hoveredId !== null && neighborSet && !isSrc
              ? !neighborSet.has(n.id)
              : false
            const inPath = pathSet?.has(n.id) ?? false
            return (
              <g key={n.id} data-node-id={n.id}>
                <Node
                  person={n}
                  x={pos.x} y={pos.y}
                  radius={nodeRadius(n.id)}
                  isSelected={isSel}
                  isConnectSource={isSrc}
                  isDropTarget={isDrop}
                  isPressed={pressedId === n.id}
                  isDimmed={dimmed}
                  isPathHighlighted={inPath}
                  onClick={() => handleNodeClick(n)}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onPointerDown={(e) => handleNodePointerDown(e, n)}
                />
              </g>
            )
          })}
        </g>
      </svg>

      {!showLoading && !showEmpty && (
        <>
          <Legend />
          <MiniMap
            nodes={nodesRef.current}
            transform={transform}
            width={size.w}
            height={size.h}
          />

          {/* Stats footer — bottom center, between Legend (left) and MiniMap (right) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted bg-surface/85 backdrop-blur border border-border rounded px-2.5 py-1 pointer-events-none">
            {filteredPeople.length} személy · {filteredConnections.length} kapcsolat
            {filteredPeople.length !== people.length && (
              <span className="ml-1 text-accent">(szűrve)</span>
            )}
          </div>
        </>
      )}

      {/* Loading overlay */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-app/80 backdrop-blur-sm pointer-events-none z-30">
          <div className="text-center">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted text-sm">Hálózat betöltése…</p>
          </div>
        </div>
      )}

      {/* Empty overlay — clickable, sits over the (still-attached) SVG */}
      {showEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-30">
          <span className="text-4xl mb-4 opacity-30 select-none">⬡</span>
          <p className="text-text font-medium mb-1">Üres hálózat</p>
          <p className="text-muted text-sm mb-5 max-w-xs">
            Adj hozzá személyeket, vagy importálj névjegyeket egy meglévő forrásból.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => setCreatePersonOpen(true)}>
              <UserPlus size={13} /> Új személy
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setActiveView("import")}>
              Importálás
            </Button>
          </div>
        </div>
      )}

      {pendingConn && (
        <ConnectionDialog
          fromId={pendingConn.fromId}
          toId={pendingConn.toId}
          people={people}
          onConfirm={async (type, strength, context) => {
            try {
              await createConn.mutateAsync({ from_id: pendingConn.fromId, to_id: pendingConn.toId, type, strength, context })
              toast.success("Kapcsolat létrejött")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Hiba a mentésnél")
            }
            setPendingConn(null)
            setConnectFromId(null)
            setConnectMode(false)
          }}
          onCancel={() => {
            setPendingConn(null)
            setConnectFromId(null)
          }}
        />
      )}
    </div>
  )
}
