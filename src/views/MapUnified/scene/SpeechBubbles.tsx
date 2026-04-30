import { useRef, memo } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { Bubble } from "../hooks/useSpeechBubbles"
import type { Pos } from "../hooks/useForceLayout"

interface SpeechBubblesProps {
  bubbles: Bubble[]
  positionsRef: React.MutableRefObject<Map<string, Pos>>
}

// ── Single floating emoji bubble ──────────────────────────────────────────────
function BubbleInstance({
  bubble,
  positionsRef,
}: {
  bubble: Bubble
  positionsRef: React.MutableRefObject<Map<string, Pos>>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const divRef   = useRef<HTMLDivElement>(null)

  useFrame(() => {
    const pos = positionsRef.current.get(bubble.personId)
    if (!pos || !groupRef.current) return

    const elapsed = Date.now() - bubble.createdAt
    const t = Math.min(1, elapsed / bubble.duration)

    // Float upward: 1.9 → 3.2 world units
    groupRef.current.position.set(
      pos.x + bubble.offsetX,
      1.9 + t * 1.3,
      pos.z,
    )

    // Opacity: pop in (0→1 first 15%), hold, fade out (0→1 last 28%)
    let opacity = 1
    if (t < 0.15)      opacity = t / 0.15
    else if (t > 0.72) opacity = 1 - (t - 0.72) / 0.28

    // Scale: pop in with slight overshoot
    const scale = t < 0.12
      ? 0.4 + 1.05 * (t / 0.12)       // 0.4 → 1.45
      : t < 0.22
        ? 1.45 - 0.45 * ((t - 0.12) / 0.10)  // 1.45 → 1.0 settle
        : 1.0

    if (divRef.current) {
      divRef.current.style.opacity = String(opacity)
      divRef.current.style.transform = `scale(${scale})`
    }
  })

  return (
    <group ref={groupRef}>
      <Html center distanceFactor={6} style={{ pointerEvents: "none" }}>
        <div ref={divRef} className="emoji-bubble">
          {bubble.emoji}
        </div>
      </Html>
    </group>
  )
}

// Memoize by bubble id — a bubble never mutates after creation
const MemoBubble = memo(BubbleInstance, (a, b) => a.bubble.id === b.bubble.id)

// ── Container rendered inside the R3F scene ───────────────────────────────────
export default function SpeechBubbles({ bubbles, positionsRef }: SpeechBubblesProps) {
  return (
    <>
      {bubbles.map(b => (
        <MemoBubble key={b.id} bubble={b} positionsRef={positionsRef} />
      ))}
    </>
  )
}
