import { CONNECTION_COLORS } from "../lib/constants"
import type { Connection } from "../store/types"

interface EdgeProps {
  connection: Connection
  fromX: number
  fromY: number
  toX: number
  toY: number
  isDimmed: boolean
  isPathHighlighted: boolean
}

export default function Edge({ connection, fromX, fromY, toX, toY, isDimmed, isPathHighlighted }: EdgeProps) {
  const color = isPathHighlighted
    ? "#D97706"
    : connection.type
    ? (CONNECTION_COLORS[connection.type] ?? "#9CA3AF")
    : "#D1D5DB"

  const isBridge  = connection.type === "bridge"
  const opacity   = isDimmed ? 0.08 : isPathHighlighted ? 0.9 : 0.45
  const strokeW   = isPathHighlighted ? 2.5 : isBridge ? 1.5 : 1

  return (
    <line
      x1={fromX} y1={fromY}
      x2={toX}   y2={toY}
      stroke={color}
      strokeWidth={strokeW}
      strokeOpacity={opacity}
      strokeDasharray={isBridge ? "5,4" : undefined}
    />
  )
}
