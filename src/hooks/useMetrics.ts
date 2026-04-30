import { useMemo } from "react"
import { computeMetrics } from "../lib/metrics"
import type { Person, Connection } from "../store/types"

export function useMetrics(people: Person[], connections: Connection[]) {
  return useMemo(
    () => computeMetrics(people, connections),
    [people, connections]
  )
}
