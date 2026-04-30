import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import * as THREE from "three"
import type { Person } from "../../../store/types"
import type { GroupKey } from "../../../lib/constants"
import { GROUPS } from "../../../lib/constants"
import { GROUP_ZONES } from "./constants"
import type { ModeTween } from "../hooks/useModeTween"
import { tickTween } from "../hooks/useModeTween"

interface GroupZonesProps {
  people: Person[]
  modeTween: ModeTween
}

export default function GroupZones({ people, modeTween }: GroupZonesProps) {
  const matRefs = useRef<Map<GroupKey, THREE.MeshBasicMaterial>>(new Map())

  const counts = useMemo(() => {
    const m = new Map<GroupKey, number>()
    for (const p of people) {
      if (p.group_key) m.set(p.group_key, (m.get(p.group_key) ?? 0) + 1)
    }
    return m
  }, [people])

  useFrame(() => {
    const p = tickTween(modeTween, performance.now())
    // Zones more visible in 2D (they're the "regions"), subtle in 3D
    const opacity = 0.20 - 0.13 * p
    for (const m of matRefs.current.values()) {
      m.opacity = opacity
    }
  })

  return (
    <>
      {(Object.keys(GROUP_ZONES) as GroupKey[]).map(k => {
        const c = counts.get(k) ?? 0
        if (c === 0) return null
        const [cx, cz] = GROUP_ZONES[k].center
        const color = GROUPS[k].color
        const r = Math.min(2.0, 0.8 + c * 0.18)
        return (
          <group key={k}>
            <mesh position={[cx, 0.012, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[r, 64]} />
              <meshBasicMaterial
                ref={(m) => { if (m) matRefs.current.set(k, m as THREE.MeshBasicMaterial) }}
                color={color}
                transparent
                opacity={0.2}
              />
            </mesh>
            <Text
              position={[cx, 0.035, cz - r - 0.3]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              {GROUPS[k].label}
            </Text>
          </group>
        )
      })}
    </>
  )
}
