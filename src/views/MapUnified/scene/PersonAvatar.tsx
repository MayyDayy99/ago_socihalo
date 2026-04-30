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

// All animation is driven per-frame via refs — React never re-renders for animation.
// Channels: walk cycle (arms + legs), breathing (torso), head nod + look-around,
// body look-at toward conversation partner, random wave gesture, mode-tween opacity.

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Lerp angle along shortest arc, returns new current value */
function lerpAngle(current: number, target: number, alpha: number): number {
  let delta = ((target - current) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
  return current + delta * alpha
}

// ── Props ─────────────────────────────────────────────────────────────────────
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
  /** ID of person this avatar is currently talking to (for look-at + head nod). */
  talkingToId: string | null
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?:  (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?:   (e: ThreeEvent<PointerEvent>) => void
  onClick?:        (e: ThreeEvent<MouseEvent>)   => void
}

// ── Component ─────────────────────────────────────────────────────────────────
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
  talkingToId,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  onClick,
}: AvatarProps) {
  // ── Structural refs ────────────────────────────────────────────────────────
  const rootRef      = useRef<THREE.Group>(null)
  const bobRef       = useRef<THREE.Group>(null)
  const ringRef      = useRef<THREE.Mesh>(null)
  // Head group: pivot at neck height so nod/look rotate around the right point
  const headGroupRef = useRef<THREE.Group>(null)
  const headRef      = useRef<THREE.Mesh>(null)
  const torsoRef     = useRef<THREE.Mesh>(null)
  const leftArmRef   = useRef<THREE.Mesh>(null)
  const rightArmRef  = useRef<THREE.Mesh>(null)
  const leftLegRef   = useRef<THREE.Mesh>(null)
  const rightLegRef  = useRef<THREE.Mesh>(null)
  const bodyMatRefs  = useRef<Array<THREE.MeshStandardMaterial | null>>([])
  const ringMatRef   = useRef<THREE.MeshBasicMaterial | null>(null)

  // ── Per-avatar deterministic randomness ────────────────────────────────────
  const h         = useMemo(() => idHash(person.id), [person.id])
  const isFemale  = h > 0.5
  const walkPhase = h * Math.PI * 2
  /** Slight per-person speed variation so the crowd doesn't look copy-pasted. */
  const idleSpeed = 0.82 + h * 0.48   // range [0.82, 1.30]

  // ── Idle behavior clocks (staggered so people act at different moments) ────
  const nextWaveAt  = useRef(performance.now() + 5000  + h * 22000)
  const waveEndAt   = useRef(0)
  const nextLookAt  = useRef(performance.now() + 1200  + h * 7000)
  const lookTargetY = useRef(0)
  const lookEndAt   = useRef(0)

  // ── Visual constants ───────────────────────────────────────────────────────
  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const skin       = "#f0c2a4"
  const bodyColor  = isFemale ? "#d986ff" : "#62b8ff"

  const ringColor = isConnectSource   ? "#D97706"
                  : isDropTarget      ? "#059669"
                  : isPathHighlighted ? "#D97706"
                  : isSelected        ? "#111827"
                  : groupColor

  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const root = rootRef.current
    if (!root) return

    const now      = performance.now()
    const t        = clock.getElapsedTime()
    const progress = tickTween(modeTween, now)

    // ── d3-force position ──────────────────────────────────────────────────
    const pos = positionsRef.current.get(person.id)
    if (pos) {
      root.position.x = pos.x
      root.position.z = pos.z
    }

    // ── Walk cycle time ────────────────────────────────────────────────────
    const walkT   = t * idleSpeed * 2.5 + walkPhase
    const walkAmp = 0.33 * progress   // swing only visible in 3D

    // ── Wave gesture (random, only when 3D is visible) ────────────────────
    let isWaving = false
    if (progress > 0.5) {
      if (now >= nextWaveAt.current) {
        waveEndAt.current  = now + 1600
        nextWaveAt.current = now + 11000 + Math.random() * 24000
      }
      isWaving = now < waveEndAt.current
    }

    // ── Left arm ──────────────────────────────────────────────────────────
    if (leftArmRef.current) {
      if (isWaving) {
        // Wave: arm swings up and oscillates
        const wt = Math.min(1, (now - (waveEndAt.current - 1600)) / 1600)
        leftArmRef.current.rotation.x = -Math.PI * 0.65 + Math.sin(wt * Math.PI * 5) * 0.3
        leftArmRef.current.rotation.z = -0.25 * progress
      } else {
        leftArmRef.current.rotation.x = Math.sin(walkT) * walkAmp
        leftArmRef.current.rotation.z = -(isSelected ? 0.50 : 0.20) * progress - 0.08
      }
    }

    // ── Right arm ─────────────────────────────────────────────────────────
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -Math.sin(walkT) * walkAmp
      rightArmRef.current.rotation.z = (isSelected ? 0.50 : 0.20) * progress + 0.08
    }

    // ── Legs ──────────────────────────────────────────────────────────────
    const legSwing = Math.sin(walkT) * 0.26 * progress
    if (leftLegRef.current)  leftLegRef.current.rotation.x  = -legSwing
    if (rightLegRef.current) rightLegRef.current.rotation.x =  legSwing

    // ── Breathing: torso Y scale pulses gently ────────────────────────────
    if (torsoRef.current) {
      torsoRef.current.scale.y = 0.55 + Math.sin(t * 1.85 * idleSpeed + walkPhase) * 0.013 * progress
    }

    // ── Bob (vertical) ────────────────────────────────────────────────────
    const bobAmp = isSelected ? 0.082 : 0.048
    if (bobRef.current) {
      bobRef.current.position.y = Math.sin(walkT * 0.5) * bobAmp
    }

    // ── Body look-at: rotate toward conversation partner ──────────────────
    if (talkingToId && pos) {
      const theirPos = positionsRef.current.get(talkingToId)
      if (theirPos) {
        const angle = Math.atan2(theirPos.x - pos.x, theirPos.z - pos.z)
        root.rotation.y = lerpAngle(root.rotation.y, angle, 0.055)
      }
    } else {
      // Drift back to neutral when not talking
      root.rotation.y = lerpAngle(root.rotation.y, 0, 0.025)
    }

    // ── Bob sway (yaw, independent of look-at) ────────────────────────────
    if (bobRef.current) {
      bobRef.current.rotation.y = Math.sin(t * 1.15 * idleSpeed + walkPhase) * 0.038
    }

    // ── Head: nod + random look-around ────────────────────────────────────
    if (headGroupRef.current) {
      // Random look-around (Y rotation, small)
      if (now >= nextLookAt.current) {
        lookTargetY.current = (Math.random() - 0.5) * 0.72
        lookEndAt.current   = now + 800 + Math.random() * 600
        nextLookAt.current  = now + 2000 + Math.random() * 9000
      }
      const headTargetY = now < lookEndAt.current ? lookTargetY.current : 0
      headGroupRef.current.rotation.y += (headTargetY - headGroupRef.current.rotation.y) * 0.1

      // Nod (X rotation): gentle idle, stronger when talking
      const nodAmp = talkingToId ? 0.14 : 0.022
      headGroupRef.current.rotation.x = Math.sin(t * 3.8 * idleSpeed + walkPhase) * nodAmp
    }

    // ── Head scale: bigger in 2D so it reads as the node circle ──────────
    if (headRef.current) {
      headRef.current.scale.setScalar(1.0 + 0.18 * (1 - progress))
    }

    // ── Body part opacity (mode-tween) ────────────────────────────────────
    const targetBodyOpacity = (isDimmed ? 0.28 : 1) * progress
    for (const m of bodyMatRefs.current) {
      if (m) { m.opacity = targetBodyOpacity; m.transparent = true }
    }

    // ── Floor ring ────────────────────────────────────────────────────────
    const targetRingOpacity = isConnectSource ? 0.85
                            : isDropTarget    ? 0.85
                            : isSelected || isPathHighlighted ? 0.70
                            : (0.85 - 0.5 * progress) * (isDimmed ? 0.4 : 1)
    if (ringMatRef.current) {
      ringMatRef.current.opacity = targetRingOpacity
      ringMatRef.current.color.set(ringColor)
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(isPressed ? 1.15 : 1.0)
    }
  })

  function registerBodyMat(idx: number) {
    return (m: THREE.MeshStandardMaterial | null) => { bodyMatRefs.current[idx] = m }
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
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

          {/* Floor ring — always visible; acts as node circle in 2D */}
          <mesh ref={ringRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.66, 64]} />
            <meshBasicMaterial
              ref={(m) => { ringMatRef.current = m as THREE.MeshBasicMaterial }}
              color={ringColor} transparent opacity={0.6}
            />
          </mesh>

          {/* Invisible touch hit-target (wider than the figure) */}
          <mesh position={[0, 0.5, 0]} visible={false}>
            <cylinderGeometry args={[0.7, 0.7, 1.4, 16]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          {/* Torso — ref for breathing animation */}
          <mesh ref={torsoRef} position={[0, 0.3, 0]} scale={[0.22, 0.55, 0.18]}>
            <capsuleGeometry args={[1, 1.25, 8, 18]} />
            <meshStandardMaterial ref={registerBodyMat(0)} color={bodyColor} roughness={0.38} metalness={0.05} transparent opacity={0} />
          </mesh>

          {/* Left arm — rotation fully controlled in useFrame */}
          <mesh ref={leftArmRef} position={[-0.34, 0.66, 0]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(1)} color={bodyColor} roughness={0.42} transparent opacity={0} />
          </mesh>

          {/* Right arm */}
          <mesh ref={rightArmRef} position={[0.34, 0.66, 0]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(2)} color={bodyColor} roughness={0.42} transparent opacity={0} />
          </mesh>

          {/* Left leg — Z stance static, X walk swing in useFrame */}
          <mesh ref={leftLegRef} position={[-0.13, -0.3, 0]} rotation={[0, 0, Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(3)} color="#2b344e" roughness={0.5} transparent opacity={0} />
          </mesh>

          {/* Right leg */}
          <mesh ref={rightLegRef} position={[0.13, -0.3, 0]} rotation={[0, 0, -Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial ref={registerBodyMat(4)} color="#2b344e" roughness={0.5} transparent opacity={0} />
          </mesh>

          {/* Head group — pivot at neck height (y=0.88) for anatomically correct nod/look */}
          <group ref={headGroupRef} position={[0, 0.88, 0]}>
            {/* Head sphere — scale controlled in useFrame (2D node-circle trick) */}
            <mesh ref={headRef} position={[0, 0.17, 0]}>
              <sphereGeometry args={[0.22, 32, 32]} />
              <meshStandardMaterial color={skin} roughness={0.46} />
            </mesh>

            {/* Hair — follows head rotation */}
            {isFemale ? (
              <mesh position={[0, 0.26, -0.03]} scale={[1.18, 0.68, 1.04]}>
                <sphereGeometry args={[0.24, 32, 16]} />
                <meshStandardMaterial ref={registerBodyMat(5)} color="#312033" roughness={0.54} transparent opacity={0} />
              </mesh>
            ) : (
              <mesh position={[0, 0.35, -0.01]} scale={[1.05, 0.38, 0.96]}>
                <sphereGeometry args={[0.23, 32, 16]} />
                <meshStandardMaterial ref={registerBodyMat(5)} color="#252232" roughness={0.54} transparent opacity={0} />
              </mesh>
            )}
          </group>

          {/* Initials disc — always flat (faces up), stays outside headGroup */}
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

          {/* Name label — drei Html always faces camera */}
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
  prev.person            === next.person &&
  prev.isSelected        === next.isSelected &&
  prev.isConnectSource   === next.isConnectSource &&
  prev.isDropTarget      === next.isDropTarget &&
  prev.isPathHighlighted === next.isPathHighlighted &&
  prev.isDimmed          === next.isDimmed &&
  prev.isPressed         === next.isPressed &&
  prev.talkingToId       === next.talkingToId &&
  prev.onClick           === next.onClick &&
  prev.onPointerDown     === next.onPointerDown
)
