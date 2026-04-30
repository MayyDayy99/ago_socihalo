import { useEffect, useRef } from "react"
import * as d3 from "d3"
import type { Person, Connection } from "../../../store/types"
import type { GroupKey } from "../../../lib/constants"
import { GROUP_ZONES, UNGROUPED_CENTER, WORLD_SCALE, idHash } from "../scene/constants"

export type Pos = { x: number; z: number }

// d3-force simulation runs in JS, writes positions into a ref.
// useFrame in the R3F scene reads this ref every frame and applies to mesh.position.
// React never re-renders per tick.
//
// Coordinates are stored in world units (already scaled by WORLD_SCALE), so the
// scene can read them directly without further conversion.

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  pinned?: boolean
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {}

export interface ForceLayoutResult {
  positionsRef: React.MutableRefObject<Map<string, Pos>>
  pinNode: (id: string, x: number, z: number) => void
  releaseNode: (id: string) => void
  /** Nudge the simulation when a node is dragged so it settles around the new pin. */
  reheat: (alpha?: number) => void
}

export function useForceLayout(people: Person[], connections: Connection[]): ForceLayoutResult {
  const positionsRef = useRef<Map<string, Pos>>(new Map())
  const simRef       = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const nodesRef     = useRef<SimNode[]>([])

  // Rebuild simulation whenever the person/connection set changes.
  useEffect(() => {
    // Build new node list, preserving previous (x, y) for ids that already existed
    const prevById = new Map(nodesRef.current.map(n => [n.id, n]))
    const nodeMap = new Map<string, SimNode>()
    for (const p of people) {
      const prev = prevById.get(p.id)
      const node: SimNode = {
        id: p.id,
        x: prev?.x,
        y: prev?.y,
        vx: prev?.vx,
        vy: prev?.vy,
      }
      // Honour DB-pinned position (in pixel scale; convert to internal sim units which are also pixels)
      if (p.pinned_x !== null && p.pinned_y !== null) {
        node.fx = p.pinned_x
        node.fy = p.pinned_y
        if (node.x === undefined) { node.x = p.pinned_x; node.y = p.pinned_y }
        node.pinned = true
      } else if (node.x === undefined) {
        // Initial seed: place near the group's zone (but in pixel scale)
        const groupKey = (p.group_key ?? "_none") as GroupKey | "_none"
        const center = groupKey === "_none" ? UNGROUPED_CENTER : GROUP_ZONES[groupKey].center
        const h = idHash(p.id)
        const angle = h * Math.PI * 2
        const r = 60 + h * 40
        node.x = (center[0] / WORLD_SCALE) + Math.cos(angle) * r
        node.y = (center[1] / WORLD_SCALE) + Math.sin(angle) * r
      }
      nodeMap.set(p.id, node)
    }
    const nodeList = [...nodeMap.values()]
    nodesRef.current = nodeList

    const linkList: SimLink[] = connections
      .filter(c => nodeMap.has(c.from_id) && nodeMap.has(c.to_id))
      .map(c => ({ source: nodeMap.get(c.from_id)!, target: nodeMap.get(c.to_id)! }))

    simRef.current?.stop()
    const sim = d3.forceSimulation<SimNode>(nodeList)
      .alpha(0.6)
      .alphaDecay(0.04)
      .force("link", d3.forceLink<SimNode, SimLink>(linkList).id(d => d.id).distance(90).strength(0.4))
      .force("charge", d3.forceManyBody<SimNode>().strength(-220))
      .force("collide", d3.forceCollide<SimNode>(28))
      .force("center", d3.forceCenter(0, 0))
      .on("tick", () => {
        // Write into world-unit positionsRef. No React state update.
        const m = positionsRef.current
        for (const n of nodesRef.current) {
          m.set(n.id, { x: (n.x ?? 0) * WORLD_SCALE, z: (n.y ?? 0) * WORLD_SCALE })
        }
      })

    simRef.current = sim
    return () => { sim.stop() }
  }, [people, connections])

  function pinNode(id: string, worldX: number, worldZ: number) {
    const n = nodesRef.current.find(x => x.id === id)
    if (!n) return
    n.fx = worldX / WORLD_SCALE
    n.fy = worldZ / WORLD_SCALE
    n.pinned = true
    positionsRef.current.set(id, { x: worldX, z: worldZ })
  }

  function releaseNode(id: string) {
    const n = nodesRef.current.find(x => x.id === id)
    if (!n) return
    n.fx = null
    n.fy = null
    n.pinned = false
  }

  function reheat(alpha = 0.15) {
    simRef.current?.alpha(alpha).restart()
  }

  return { positionsRef, pinNode, releaseNode, reheat }
}
