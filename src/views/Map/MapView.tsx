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
import { EmptyState } from "../../components/ui/EmptyState"
import { Button } from "../../components/ui/Button"
import { UserPlus } from "lucide-react"

type SimNode = Person & d3.SimulationNodeDatum
type SimLink = d3.SimulationLinkDatum<SimNode> & { data: Connection }

const MIN_R = 4, MAX_R = 18

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
  } = useAppStore()

  const svgRef      = useRef<SVGSVGElement>(null)
  const simRef      = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const nodesRef    = useRef<SimNode[]>([])
  const [tick, setTick]     = useState(0)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [size, setSize]     = useState({ w: 800, h: 600 })
  const [pendingConn, setPendingConn] = useState<{ fromId: string; toId: string } | null>(null)
  const dragRef = useRef<{ id: string; startX: number; startY: number } | null>(null)

  // Responsive container size
  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(svgRef.current.parentElement!)
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

  // D3 simulation
  useEffect(() => {
    const nodeMap = new Map<string, SimNode>()
    filteredPeople.forEach(p => {
      const existing = nodesRef.current.find(n => n.id === p.id)
      const node: SimNode = { ...p, x: existing?.x, y: existing?.y }
      if (p.pinned_x !== null && p.pinned_y !== null) {
        node.x = p.pinned_x; node.y = p.pinned_y
        node.fx = p.pinned_x; node.fy = p.pinned_y
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
      .force("link", d3.forceLink<SimNode, SimLink>(linkList).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody<SimNode>().strength(-180))
      .force("collide", d3.forceCollide<SimNode>(25))
      .force("center", d3.forceCenter(0, 0))
      .on("tick", () => {
        nodesRef.current = [...sim.nodes()]
        setTick(t => t + 1)
      })

    simRef.current = sim
    return () => { sim.stop() }
  }, [filteredPeople.length, filteredConnections.length, filteredPeople, filteredConnections])

  // D3 zoom
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .on("zoom", e => setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k }))
    svg.call(zoom)
    return () => { svg.on(".zoom", null) }
  }, [])

  // Node radius
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

  // Node mouse handlers
  function handleNodeClick(person: Person) {
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(person.id)
      } else if (connectFromId !== person.id) {
        setPendingConn({ fromId: connectFromId, toId: person.id })
        setConnectFromId(null)
        setConnectMode(false)
      }
    } else {
      setSelectedPersonId(selectedPersonId === person.id ? null : person.id)
    }
  }

  function handleNodeMouseDown(e: React.MouseEvent, person: Person) {
    if (e.shiftKey) {
      e.stopPropagation()
      setConnectFromId(person.id)
      setConnectMode(true)
      return
    }
    const node = nodesRef.current.find(n => n.id === person.id)
    if (!node) return
    dragRef.current = { id: person.id, startX: e.clientX, startY: e.clientY }

    function onMove(me: MouseEvent) {
      const n = nodesRef.current.find(x => x.id === person.id)
      if (!n) return
      n.fx = (n.fx ?? n.x ?? 0) + (me.clientX - (dragRef.current?.startX ?? me.clientX)) / transform.k
      n.fy = (n.fy ?? n.y ?? 0) + (me.clientY - (dragRef.current?.startY ?? me.clientY)) / transform.k
      dragRef.current = { id: person.id, startX: me.clientX, startY: me.clientY }
      simRef.current?.alpha(0.1).restart()
    }

    function onUp() {
      const n = nodesRef.current.find(x => x.id === person.id)
      if (n?.fx !== undefined && n.fx !== null) {
        updatePerson.mutate({ id: person.id, pinned_x: n.fx, pinned_y: n.fy ?? null })
      }
      dragRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const nodePositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    nodesRef.current.forEach(n => m.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 }))
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const cx = size.w / 2 + transform.x
  const cy = size.h / 2 + transform.y

  const { setCreatePersonOpen, setActiveView } = useAppStore()

  if (peopleLoading) {
    return (
      <div className="relative w-full h-full bg-app overflow-hidden flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted text-sm">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (people.length === 0) {
    return (
      <div className="relative w-full h-full bg-app overflow-hidden">
        <Toolbar />
        <EmptyState
          icon="⬡"
          title="Üres háló"
          sub="Add hozzá az első személyt, vagy importálj névjegyeket"
          action={
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => setCreatePersonOpen(true)}>
                <UserPlus size={13} /> Személy hozzáadása
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveView("import")}>
                Importálás
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-app map-canvas overflow-hidden">
      <Toolbar />

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="block"
        style={{ cursor: connectMode ? "crosshair" : "default" }}
      >
        <g transform={`translate(${cx},${cy}) scale(${transform.k})`}>
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

          {/* Nodes */}
          {nodesRef.current.map(n => {
            const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 }
            const dimmed = hoveredId !== null && neighborSet
              ? !neighborSet.has(n.id)
              : false
            const inPath = pathSet?.has(n.id) ?? false
            return (
              <Node
                key={n.id}
                person={n}
                x={pos.x} y={pos.y}
                radius={nodeRadius(n.id)}
                isSelected={selectedPersonId === n.id || connectFromId === n.id}
                isDimmed={dimmed}
                isPathHighlighted={inPath}
                onClick={() => handleNodeClick(n)}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onMouseDown={e => handleNodeMouseDown(e, n)}
              />
            )
          })}
        </g>
      </svg>

      <Legend />
      <MiniMap
        nodes={nodesRef.current}
        transform={transform}
        width={size.w}
        height={size.h}
      />

      {/* Node count */}
      <div className="absolute top-3 right-4 text-xs text-muted font-mono">
        {filteredPeople.length} személy · {filteredConnections.length} kapcsolat
      </div>

      {pendingConn && (
        <ConnectionDialog
          fromId={pendingConn.fromId}
          toId={pendingConn.toId}
          people={people}
          onConfirm={async (type, strength, context) => {
            await createConn.mutateAsync({ from_id: pendingConn.fromId, to_id: pendingConn.toId, type, strength, context })
            setPendingConn(null)
          }}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </div>
  )
}
