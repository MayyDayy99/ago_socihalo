import { useRef, useMemo, memo } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Float, Html, Text } from "@react-three/drei"
import * as THREE from "three"
import type { Person } from "../../../store/types"
import { GROUPS } from "../../../lib/constants"
import type { Pos } from "../hooks/useForceLayout"
import type { ModeTween } from "../hooks/useModeTween"
import { tickTween } from "../hooks/useModeTween"
import { idHash } from "./constants"

// Per-frame Three.js refs we mutate directly (bypassing React reconciliation):
// position group, body part materials (opacity), head ring (opacity + scale), name label DOM node.

interface AvatarProps {
  person: Person
  positionsRef: React.MutableRefObject<Map<string, Pos>>
  modeTween: ModeTween
  isSelected: boolean
  isConnectSource: boolean
  isDropTarget: boolean
  isPathHighlighted: boolean
  isDimmed: boolean
  isPressed: boolean
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?:  (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?:   (e: ThreeEvent<PointerEvent>) => void
  onClick?:        (e: ThreeEvent<MouseEvent>)   => void
}

function AvatarImpl({
  person,
  positionsRef,
  modeTween,
  isSelected,
  isConnectSource,
  isDropTarget,
  isPathHighlighted,
  isDimmed,
  isPressed,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onClick,
}: AvatarProps) {
  const rootRef = useRef<THREE.Group>(null)
  const bobRef  = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const headRef = useRef<THREE.Mesh>(null)
  // Body parts whose opacity should fade in with mode progress
  const bodyMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([])
  const ringMatRef  = useRef<THREE.MeshBasicMaterial | null>(null)

  const h = useMemo(() => idHash(person.id), [person.id])
  const isFemale = h > 0.5
  const walkPhase = h * Math.PI * 2

  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const skin = "#f0c2a4"
  const bodyColor = isFemale ? "#d986ff" : "#62b8ff"

  const ringColor = isConnectSource ? "#D97706"
                  : isDropTarget    ? "#059669"
                  : isPathHighlighted ? "#D97706"
                  : isSelected ? "#111827"
                  : groupColor

  // useFrame: read positionsRef + modeProgress and apply to Three.js objects directly
  useFrame(({ clock }) => {
    const root = rootRef.current
    if (!root) return

    // Position from d3-force
    const pos = positionsRef.current.get(person.id)
    if (pos) {
      root.position.x = pos.x
      root.position.z = pos.z
    }

    // Bob/sway
    const t = clock.getElapsedTime()
    if (bobRef.current) {
      bobRef.current.position.y = Math.sin(t * 2.25 + walkPhase) * 0.045
      bobRef.current.rotation.y = Math.sin(t * 1.15 + walkPhase) * 0.035
    }

    // Mode-driven channels
    const progress = tickTween(modeTween, performance.now())
    const targetBodyOpacity = (isDimmed ? 0.28 : 1) * progress
    const targetRingOpacity = isConnectSource ? 0.85
                            : isDropTarget    ? 0.85
                            : isSelected || isPathHighlighted ? 0.7
                            : (0.85 - 0.5 * progress) * (isDimmed ? 0.4 : 1)

    // Head: subtle scale-up in 2D so it reads as "the node circle"
    if (headRef.current) {
      const headScale = 1.0 + 0.18 * (1 - progress)
      headRef.current.scale.setScalar(headScale)
    }

    // Body part materials
    for (const m of bodyMatRefs.current) {
      if (m) { m.opacity = targetBodyOpacity; m.transparent = true }
    }

    // Floor ring
    if (ringMatRef.current) {
      ringMatRef.current.opacity = targetRingOpacity
      ringMatRef.current.color.set(ringColor)
    }

    // Pressed pulse — subtle ring scale
    if (ringRef.current) {
      const pressedScale = isPressed ? 1.15 : 1.0
      ringRef.current.scale.setScalar(pressedScale)
    }
  })

  // Register body material on mount; cleared on unmount automatically by ref reset
  function registerBodyMat(idx: number) {
    return (m: THREE.MeshStandardMaterial | null) => {
      bodyMatRefs.current[idx] = m
    }
  }

  return (
    <group
      ref={rootRef}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <Float speed={1.2} rotationIntensity={0.05} floatIntensity={isSelected || isConnectSource ? 0.18 : 0.05}>
        <group ref={bobRef}>
          {/* Floor ring under person — stays visible in 2D as the "node circle" backdrop */}
          <mesh ref={ringRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.66, 64]} />
            <meshBasicMaterial ref={(m) => { ringMatRef.current = m as THREE.MeshBasicMaterial }} color={ringColor} transparent opacity={0.6} />
          </mesh>

          {/* Larger invisible hit-target so touch works at 2D zoom-out */}
          <mesh position={[0, 0.5, 0]} visible={false}>
            <cylinderGeometry args={[0.7, 0.7, 1.4, 16]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          {/* Torso (fades with mode progress) */}
          <mesh position={[0, 0.3, 0]} scale={[0.22, 0.55, 0.18]}>
            <capsuleGeometry args={[1, 1.25, 8, 18]} />
            <meshStandardMaterial ref={registerBodyMat(0)} color={bodyColor} roughness={0.38} metalness={0.05} transparent opacity={0} />
          </mesh>

          {/* Arms */}
          <mesh position={[-0.34, 0.66, 0]} rotation={[0, 0, isSelected ? -0.32 : -0.12]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(1)} color={bodyColor} roughness={0.42} transparent opacity={0} />
          </mesh>
          <mesh position={[0.34, 0.66, 0]} rotation={[0, 0, isSelected ? 0.32 : 0.12]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(2)} color={bodyColor} roughness={0.42} transparent opacity={0} />
          </mesh>

          {/* Legs */}
          <mesh position={[-0.13, -0.3, 0]} rotation={[0, 0, Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(3)} color="#2b344e" roughness={0.5} transparent opacity={0} />
          </mesh>
          <mesh position={[0.13, -0.3, 0]} rotation={[0, 0, -Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(4)} color="#2b344e" roughness={0.5} transparent opacity={0} />
          </mesh>

          {/* Head — always visible. THIS is the "2D circle" identity. */}
          <mesh ref={headRef} position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.22, 32, 32]} />
            <meshStandardMaterial color={skin} roughness={0.46} />
          </mesh>

          {/* Hair */}
          {isFemale ? (
            <mesh position={[0, 1.14, -0.03]} scale={[1.18, 0.68, 1.04]}>
              <sphereGeometry args={[0.24, 32, 16]} />
              <meshStandardMaterial ref={registerBodyMat(5)} color="#312033" roughness={0.54} transparent opacity={0} />
            </mesh>
          ) : (
            <mesh position={[0, 1.23, -0.01]} scale={[1.05, 0.38, 0.96]}>
              <sphereGeometry args={[0.23, 32, 16]} />
              <meshStandardMaterial ref={registerBodyMat(5)} color="#252232" roughness={0.54} transparent opacity={0} />
            </mesh>
          )}

          {/* Group-color initials disc on top of head — only really visible from above (2D mode) */}
          <Text
            position={[0, 1.28, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.18}
            color={groupColor}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#ffffff"
          >
            {(person.display_name[0] ?? "?").toUpperCase()}
          </Text>

          {/* Name label */}
          <Html position={[0, 1.62, 0]} center distanceFactor={7.2} style={{ pointerEvents: "none" }}>
            <div className={`person3d-label ${isSelected ? "selected" : ""} ${isDimmed ? "dimmed" : ""} ${isConnectSource ? "source" : ""}`}>
              {person.display_name}
            </div>
          </Html>
        </group>
      </Float>
    </group>
  )
}

export default memo(AvatarImpl, (prev, next) =>
  prev.person === next.person &&
  prev.isSelected === next.isSelected &&
  prev.isConnectSource === next.isConnectSource &&
  prev.isDropTarget === next.isDropTarget &&
  prev.isPathHighlighted === next.isPathHighlighted &&
  prev.isDimmed === next.isDimmed &&
  prev.isPressed === next.isPressed &&
  prev.onClick === next.onClick &&
  prev.onPointerDown === next.onPointerDown
)
