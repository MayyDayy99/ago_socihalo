import { memo } from "react"
import type { Person } from "../store/types"
import { GROUPS, ROLES } from "../lib/constants"

interface NodeProps {
  person: Person
  x: number
  y: number
  radius: number
  isSelected: boolean
  isConnectSource: boolean
  isDimmed: boolean
  isPathHighlighted: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onMouseDown: (e: React.MouseEvent) => void
}

function NodeImpl({
  person, x, y, radius,
  isSelected, isConnectSource, isDimmed, isPathHighlighted,
  onClick, onMouseEnter, onMouseLeave, onMouseDown,
}: NodeProps) {
  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const roleColor  = ROLES[person.role_key]?.color
  const hasRole    = person.role_key !== "none"

  const opacity = isDimmed ? 0.22 : 1

  const ringColor = isConnectSource
    ? "#D97706"
    : isSelected
    ? "#111827"
    : isPathHighlighted
    ? "#D97706"
    : hasRole
    ? roleColor
    : groupColor

  const ringWidth = isConnectSource ? 3 : isSelected ? 2.5 : isPathHighlighted ? 2 : hasRole ? 2 : 1.5

  const initials = person.display_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ opacity, cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      {/* Connect source halo — pulsing ring */}
      {isConnectSource && (
        <>
          <circle r={radius + 10} fill="#D97706" opacity={0.10}>
            <animate attributeName="r" values={`${radius + 8};${radius + 14};${radius + 8}`} dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.06;0.18;0.06" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {/* Selection halo */}
      {isSelected && !isConnectSource && (
        <circle r={radius + 7} fill={groupColor} opacity={0.14} />
      )}
      {/* Path highlight glow */}
      {isPathHighlighted && !isSelected && !isConnectSource && (
        <circle r={radius + 5} fill="#D97706" opacity={0.18} />
      )}

      {/* Main fill — white with group color border */}
      <circle r={radius} fill="#FFFFFF" stroke={groupColor} strokeWidth={1} />
      {/* Color wash */}
      <circle r={radius} fill={groupColor} fillOpacity={0.12} />
      {/* Role / selection ring */}
      <circle
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={ringWidth}
        strokeOpacity={isSelected || isPathHighlighted || isConnectSource ? 1 : 0.9}
      />

      {/* Initials */}
      {radius > 8 && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.max(7, radius * 0.58)}
          fill={groupColor}
          fontWeight="600"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {initials}
        </text>
      )}

      {/* Name label */}
      <text
        y={radius + 12}
        textAnchor="middle"
        fontSize="10"
        fill={isDimmed ? "#9CA3AF" : "#374151"}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {person.display_name.length > 18 ? person.display_name.slice(0, 17) + "…" : person.display_name}
      </text>
    </g>
  )
}

export default memo(NodeImpl, (prev, next) =>
  prev.x === next.x &&
  prev.y === next.y &&
  prev.radius === next.radius &&
  prev.isSelected === next.isSelected &&
  prev.isConnectSource === next.isConnectSource &&
  prev.isDimmed === next.isDimmed &&
  prev.isPathHighlighted === next.isPathHighlighted &&
  prev.person === next.person &&
  prev.onClick === next.onClick &&
  prev.onMouseDown === next.onMouseDown
)
