import type { Person } from "../store/types"
import { GROUPS, ROLES } from "../lib/constants"

interface NodeProps {
  person: Person
  x: number
  y: number
  radius: number
  isSelected: boolean
  isDimmed: boolean
  isPathHighlighted: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onMouseDown: (e: React.MouseEvent) => void
}

export default function Node({
  person, x, y, radius, isSelected, isDimmed, isPathHighlighted,
  onClick, onMouseEnter, onMouseLeave, onMouseDown
}: NodeProps) {
  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const roleColor  = ROLES[person.role_key]?.color
  const hasRole    = person.role_key !== "none"

  const opacity = isDimmed ? 0.18 : 1

  const ringColor = isSelected
    ? "#111827"
    : isPathHighlighted
    ? "#D97706"
    : hasRole
    ? roleColor
    : groupColor

  const ringWidth = isSelected ? 2.5 : isPathHighlighted ? 2 : hasRole ? 2 : 1.5

  const initials = person.display_name
    .split(" ")
    .map(w => w[0])
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
      {/* Selection halo */}
      {isSelected && (
        <circle r={radius + 8} fill={groupColor} opacity={0.12} />
      )}
      {/* Outer glow when path-highlighted */}
      {isPathHighlighted && !isSelected && (
        <circle r={radius + 5} fill="#D97706" opacity={0.18} />
      )}

      {/* Main fill — white with group color border */}
      <circle
        r={radius}
        fill="#FFFFFF"
        stroke={groupColor}
        strokeWidth={1}
        fillOpacity={1}
      />
      {/* Color wash — the group color as a soft tint */}
      <circle
        r={radius}
        fill={groupColor}
        fillOpacity={0.12}
      />
      {/* Role / selection ring */}
      <circle
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={ringWidth}
        strokeOpacity={isSelected || isPathHighlighted ? 1 : 0.9}
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

      {/* Name label below node */}
      <text
        y={radius + 12}
        textAnchor="middle"
        fontSize="10"
        fill={isDimmed ? "#9CA3AF" : "#374151"}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {person.display_name.length > 15
          ? person.display_name.slice(0, 14) + "…"
          : person.display_name}
      </text>
    </g>
  )
}
