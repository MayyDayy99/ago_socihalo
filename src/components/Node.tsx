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

function NodeImpl({
  person, x, y, radius,
  isSelected, isConnectSource, isDropTarget, isPressed, isDimmed, isPathHighlighted,
  onClick, onMouseEnter, onMouseLeave, onPointerDown,
}: NodeProps) {
  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#94A3B8" : "#94A3B8"
  const roleColor  = ROLES[person.role_key]?.color
  const hasRole    = person.role_key !== "none"

  const opacity = isDimmed ? 0.2 : 1
  const r       = radius
  const haloR   = r + 10

  // Ring: connect-source > drop-target > selected > path > role > group
  const ringColor = isConnectSource
    ? "#F59E0B"
    : isDropTarget
    ? "#10B981"
    : isSelected
    ? "#1E293B"
    : isPathHighlighted
    ? "#F59E0B"
    : hasRole
    ? roleColor
    : groupColor

  const ringWidth = isConnectSource || isDropTarget
    ? 3.5
    : isSelected || isPathHighlighted ? 3 : hasRole ? 2.5 : 2

  // First name, truncated to fit the circle
  const firstName  = person.display_name.split(/\s+/)[0]
  const maxChars   = Math.max(3, Math.floor(r / 4.0))
  const label      = firstName.length > maxChars ? firstName.slice(0, maxChars - 1) + "…" : firstName
  const fontSize   = Math.min(14, Math.max(9, r * 0.42))

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ opacity, cursor: "pointer", touchAction: "none" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={onPointerDown}
    >
      {/* Transparent hit-area */}
      <circle r={haloR} fill="transparent" />

      {/* Connect-source pulsing halo */}
      {isConnectSource && (
        <circle r={haloR} fill="#F59E0B" opacity={0.12}>
          <animate attributeName="r"       values={`${haloR};${haloR + 7};${haloR}`} dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.06;0.22;0.06"                   dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Long-press shrink halo */}
      {isPressed && !isConnectSource && !isDropTarget && (
        <circle r={haloR + 4} fill="none" stroke="#3B82F6" strokeWidth={2} strokeOpacity={0.85}>
          <animate attributeName="r"              values={`${haloR + 8};${haloR + 1}`} dur="0.4s" repeatCount="1" fill="freeze" />
          <animate attributeName="stroke-opacity" values="0.85;0.2"                    dur="0.4s" repeatCount="1" fill="freeze" />
        </circle>
      )}

      {/* Drop-target pulsing halo */}
      {isDropTarget && !isConnectSource && (
        <circle r={haloR} fill="#10B981" opacity={0.14}>
          <animate attributeName="r"       values={`${haloR};${haloR + 6};${haloR}`} dur="1.0s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.08;0.26;0.08"                   dur="1.0s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Selection soft glow */}
      {isSelected && !isConnectSource && !isDropTarget && (
        <circle r={haloR - 2} fill={groupColor} opacity={0.18} />
      )}

      {/* Path-highlight glow */}
      {isPathHighlighted && !isSelected && !isConnectSource && !isDropTarget && (
        <circle r={haloR - 3} fill="#F59E0B" opacity={0.20} />
      )}

      {/* Main circle — solid group-color fill */}
      <circle r={r} fill={groupColor} />

      {/* Subtle inner white ring for contrast against edges */}
      <circle r={r} fill="none" stroke="white" strokeWidth={2.5} strokeOpacity={0.35} />

      {/* Status / selection ring */}
      <circle
        r={r}
        fill="none"
        stroke={ringColor}
        strokeWidth={ringWidth}
        strokeOpacity={isSelected || isConnectSource || isDropTarget || isPathHighlighted ? 1 : 0.75}
      />

      {/* First name — white, bold */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="700"
        fill="white"
        style={{ pointerEvents: "none", userSelect: "none", letterSpacing: "-0.3px" }}
      >
        {label}
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
