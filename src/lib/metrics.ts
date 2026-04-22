import type { Person, Connection } from "../store/types"

export interface NetworkMetrics {
  degreeMap: Map<string, number>
  betweennessMap: Map<string, number>
  density: number
  groupCounts: Map<string, number>
  topConnectors: Array<{ person: Person; degree: number }>
  topBridges: Array<{ person: Person; score: number }>
}

export function computeMetrics(people: Person[], connections: Connection[]): NetworkMetrics {
  const degree = new Map<string, number>()
  people.forEach(p => degree.set(p.id, 0))
  connections.forEach(c => {
    degree.set(c.from_id, (degree.get(c.from_id) ?? 0) + 1)
    degree.set(c.to_id,   (degree.get(c.to_id)   ?? 0) + 1)
  })

  const betweenness = brandesBetweenness(people, connections)

  const n = people.length
  const density = n > 1 ? (2 * connections.length) / (n * (n - 1)) : 0

  const groupCounts = new Map<string, number>()
  people.forEach(p => {
    const k = p.group_key ?? "other"
    groupCounts.set(k, (groupCounts.get(k) ?? 0) + 1)
  })

  const topConnectors = [...people]
    .map(p => ({ person: p, degree: degree.get(p.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10)

  const topBridges = [...people]
    .map(p => ({ person: p, score: betweenness.get(p.id) ?? 0 }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return { degreeMap: degree, betweennessMap: betweenness, density, groupCounts, topConnectors, topBridges }
}

export function shortestPath(fromId: string, toId: string, connections: Connection[]): string[] | null {
  const adj = buildAdjacency(connections)
  const visited = new Set<string>([fromId])
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]

  while (queue.length) {
    const { id, path } = queue.shift()!
    if (id === toId) return path
    for (const next of (adj.get(id) ?? [])) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({ id: next, path: [...path, next] })
      }
    }
  }
  return null
}

function brandesBetweenness(people: Person[], connections: Connection[]): Map<string, number> {
  const betweenness = new Map<string, number>(people.map(p => [p.id, 0]))
  const adj = buildAdjacency(connections)

  for (const s of people) {
    const stack: string[] = []
    const pred = new Map<string, string[]>(people.map(p => [p.id, []]))
    const sigma = new Map<string, number>(people.map(p => [p.id, 0]))
    sigma.set(s.id, 1)
    const dist = new Map<string, number>(people.map(p => [p.id, -1]))
    dist.set(s.id, 0)
    const queue: string[] = [s.id]

    while (queue.length) {
      const v = queue.shift()!
      stack.push(v)
      for (const w of (adj.get(v) ?? [])) {
        if (dist.get(w) === -1) {
          queue.push(w)
          dist.set(w, dist.get(v)! + 1)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!)
          pred.get(w)!.push(v)
        }
      }
    }

    const delta = new Map<string, number>(people.map(p => [p.id, 0]))
    while (stack.length) {
      const w = stack.pop()!
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!))
      }
      if (w !== s.id) {
        betweenness.set(w, betweenness.get(w)! + delta.get(w)!)
      }
    }
  }

  const n = people.length
  if (n > 2) {
    const norm = 2 / ((n - 1) * (n - 2))
    for (const [id, val] of betweenness) {
      betweenness.set(id, val * norm)
    }
  }

  return betweenness
}

export function buildAdjacency(connections: Connection[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const c of connections) {
    if (!adj.has(c.from_id)) adj.set(c.from_id, [])
    if (!adj.has(c.to_id))   adj.set(c.to_id, [])
    adj.get(c.from_id)!.push(c.to_id)
    adj.get(c.to_id)!.push(c.from_id)
  }
  return adj
}
