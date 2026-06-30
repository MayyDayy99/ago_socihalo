import { useRef, memo } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"
import type { Connection } from "../../../store/types"
import { CONNECTION_COLORS } from "../../../lib/constants"
import type { Pos } from "../hooks/useForceLayout"
import type { ModeTween } from "../hooks/useModeTween"
import { tickTween } from "../hooks/useModeTween"

interface EdgeProps {
  connection: Connection
  positionsRef: React.MutableRefObject<Map<string, Pos>>
  modeTween: ModeTween
  isDimmed: boolean
  isPathHighlighted: boolean
  isAdjacentToSelected: boolean
}

const POINTS = 28
const HEAD_HEIGHT = 0.92  // matches PersonAvatar head Y position

function EdgeImpl({ connection, positionsRef, modeTween, isDimmed, isPathHighlighted, isAdjacentToSelected }: EdgeProps) {
  // drei's <Line> wraps Line2 (LineGeometry). Its positions must be set via
  // setPositions(Float32Array) — BufferGeometry.setFromPoints is a no-op here, which is why
  // the edges previously never tracked node movement. Use a flat buffer like Map3DView does.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null)
  // Pre-allocated points array we mutate each frame
  const pointsRef = useRef<THREE.Vector3[]>(
    Array.from({ length: POINTS }, () => new THREE.Vector3())
  )
  const posBuf = useRef<Float32Array>(new Float32Array(POINTS * 3))
  const tmpA = useRef(new THREE.Vector3())
  const tmpB = useRef(new THREE.Vector3())
  const tmpMid = useRef(new THREE.Vector3())
  const curveRef = useRef(new THREE.QuadraticBezierCurve3())

  const color = isPathHighlighted ? "#D97706"
              : connection.type ? (CONNECTION_COLORS[connection.type] ?? "#9CA3AF")
              : "#D1D5DB"
  const isBridge = connection.type === "bridge"

  useFrame(() => {
    const from = positionsRef.current.get(connection.from_id)
    const to   = positionsRef.current.get(connection.to_id)
    if (!from || !to) return

    const progress = tickTween(modeTween, performance.now())

    // Endpoints are at head height (y=HEAD_HEIGHT). In 2D mode the line lies near the floor (y near 0).
    // Lerp endpoint Y by progress so 2D = flat-on-floor (matches the SVG line aesthetic) and 3D = head-to-head beam.
    const yEnd = HEAD_HEIGHT * progress + 0.05  // tiny floor lift to avoid z-fighting in 2D
    tmpA.current.set(from.x, yEnd, from.z)
    tmpB.current.set(to.x, yEnd, to.z)

    // Midpoint arch height also tweens with mode (flat in 2D, arched in 3D)
    tmpMid.current.copy(tmpA.current).lerp(tmpB.current, 0.5)
    const dist = tmpA.current.distanceTo(tmpB.current)
    const archHeight = 0.45 * progress + Math.max(0.08, dist * 0.18) * progress
    tmpMid.current.y += archHeight

    curveRef.current.v0 = tmpA.current
    curveRef.current.v1 = tmpMid.current
    curveRef.current.v2 = tmpB.current

    // Sample the curve into our pre-allocated point + flat buffers
    const pts = pointsRef.current
    const buf = posBuf.current
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1)
      const p = curveRef.current.getPoint(t, pts[i])
      buf[i * 3] = p.x; buf[i * 3 + 1] = p.y; buf[i * 3 + 2] = p.z
    }

    // Push into the LineGeometry via setPositions (the only method that actually updates it)
    const line = lineRef.current
    if (line && line.geometry) {
      line.geometry.setPositions(buf)
      line.computeLineDistances?.()
      line.geometry.computeBoundingSphere?.()
    }
  })

  const opacity = isDimmed ? 0.06 : isAdjacentToSelected || isPathHighlighted ? 0.95 : 0.4
  const lineWidth = isAdjacentToSelected || isPathHighlighted
    ? Math.max(1.6, (connection.strength ?? 3) * 0.6)
    : 1

  return (
    <Line
      ref={lineRef as never}
      points={pointsRef.current}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      dashed={isBridge || (connection.strength ?? 3) <= 2}
      dashSize={0.12}
      gapSize={0.08}
    />
  )
}

export default memo(EdgeImpl, (prev, next) =>
  prev.connection === next.connection &&
  prev.isDimmed === next.isDimmed &&
  prev.isPathHighlighted === next.isPathHighlighted &&
  prev.isAdjacentToSelected === next.isAdjacentToSelected
)
