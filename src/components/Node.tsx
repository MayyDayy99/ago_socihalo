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
  isDropTarget: boolean
  isPressed: boolean
  isDimmed: boolean
  isPathHighlighted: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onPointerDown: (e: React.PointerEvent) => void
}

// "Person" glyph: a head circle floating above a body circle.
// The body's center is the logical (x,y) — connection lines anchor here.
function NodeImpl({
  person, x, y, radius,
  isSelected, isConnectSource, isDropTarget, isPressed, isDimmed, isPathHighlighted,
  onClick, onMouseEnter, onMouseLeave, onPointerDown,
}: NodeProps) {
  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const roleColor  = ROLES[person.role_key]?.color
  const hasRole    = person.role_key !== "none"

  const opacity = isDimmed ? 0.22 : 1

  // Body geometry
  const bodyR = radius
  // Head sits above the body, slightly overlapping
  const headR = Math.max(2.5, radius * 0.36)
  const headCY = -radius * 0.78

  // Outline color priority: connect-source > drop-target > selected > path > role > group
  const ringColor = isConnectSource
    ? "#D97706"
    : isDropTarget
    ? "#059669"
    : isSelected
    ? "#111827"
    : isPathHighlighted
    ? "#D97706"
    : hasRole
    ? roleColor
    : groupColor

  const ringWidth = isConnectSource || isDropTarget
    ? 3
    : isSelected ? 2.5 : isPathHighlighted ? 2 : hasRole ? 2 : 1.5

  const initials = person.display_name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  // Halo radius needs to also cover the head (which extends radius * 1.14 above center)
  const haloR = radius + 9

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ opacity, cursor: "pointer", touchAction: "none" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={onPointerDown}
    >
      {/* Connect-source pulsing halo (orange) */}
      {isConnectSource && (
        <circle r={haloR} fill="#D97706" opacity={0.10}>
          <animate attributeName="r" values={`${haloR};${haloR + 6};${haloR}`} dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.06;0.20;0.06" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Long-press shrinking halo — visual feedback while waiting for drag mode to engage */}
      {isPressed && !isConnectSource && !isDropTarget && (
        <circle r={haloR + 4} fill="none" stroke="#2563EB" strokeWidth={2} strokeOpacity={0.85}>
          <animate attributeName="r" values={`${haloR + 8};${haloR + 1}`} dur="0.4s" repeatCount="1" fill="freeze" />
          <animate attributeName="stroke-opacity" values="0.85;0.25" dur="0.4s" repeatCount="1" fill="freeze" />
        </circle>
      )}
      {/* Drop-target pulsing halo (green) — shows when in connect mode and you're hovering this node */}
      {isDropTarget && !isConnectSource && (
        <circle r={haloR} fill="#059669" opacity={0.12}>
          <animate attributeName="r" values={`${haloR};${haloR + 5};${haloR}`} dur="1.0s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.08;0.24;0.08" dur="1.0s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Selection halo */}
      {isSelected && !isConnectSource && !isDropTarget && (
        <circle r={haloR} fill={groupColor} opacity={0.14} />
      )}
      {/* Path-highlight glow */}
      {isPathHighlighted && !isSelected && !isConnectSource && !isDropTarget && (
        <circle r={haloR - 4} fill="#D97706" opacity={0.18} />
      )}

      {/* Hit-area for the whole figure (transparent — captures hover/click for both head and body) */}
      <circle r={haloR} fill="transparent" />

      {/* Head — small filled circle sitting above the body */}
      <circle
        cx={0}
        cy={headCY}
        r={headR}
        fill={groupColor}
        stroke="#FFFFFF"
        strokeWidth={1.25}
      />

      {/* Body — main shape that anchors edges */}
      <circle r={bodyR} fill="#FFFFFF" stroke={groupColor} strokeWidth={1} />
      {/* Group color wash inside body */}
      <circle r={bodyR} fill={groupColor} fillOpacity={0.12} />
      {/* Outer ring (selection / role / etc.) — overlays the body border */}
      <circle
        r={bodyR}
        fill="none"
        stroke={ringColor}
        strokeWidth={ringWidth}
        strokeOpacity={isSelected || isPathHighlighted || isConnectSource || isDropTarget ? 1 : 0.9}
      />

      {/* Initials inside body */}
      {radius > 7 && (
        <text
          y={1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.max(7, radius * 0.6)}
          fill={groupColor}
          fontWeight="600"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {initials}
        </text>
      )}

      {/* Name label below the figure */}
      <text
        y={bodyR + 12}
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
  prev.isDropTarget === next.isDropTarget &&
  prev.isPressed === next.isPressed &&
  prev.isDimmed === next.isDimmed &&
  prev.isPathHighlighted === next.isPathHighlighted &&
  prev.person === next.person &&
  prev.onClick === next.onClick &&
  prev.onPointerDown === next.onPointerDown
)
