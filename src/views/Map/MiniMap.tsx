import type { Person } from "../../store/types"
import { GROUPS } from "../../lib/constants"

interface MiniMapProps {
  nodes: Array<Person & { x?: number; y?: number }>
  transform: { x: number; y: number; k: number }
  width: number
  height: number
}

export default function MiniMap({ nodes, transform, width, height }: MiniMapProps) {
  const W = 120, H = 80
  if (!nodes.length) return null

  const xs = nodes.map(n => n.x ?? 0)
  const ys = nodes.map(n => n.y ?? 0)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const pad = 8

  function toMini(x: number, y: number) {
    return {
      mx: pad + ((x - minX) / rangeX) * (W - pad * 2),
      my: pad + ((y - minY) / rangeY) * (H - pad * 2),
    }
  }

  const vpX = (-transform.x / transform.k - minX) / rangeX * (W - pad * 2) + pad
  const vpY = (-transform.y / transform.k - minY) / rangeY * (H - pad * 2) + pad
  const vpW = (width / transform.k) / rangeX * (W - pad * 2)
  const vpH = (height / transform.k) / rangeY * (H - pad * 2)

  return (
    <div className="absolute bottom-4 right-4 bg-surface/90 backdrop-blur border border-border rounded-lg overflow-hidden">
      <svg width={W} height={H}>
        {nodes.map(n => {
          const { mx, my } = toMini(n.x ?? 0, n.y ?? 0)
          const color = n.group_key ? GROUPS[n.group_key]?.color : "#9CA3AF"
          return <circle key={n.id} cx={mx} cy={my} r={2} fill={color ?? "#9CA3AF"} opacity={0.8} />
        })}
        <rect
          x={vpX} y={vpY}
          width={Math.max(4, vpW)} height={Math.max(4, vpH)}
          fill="none" stroke="#2563EB" strokeWidth={1} opacity={0.7}
        />
      </svg>
    </div>
  )
}
