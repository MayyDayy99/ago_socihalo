import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { ContactShadows, Float, Html, Line, OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js"
import { Suspense, useMemo, useRef, useCallback, useState, useEffect } from "react"
import * as THREE from "three"
import { usePeople, useUpdatePerson } from "../../hooks/usePeople"
import { useConnections, useCreateConnection } from "../../hooks/useConnections"
import { useAppStore } from "../../store/useAppStore"
import { GROUPS } from "../../lib/constants"
import type { GroupKey } from "../../lib/constants"
import type { Person, Connection } from "../../store/types"
import Toolbar from "../Map/Toolbar"
import ConnectModeBanner from "../Map/ConnectModeBanner"
import ConnectionDialog from "../../components/ConnectionDialog"
import { Button } from "../../components/ui/Button"
import { toast } from "../../components/ui/Toast"
import { UserPlus } from "lucide-react"

// ── Group → 3D zone (center on the floor) ──────────────────
const GROUP_3D: Record<GroupKey, { center: [number, number] }> = {
  family:       { center: [-2.5, -1.5] },
  work:         { center: [ 2.5, -1.5] },
  friend:       { center: [-2.5,  1.6] },
  business:     { center: [ 2.5,  1.6] },
  acquaintance: { center: [-3.5,  0.0] },
  community:    { center: [ 3.5,  0.0] },
  other:        { center: [ 0.0,  3.0] },
}
const UNGROUPED_CENTER: [number, number] = [0, 0]

// Hash a string → deterministic [0,1) — used to vary "gender" and walk phase per person
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function placeInGroup(centerX: number, centerZ: number, idxInGroup: number, totalInGroup: number, idHash: number): [number, number, number] {
  if (totalInGroup === 1) return [centerX, 0, centerZ]
  const radius = Math.min(1.6, 0.55 + totalInGroup * 0.08)
  const angle = (idxInGroup / totalInGroup) * Math.PI * 2 + idHash * 0.4
  const jitter = (idHash - 0.5) * 0.18
  return [centerX + Math.cos(angle) * (radius + jitter), 0, centerZ + Math.sin(angle) * (radius + jitter)]
}

type PersonWithPos = Person & { pos: [number, number, number]; idHash: number }

// World ↔ pixel scale conversion. d3-force in MapView produces pixel-scale
// coordinates (~hundreds); the 3D scene works in ~10x10 world units. Same scale
// used at read (×WORLD_SCALE) and write (÷WORLD_SCALE) so the two views stay
// in lock-step on relative distance + direction.
const WORLD_SCALE = 1 / 80   // pixel → world (matches /80 in computePositions)
const LONG_PRESS_MS = 400
const EMPTY_CONNECTIONS: Connection[] = []
const LIFE_WANDER_RADIUS = 0.16
const LIFE_MAX_STEP = 0.58

type LivePersonMotion = {
  position: THREE.Vector3
  moving: number
  interaction: number
  yaw: number
}

type LiveMotionRef = React.MutableRefObject<Map<string, LivePersonMotion>>

// Refs we need from inside the Canvas, exposed back to the outer drag handler
type SceneRefs = {
  camera: THREE.Camera
  gl: THREE.WebGLRenderer
  controls: OrbitControlsImpl | null
}

function ThreeContextBridge({
  refOut, controlsRefOut,
}: {
  refOut: React.MutableRefObject<SceneRefs | null>
  controlsRefOut: React.MutableRefObject<OrbitControlsImpl | null>
}) {
  const { camera, gl } = useThree()
  useEffect(() => {
    refOut.current = { camera, gl, controls: controlsRefOut.current }
  }, [camera, gl, refOut, controlsRefOut])
  return null
}

function computePositions(people: Person[]): PersonWithPos[] {
  // Group by group_key
  const buckets = new Map<GroupKey | "_none", Person[]>()
  for (const p of people) {
    const k = (p.group_key ?? "_none") as GroupKey | "_none"
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push(p)
  }
  const out: PersonWithPos[] = []
  for (const [groupKey, list] of buckets) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id))
    const center = groupKey === "_none" ? UNGROUPED_CENTER : GROUP_3D[groupKey].center
    sorted.forEach((p, i) => {
      // Honour pinned position if present (project x,z from 2D pinned coords, scaled down)
      let pos: [number, number, number]
      if (p.pinned_x !== null && p.pinned_y !== null) {
        // Scale 2D simulation coords (~hundreds) into the 3D room (~10x10)
        pos = [p.pinned_x / 80, 0, p.pinned_y / 80]
      } else {
        pos = placeInGroup(center[0], center[1], i, sorted.length, hash(p.id))
      }
      out.push({ ...p, pos, idHash: hash(p.id) })
    })
  }
  return out
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

function easeInOut01(v: number): number {
  const x = clamp01(v)
  return x * x * (3 - 2 * x)
}

function connectionActivity(connection: Connection, time: number): { amount: number; progress: number } {
  const strength = connection.strength ?? 3
  const seed = hash(connection.id)
  const period = 28 + seed * 22 - strength * 1.4
  const duration = 2.8 + strength * 0.34
  const local = (time + seed * period) % period
  if (local > duration) return { amount: 0, progress: 0 }

  const progress = local / duration
  const fade = Math.min(local / 0.75, (duration - local) / 0.75, 1)
  return {
    amount: clamp01(fade) * Math.sin(progress * Math.PI),
    progress,
  }
}

function computeLivingTarget(
  person: PersonWithPos,
  personConnections: Connection[],
  basePositionMap: Map<string, [number, number, number]>,
  time: number,
  isAnchoredByUi: boolean
): { target: [number, number, number]; yaw: number; interaction: number } {
  const base = person.pos
  const phase = person.idHash * Math.PI * 2
  const anchorScale = isAnchoredByUi ? 0.35 : 1
  const wanderRadius = LIFE_WANDER_RADIUS * anchorScale * (0.65 + person.idHash * 0.55)
  const wanderX =
    Math.sin(time * (0.16 + person.idHash * 0.05) + phase) * wanderRadius +
    Math.sin(time * 0.07 + phase * 2.3) * wanderRadius * 0.55
  const wanderZ =
    Math.cos(time * (0.13 + person.idHash * 0.04) + phase * 1.7) * wanderRadius +
    Math.sin(time * 0.05 + phase * 0.8) * wanderRadius * 0.45

  let bestAmount = 0
  let bestStrength = 0
  let partnerPos: [number, number, number] | null = null

  for (const connection of personConnections) {
    const activity = connectionActivity(connection, time)
    if (activity.amount <= 0.02) continue
    const strength = connection.strength ?? 3
    const score = activity.amount * (0.75 + strength * 0.16)
    if (score <= bestAmount * (0.75 + bestStrength * 0.16)) continue

    const partnerId = connection.from_id === person.id ? connection.to_id : connection.from_id
    const nextPartnerPos = basePositionMap.get(partnerId)
    if (!nextPartnerPos) continue

    bestAmount = activity.amount
    bestStrength = strength
    partnerPos = nextPartnerPos
  }

  if (!partnerPos) {
    const idleYaw = Math.sin(time * 0.18 + phase) * 0.28
    return {
      target: [base[0] + wanderX, 0, base[2] + wanderZ],
      yaw: idleYaw,
      interaction: 0,
    }
  }

  const dx = partnerPos[0] - base[0]
  const dz = partnerPos[2] - base[2]
  const dist = Math.max(0.001, Math.hypot(dx, dz))
  const ux = dx / dist
  const uz = dz / dist
  const reach = Math.min(LIFE_MAX_STEP, 0.16 + bestStrength * 0.085)
  const step = reach * bestAmount * anchorScale
  const wanderBlend = 1 - bestAmount * 0.75

  return {
    target: [
      base[0] + ux * step + wanderX * wanderBlend,
      0,
      base[2] + uz * step + wanderZ * wanderBlend,
    ],
    yaw: Math.atan2(ux, uz),
    interaction: bestAmount,
  }
}

// ── 3D person avatar — premium minimalist pictogram per spec ─────────────
//
// Anatomy (ground = y=0, total height ≈ 1.42 world units):
//   feet   y 0.00 → 0.05    (small flattened spheres)
//   legs   y 0.05 → 0.50    (capsules)
//   hips   y ≈ 0.50         (smoothing dome)
//   torso  y 0.45 → 1.05    (tapered capsule, slightly slimmed front-to-back)
//   shoulders y ≈ 1.05      (caps + arm joints)
//   arms   y 1.05 → 0.62    (capsules hanging slightly outward)
//   hands  y ≈ 0.60         (skin-tone spheres)
//   neck   y 1.05 → 1.10    (short cylinder, skin tone)
//   head   y 1.10 → 1.43    (sphere, skin tone, optional female hair)
//
// Materials: MeshPhysicalMaterial with subtle clearcoat for matte clay/porcelain feel.

function PersonAvatar({
  person, selected, dimmed, isSource, hovered, pressed, personConnections,
  basePositionMap, dragOverridesRef, liveMotionRef, onSelect, onPointerDown,
}: {
  person: PersonWithPos
  selected: boolean
  dimmed: boolean
  isSource: boolean
  hovered: boolean
  pressed: boolean
  personConnections: Connection[]
  basePositionMap: Map<string, [number, number, number]>
  dragOverridesRef: React.MutableRefObject<Map<string, [number, number, number]>>
  liveMotionRef: LiveMotionRef
  onSelect: (e: ThreeEvent<MouseEvent>) => void
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
}) {
  const rootRef  = useRef<THREE.Group>(null)
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef<THREE.Group>(null)
  const ringRef  = useRef<THREE.Mesh>(null)
  const leftFootRef = useRef<THREE.Mesh>(null)
  const rightFootRef = useRef<THREE.Mesh>(null)
  const leftLegRef = useRef<THREE.Mesh>(null)
  const rightLegRef = useRef<THREE.Mesh>(null)
  const torsoRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const leftHandRef = useRef<THREE.Mesh>(null)
  const rightHandRef = useRef<THREE.Mesh>(null)
  const headRef = useRef<THREE.Mesh>(null)
  const hairRef = useRef<THREE.Mesh>(null)
  const currentPosRef = useRef(new THREE.Vector3(person.pos[0], 0, person.pos[2]))
  const targetPosRef = useRef(new THREE.Vector3(person.pos[0], 0, person.pos[2]))
  const lastPosRef = useRef(new THREE.Vector3(person.pos[0], 0, person.pos[2]))
  const yawRef = useRef(0)
  const stepPhaseRef = useRef(person.idHash * Math.PI * 2)
  const walkPhase = person.idHash * Math.PI * 2
  const isFemale = person.idHash > 0.5

  // Spec palette
  const skin       = "#EAC1A2"
  const skinShadow = "#C99678"
  const legColor   = "#27324A"
  const footColor  = "#1B2234"
  // Torso uses the group color for in-app identity (matches 2D node border color)
  const torsoColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#7ED3FF" : "#7ED3FF"

  const opacity = dimmed ? 0.32 : 1
  const ringColor =
    isSource  ? "#D97706" :
    selected  ? "#B7ECFF" :   // spec selection-glow cyan
    hovered   ? torsoColor :
    torsoColor

  // Per-frame: living target, procedural walk cycle, scale tween, pulsing ring
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    const dt = Math.min(delta, 0.05)
    const dragging = dragOverridesRef.current.has(person.id)
    const override = dragOverridesRef.current.get(person.id)
    const living = computeLivingTarget(
      person,
      personConnections,
      basePositionMap,
      t,
      selected || hovered || isSource || pressed
    )

    if (override) {
      currentPosRef.current.set(override[0], 0, override[2])
      targetPosRef.current.copy(currentPosRef.current)
    } else {
      targetPosRef.current.set(living.target[0], 0, living.target[2])
      currentPosRef.current.lerp(targetPosRef.current, 1 - Math.exp(-dt * 2.2))
    }

    const frameMove = currentPosRef.current.distanceTo(lastPosRef.current)
    const moving = dragging ? 0 : clamp01((frameMove / Math.max(dt, 0.016)) * 1.35)
    const interaction = dragging ? 0 : living.interaction
    stepPhaseRef.current += dt * (2.4 + moving * 7.5) * (0.18 + moving)

    if (rootRef.current) {
      rootRef.current.position.copy(currentPosRef.current)

      const moveDx = currentPosRef.current.x - lastPosRef.current.x
      const moveDz = currentPosRef.current.z - lastPosRef.current.z
      const movingYaw = Math.hypot(moveDx, moveDz) > 0.002 ? Math.atan2(moveDx, moveDz) : living.yaw
      const yawTarget = interaction > 0.08 ? living.yaw : movingYaw
      yawRef.current += shortestAngleDelta(yawRef.current, yawTarget) * (1 - Math.exp(-dt * 5.8))
      rootRef.current.rotation.y = yawRef.current
    }

    const existingMotion = liveMotionRef.current.get(person.id)
    if (existingMotion) {
      existingMotion.position.copy(currentPosRef.current)
      existingMotion.moving = moving
      existingMotion.interaction = interaction
      existingMotion.yaw = yawRef.current
    } else {
      liveMotionRef.current.set(person.id, {
        position: currentPosRef.current.clone(),
        moving,
        interaction,
        yaw: yawRef.current,
      })
    }

    if (groupRef.current) {
      const idleBob = Math.sin(t * 1.35 + walkPhase) * 0.018
      const walkBob = Math.max(0, Math.sin(stepPhaseRef.current * 2)) * 0.035 * moving
      const talkBob = Math.sin(t * 3.1 + walkPhase) * 0.012 * interaction
      groupRef.current.position.y = dragging ? 0 : idleBob + walkBob + talkBob
    }
    if (scaleRef.current) {
      const target = pressed || selected ? 1.08 : hovered ? 1.02 : 1.0
      const cur = scaleRef.current.scale.x
      const next = THREE.MathUtils.lerp(cur, target, 0.18)
      scaleRef.current.scale.setScalar(next)
    }

    const step = stepPhaseRef.current
    const swing = Math.sin(step)
    const counter = Math.sin(step + Math.PI)
    const gesture = easeInOut01(interaction) * (0.55 + Math.sin(t * 3.4 + walkPhase) * 0.18)

    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.38 * moving
    if (rightLegRef.current) rightLegRef.current.rotation.x = counter * 0.38 * moving
    if (leftFootRef.current) {
      leftFootRef.current.position.z = 0.018 + swing * 0.045 * moving
      leftFootRef.current.position.y = 0.025 + Math.max(0, swing) * 0.035 * moving
      leftFootRef.current.rotation.x = -swing * 0.22 * moving
    }
    if (rightFootRef.current) {
      rightFootRef.current.position.z = 0.018 + counter * 0.045 * moving
      rightFootRef.current.position.y = 0.025 + Math.max(0, counter) * 0.035 * moving
      rightFootRef.current.rotation.x = -counter * 0.22 * moving
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.set(counter * 0.26 * moving - gesture * 0.38, 0, 0.10 + gesture * 0.16)
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.set(swing * 0.26 * moving - gesture * 0.28, 0, -0.10 - gesture * 0.12)
    }
    if (leftHandRef.current) {
      leftHandRef.current.position.set(
        -0.295 - gesture * 0.035,
        0.60 + gesture * 0.09 + Math.max(0, counter) * 0.018 * moving,
        0.025 + gesture * 0.12 + counter * 0.025 * moving
      )
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.set(
        0.295 + gesture * 0.03,
        0.60 + gesture * 0.075 + Math.max(0, swing) * 0.018 * moving,
        0.025 + gesture * 0.10 + swing * 0.025 * moving
      )
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.x = Math.sin(step * 2) * 0.035 * moving
      torsoRef.current.rotation.z = Math.sin(t * 1.1 + walkPhase) * 0.018 + swing * 0.025 * moving
    }
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.85 + walkPhase) * 0.13 * (1 - interaction) + Math.sin(t * 2.2 + walkPhase) * 0.08 * interaction
      headRef.current.rotation.x = Math.sin(t * 0.65 + walkPhase) * 0.035 + interaction * 0.045
    }
    if (hairRef.current && headRef.current) {
      hairRef.current.rotation.copy(headRef.current.rotation)
    }

    if (ringRef.current && (selected || isSource || pressed)) {
      const s = 1 + Math.sin(t * 2.4) * 0.05
      ringRef.current.scale.x = s
      ringRef.current.scale.z = s
    } else if (ringRef.current) {
      ringRef.current.scale.x = 1
      ringRef.current.scale.z = 1
    }
    lastPosRef.current.copy(currentPosRef.current)
  })

  return (
    <group ref={rootRef} position={person.pos} onClick={onSelect} onPointerDown={onPointerDown}>
      <Float speed={0.9} rotationIntensity={0.02} floatIntensity={selected || isSource ? 0.08 : 0.03}>
        <group ref={groupRef}>
          <group ref={scaleRef}>

            {/* Ground ring — pulses on selection / source */}
            <mesh ref={ringRef} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.30, 0.42, 64]} />
              <meshBasicMaterial
                color={ringColor}
                transparent
                opacity={isSource ? 0.75 : selected ? 0.6 : hovered ? 0.4 : 0.22 * opacity}
              />
            </mesh>

            {/* Feet — small flattened ovals pointing slightly forward (+z) */}
            <mesh ref={leftFootRef} position={[-0.075, 0.025, 0.018]} scale={[1.4, 0.5, 1.7]} castShadow>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={footColor} roughness={0.7} transparent opacity={opacity} />
            </mesh>
            <mesh ref={rightFootRef} position={[0.075, 0.025, 0.018]} scale={[1.4, 0.5, 1.7]} castShadow>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={footColor} roughness={0.7} transparent opacity={opacity} />
            </mesh>

            {/* Legs — slim capsules */}
            <mesh ref={leftLegRef} position={[-0.075, 0.27, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.36, 10, 18]} />
              <meshPhysicalMaterial
                color={legColor}
                roughness={0.65}
                metalness={0.04}
                clearcoat={0.12}
                clearcoatRoughness={0.4}
                transparent
                opacity={opacity}
              />
            </mesh>
            <mesh ref={rightLegRef} position={[0.075, 0.27, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.36, 10, 18]} />
              <meshPhysicalMaterial
                color={legColor}
                roughness={0.65}
                metalness={0.04}
                clearcoat={0.12}
                clearcoatRoughness={0.4}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* Hip dome — smooths the torso→legs transition */}
            <mesh position={[0, 0.50, 0]} scale={[1.1, 0.7, 0.95]} castShadow>
              <sphereGeometry args={[0.13, 20, 20]} />
              <meshPhysicalMaterial
                color={torsoColor}
                roughness={0.6}
                metalness={0.04}
                clearcoat={0.14}
                clearcoatRoughness={0.4}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* Torso — tapered: scaled capsule, slimmer front-to-back */}
            <mesh ref={torsoRef} position={[0, 0.78, 0]} scale={[1, 1, 0.78]} castShadow>
              <capsuleGeometry args={[0.18, 0.42, 14, 28]} />
              <meshPhysicalMaterial
                color={torsoColor}
                roughness={0.58}
                metalness={0.04}
                clearcoat={0.16}
                clearcoatRoughness={0.35}
                emissive={selected ? new THREE.Color(ringColor) : new THREE.Color("#000000")}
                emissiveIntensity={selected ? 0.18 : 0}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* Shoulder caps — small spheres at the torso→arm joint */}
            <mesh position={[-0.21, 1.04, 0]} castShadow>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshPhysicalMaterial color={torsoColor} roughness={0.6} clearcoat={0.16} clearcoatRoughness={0.35} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.21, 1.04, 0]} castShadow>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshPhysicalMaterial color={torsoColor} roughness={0.6} clearcoat={0.16} clearcoatRoughness={0.35} transparent opacity={opacity} />
            </mesh>

            {/* Arms — slim capsules, slight outward angle so they don't clip the torso */}
            <mesh ref={leftArmRef} position={[-0.245, 0.83, 0.015]} rotation={[0, 0, 0.10]} castShadow>
              <capsuleGeometry args={[0.048, 0.40, 8, 16]} />
              <meshPhysicalMaterial color={torsoColor} roughness={0.6} clearcoat={0.14} clearcoatRoughness={0.4} transparent opacity={opacity} />
            </mesh>
            <mesh ref={rightArmRef} position={[0.245, 0.83, 0.015]} rotation={[0, 0, -0.10]} castShadow>
              <capsuleGeometry args={[0.048, 0.40, 8, 16]} />
              <meshPhysicalMaterial color={torsoColor} roughness={0.6} clearcoat={0.14} clearcoatRoughness={0.4} transparent opacity={opacity} />
            </mesh>

            {/* Hands — small skin-tone spheres at the end of each arm */}
            <mesh ref={leftHandRef} position={[-0.295, 0.60, 0.025]} castShadow>
              <sphereGeometry args={[0.062, 16, 16]} />
              <meshStandardMaterial color={skin} roughness={0.6} transparent opacity={opacity} />
            </mesh>
            <mesh ref={rightHandRef} position={[0.295, 0.60, 0.025]} castShadow>
              <sphereGeometry args={[0.062, 16, 16]} />
              <meshStandardMaterial color={skin} roughness={0.6} transparent opacity={opacity} />
            </mesh>

            {/* Neck — short tapered cylinder, skin shadow tone */}
            <mesh position={[0, 1.115, 0]} castShadow>
              <cylinderGeometry args={[0.058, 0.07, 0.07, 16]} />
              <meshStandardMaterial color={skinShadow} roughness={0.65} transparent opacity={opacity} />
            </mesh>

            {/* HEAD — sphere, skin tone, with subtle clearcoat for the porcelain feel */}
            <mesh ref={headRef} position={[0, 1.27, 0]} castShadow>
              <sphereGeometry args={[0.16, 32, 32]} />
              <meshPhysicalMaterial
                color={skin}
                roughness={0.62}
                metalness={0.02}
                clearcoat={0.18}
                clearcoatRoughness={0.32}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* Hair — only on female variant. Soft dome covering top + back of head. */}
            {isFemale && (
              <mesh ref={hairRef} position={[0, 1.30, -0.025]} scale={[1.13, 0.86, 1.08]} castShadow>
                <sphereGeometry args={[0.16, 32, 16]} />
                <meshPhysicalMaterial
                  color="#3a2937"
                  roughness={0.7}
                  metalness={0.02}
                  clearcoat={0.06}
                  clearcoatRoughness={0.5}
                  transparent
                  opacity={opacity}
                />
              </mesh>
            )}

            {/* Invisible larger hit cylinder for reliable touch / click */}
            <mesh position={[0, 0.7, 0]} visible={false}>
              <cylinderGeometry args={[0.34, 0.34, 1.5, 12]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>

          {/* Name label above head */}
          <Html position={[0, 1.58, 0]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}>
            <div className={`person3d-label-light ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""} ${isSource ? "source" : ""}`}>
              {person.display_name}
            </div>
          </Html>
        </group>
      </Float>
    </group>
  )
}

// ── 3D connection beam ─────────────────────────────────────
const BEAM_POINTS = 28
const BEAM_HEIGHT = 0.85   // chest-center anchor

function ConnectionBeam({
  connection, fromPos, toPos, color, dimmed, selected, dragOverridesRef, liveMotionRef,
}: {
  connection: Connection
  fromPos: [number, number, number]
  toPos: [number, number, number]
  color: string
  dimmed: boolean
  selected: boolean
  dragOverridesRef: React.MutableRefObject<Map<string, [number, number, number]>>
  liveMotionRef: LiveMotionRef
}) {
  // drei's <Line> wraps Line2 (LineGeometry under the hood). LineGeometry expects flat
  // positions via setPositions(Float32Array) — using BufferGeometry.setFromPoints silently
  // does nothing here. Hence the flat buffer + setPositions every frame.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null)
  const positionsBuf = useRef<Float32Array>(new Float32Array(BEAM_POINTS * 3))
  const a = useRef(new THREE.Vector3())
  const b = useRef(new THREE.Vector3())
  const mid = useRef(new THREE.Vector3())
  const tmp = useRef(new THREE.Vector3())
  const curve = useRef(new THREE.QuadraticBezierCurve3())
  const sparkRef = useRef<THREE.Mesh>(null)
  const sparkMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const ovFrom = dragOverridesRef.current.get(connection.from_id)
    const ovTo   = dragOverridesRef.current.get(connection.to_id)
    const liveFrom = liveMotionRef.current.get(connection.from_id)?.position
    const liveTo = liveMotionRef.current.get(connection.to_id)?.position
    const fx = ovFrom ? ovFrom[0] : liveFrom ? liveFrom.x : fromPos[0]
    const fz = ovFrom ? ovFrom[2] : liveFrom ? liveFrom.z : fromPos[2]
    const tx = ovTo   ? ovTo[0]   : liveTo   ? liveTo.x   : toPos[0]
    const tz = ovTo   ? ovTo[2]   : liveTo   ? liveTo.z   : toPos[2]

    a.current.set(fx, BEAM_HEIGHT, fz)
    b.current.set(tx, BEAM_HEIGHT, tz)
    mid.current.copy(a.current).lerp(b.current, 0.5)
    const dist = a.current.distanceTo(b.current)
    mid.current.y += Math.max(0.4, dist * 0.18)

    curve.current.v0 = a.current
    curve.current.v1 = mid.current
    curve.current.v2 = b.current

    const buf = positionsBuf.current
    for (let i = 0; i < BEAM_POINTS; i++) {
      curve.current.getPoint(i / (BEAM_POINTS - 1), tmp.current)
      buf[i * 3]     = tmp.current.x
      buf[i * 3 + 1] = tmp.current.y
      buf[i * 3 + 2] = tmp.current.z
    }

    const line = lineRef.current
    if (line && line.geometry && typeof line.geometry.setPositions === "function") {
      line.geometry.setPositions(buf)
      // For dashed lines the line distances need recomputing
      if (typeof line.computeLineDistances === "function") line.computeLineDistances()
      const activity = connectionActivity(connection, t)
      if (line.material) {
        line.material.opacity = dimmed
          ? 0.08
          : selected
            ? 0.95
            : 0.42 + activity.amount * 0.34
      }
      if (sparkRef.current && sparkMaterialRef.current) {
        if (activity.amount > 0.02 && !dimmed) {
          curve.current.getPoint(easeInOut01(activity.progress), tmp.current)
          sparkRef.current.position.copy(tmp.current)
          sparkRef.current.scale.setScalar(0.7 + activity.amount * 1.7)
          sparkMaterialRef.current.opacity = activity.amount * (selected ? 0.95 : 0.72)
        } else {
          sparkMaterialRef.current.opacity = 0
        }
    }
    }
  })

  // Initial seed for `points` prop — drei needs at least 2 points to mount the geometry.
  const initialPoints = useMemo<[number, number, number][]>(
    () => Array.from({ length: BEAM_POINTS }, () => [0, 0, 0]),
    []
  )

  const strength = connection.strength ?? 3
  return (
    <>
      <Line
        ref={lineRef}
        points={initialPoints}
        color={color}
        lineWidth={selected ? Math.max(2.2, strength * 0.8) : 1.4}
        transparent
        opacity={dimmed ? 0.08 : selected ? 0.95 : 0.55}
        dashed={strength <= 2}
        dashSize={0.12}
        gapSize={0.08}
      />
      <mesh ref={sparkRef} visible={!dimmed}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial ref={sparkMaterialRef} color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  )
}

// (Group zone discs were a 3D-only visual; removed for parity with the 2D view.
//  The GROUP_3D centers above are still used as the seed positions for `placeInGroup`.)

// ── Main scene ─────────────────────────────────────────────
function Scene({
  people, connections, onPersonClick, onPersonPointerDown, hoveredPersonId, setHovered,
  pressedId, dragOverridesRef, liveMotionRef, controlsRef, sceneRefsRef,
}: {
  people: PersonWithPos[]
  connections: Connection[]
  onPersonClick: (id: string) => void
  onPersonPointerDown: (id: string, e: ThreeEvent<PointerEvent>) => void
  hoveredPersonId: string | null
  setHovered: (id: string | null) => void
  pressedId: string | null
  dragOverridesRef: React.MutableRefObject<Map<string, [number, number, number]>>
  liveMotionRef: LiveMotionRef
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>
  sceneRefsRef: React.MutableRefObject<SceneRefs | null>
}) {
  const { selectedPersonId, connectFromId } = useAppStore()

  const basePositionMap = useMemo(() => {
    const m = new Map<string, [number, number, number]>()
    people.forEach(p => m.set(p.id, p.pos))
    return m
  }, [people])

  const connectionsByPerson = useMemo(() => {
    const m = new Map<string, Connection[]>()
    for (const connection of connections) {
      if (!m.has(connection.from_id)) m.set(connection.from_id, [])
      if (!m.has(connection.to_id)) m.set(connection.to_id, [])
      m.get(connection.from_id)!.push(connection)
      m.get(connection.to_id)!.push(connection)
    }
    return m
  }, [connections])

  useEffect(() => {
    const ids = new Set(people.map(p => p.id))
    for (const id of liveMotionRef.current.keys()) {
      if (!ids.has(id)) liveMotionRef.current.delete(id)
    }
  }, [people, liveMotionRef])

  const neighborSet = useMemo(() => {
    if (!hoveredPersonId) return null
    const s = new Set<string>([hoveredPersonId])
    connections.forEach(c => {
      if (c.from_id === hoveredPersonId) s.add(c.to_id)
      if (c.to_id === hoveredPersonId) s.add(c.from_id)
    })
    return s
  }, [hoveredPersonId, connections])

  return (
    <>
      <color attach="background" args={["#F5F5F5"]} />
      <fog attach="fog" args={["#F5F5F5", 16, 32]} />
      {/* Soft, even lighting — catalog-photo style */}
      <ambientLight intensity={0.95} />
      <directionalLight position={[5, 9, 4]} intensity={1.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-5, 7, -2]} intensity={0.35} />
      {/* No floor slab and no grid — people float on contact shadows for a clean catalog look */}

      {/* Connections */}
      {connections.map(c => {
        const fromPos = basePositionMap.get(c.from_id)
        const toPos   = basePositionMap.get(c.to_id)
        if (!fromPos || !toPos) return null
        const groupKey = (c.type ?? "other") as GroupKey
        const color = GROUPS[groupKey]?.color ?? "#9CA3AF"
        const isAdjacentToSelected =
          selectedPersonId !== null &&
          (c.from_id === selectedPersonId || c.to_id === selectedPersonId)
        const isAdjacentToHover =
          hoveredPersonId !== null &&
          (c.from_id === hoveredPersonId || c.to_id === hoveredPersonId)
        const dimmed = (selectedPersonId !== null && !isAdjacentToSelected) ||
                       (hoveredPersonId !== null && !isAdjacentToHover)
        return (
          <ConnectionBeam
            key={c.id}
            connection={c}
            fromPos={fromPos}
            toPos={toPos}
            color={color}
            dimmed={dimmed}
            selected={isAdjacentToSelected}
            dragOverridesRef={dragOverridesRef}
            liveMotionRef={liveMotionRef}
          />
        )
      })}

      {/* People */}
      {people.map(p => {
        const isSel = selectedPersonId === p.id
        const isSrc = connectFromId === p.id
        const dimmed =
          (hoveredPersonId !== null && neighborSet && !neighborSet.has(p.id) && !isSrc) ||
          (selectedPersonId !== null && !isSel && !isSrc &&
            !connections.some(c =>
              (c.from_id === selectedPersonId && c.to_id === p.id) ||
              (c.to_id === selectedPersonId && c.from_id === p.id)
            ))
        return (
          <group
            key={p.id}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(p.id) }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(null) }}
          >
            <PersonAvatar
              person={p}
              selected={isSel}
              isSource={isSrc}
              hovered={hoveredPersonId === p.id}
              pressed={pressedId === p.id}
              dimmed={!!dimmed}
              personConnections={connectionsByPerson.get(p.id) ?? EMPTY_CONNECTIONS}
              basePositionMap={basePositionMap}
              dragOverridesRef={dragOverridesRef}
              liveMotionRef={liveMotionRef}
              onSelect={(e) => { e.stopPropagation(); onPersonClick(p.id) }}
              onPointerDown={(e) => { e.stopPropagation(); onPersonPointerDown(p.id, e) }}
            />
          </group>
        )
      })}

      {/* One big contact shadow under the whole scene — gives every avatar a soft
          catalog-style foot shadow without needing a visible floor. */}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.32} scale={50} blur={2.0} far={2.0} resolution={1024} color="#0f172a" />
      {/* No Environment HDRI — keeps the look matte / clean instead of cinematic. */}
      <ThreeContextBridge refOut={sceneRefsRef} controlsRefOut={controlsRef} />
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.12}
        minDistance={5}
        maxDistance={16}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 0.65, 0]}
      />
    </>
  )
}

// ── Top-level Map3DView component ──────────────────────────
export default function Map3DView() {
  const { data: people = [], isLoading } = usePeople()
  const { data: connections = [] } = useConnections()
  const updatePerson = useUpdatePerson()
  const createConn   = useCreateConnection()
  const {
    setSelectedPersonId,
    connectMode, connectFromId, setConnectFromId, setConnectMode,
    setCreatePersonOpen, setActiveView,
  } = useAppStore()

  const [pendingConn, setPendingConn] = useState<{ fromId: string; toId: string } | null>(null)
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)

  const placedPeople = useMemo(() => computePositions(people), [people])

  // Refs for the in-canvas pieces we need from outside (drag raycasting, controls toggling)
  const sceneRefsRef     = useRef<SceneRefs | null>(null)
  const controlsRef      = useRef<OrbitControlsImpl | null>(null)
  // Live drag positions (world units) — read every frame by PersonAvatar via useFrame.
  // Bypasses React reconciliation so dragging stays smooth.
  const dragOverridesRef = useRef<Map<string, [number, number, number]>>(new Map())
  const liveMotionRef    = useRef<Map<string, LivePersonMotion>>(new Map())
  const dragMovedRef     = useRef(false)
  // Track pointer-down position so we can distinguish a tap (close panel) from a pan (don't)
  const pointerDownRef   = useRef<{ x: number; y: number } | null>(null)

  const onPersonClick = useCallback((personId: string) => {
    // Suppress click immediately following a real drag (click fires on pointerup)
    if (dragMovedRef.current) return
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(personId)
      } else if (connectFromId !== personId) {
        setPendingConn({ fromId: connectFromId, toId: personId })
      } else {
        setConnectFromId(null)
        setConnectMode(false)
      }
    } else {
      setSelectedPersonId(personId)
    }
  }, [connectMode, connectFromId, setConnectFromId, setConnectMode, setSelectedPersonId])

  // Drag: raycast against the y=0 plane to convert pointer position → world coords.
  // Long-press (400ms) gating on touch so a tap stays a tap.
  const onPersonPointerDown = useCallback((personId: string, e: ThreeEvent<PointerEvent>) => {
    const native = e.nativeEvent as PointerEvent
    if (native.shiftKey) {
      setConnectFromId(personId)
      setConnectMode(true)
      return
    }
    if (connectMode) return

    const isTouch = native.pointerType === "touch"
    const longPressMs = isTouch ? LONG_PRESS_MS : 0
    const moveThreshold = isTouch ? 8 : 2
    let dragActive = !isTouch
    let pinnedThisGesture = false
    let moved = false
    const start = { x: native.clientX, y: native.clientY }
    dragMovedRef.current = false

    const refs = sceneRefsRef.current
    if (!refs) return
    const rect = refs.gl.domElement.getBoundingClientRect()
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()

    function pinAtPointer(clientX: number, clientY: number) {
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, refs!.camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      dragOverridesRef.current.set(personId, [hit.x, 0, hit.z])
      pinnedThisGesture = true
    }

    let longPressTimer: number | null = null
    if (isTouch) {
      setPressedId(personId)
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null
        dragActive = true
        if (controlsRef.current) controlsRef.current.enabled = false
        navigator.vibrate?.(15)
        pinAtPointer(start.x, start.y)
      }, longPressMs)
    } else {
      // Mouse: disable orbit immediately so it doesn't fight the drag
      if (controlsRef.current) controlsRef.current.enabled = false
    }

    function cancelLongPress() {
      if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null }
    }

    function onMove(me: PointerEvent) {
      if (me.pointerId !== native.pointerId) return
      const dx = me.clientX - start.x
      const dy = me.clientY - start.y
      const dist = Math.hypot(dx, dy)
      if (dist > moveThreshold) moved = true
      // Touch: movement before long-press fires → user is panning, abort drag attempt
      if (isTouch && !dragActive && moved) {
        cancelLongPress()
        cleanup()
        return
      }
      if (!dragActive) return
      pinAtPointer(me.clientX, me.clientY)
    }

    function onUp(me: PointerEvent) {
      if (me.pointerId !== native.pointerId) return
      cancelLongPress()
      if (moved && dragActive && pinnedThisGesture) {
        const pos = dragOverridesRef.current.get(personId)
        if (pos) {
          // World units → pixel units (the scale 2D's d3-force uses)
          const pinned_x = pos[0] / WORLD_SCALE
          const pinned_y = pos[2] / WORLD_SCALE
          updatePerson.mutate({ id: personId, pinned_x, pinned_y })
        }
        dragMovedRef.current = true
        // Clear the click-suppression flag a tick later so onClick fires after this returns
        setTimeout(() => { dragMovedRef.current = false }, 0)
      }
      cleanup()
    }

    function cleanup() {
      // Keep override on screen briefly so the avatar doesn't snap before DB roundtrip
      // — react-query's onSuccess will refresh `people` with the new pinned position,
      //   and the next render's `placedPeople` recomputation will match the override.
      // Then we can clear it.
      setTimeout(() => { dragOverridesRef.current.delete(personId) }, 600)
      setPressedId(null)
      if (controlsRef.current) controlsRef.current.enabled = true
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }, [connectMode, setConnectFromId, setConnectMode, updatePerson])

  const showLoading = isLoading
  const showEmpty   = !isLoading && people.length === 0

  return (
    <div className="relative w-full h-full overflow-hidden bg-app">
      <Toolbar />

      <ConnectModeBanner
        active={connectMode}
        sourceName={connectFromId ? people.find(p => p.id === connectFromId)?.display_name ?? null : null}
        onCancel={() => { setConnectMode(false); setConnectFromId(null) }}
      />

      <Canvas
        shadows
        camera={{ position: [6, 6, 7], fov: 42 }}
        onPointerDown={(e) => { pointerDownRef.current = { x: e.clientX, y: e.clientY } }}
        onPointerMissed={(e) => {
          // Click on empty space (no avatar hit) → close detail panel.
          // Skip if the user actually panned the camera.
          const start = pointerDownRef.current
          pointerDownRef.current = null
          if (!start) return
          const me = e as unknown as MouseEvent
          const dist = Math.hypot(me.clientX - start.x, me.clientY - start.y)
          if (dist > 6) return
          setSelectedPersonId(null)
        }}
      >
        <Suspense fallback={null}>
          <Scene
            people={placedPeople}
            connections={connections}
            onPersonClick={onPersonClick}
            onPersonPointerDown={onPersonPointerDown}
            hoveredPersonId={hoveredPersonId}
            setHovered={setHoveredPersonId}
            pressedId={pressedId}
            dragOverridesRef={dragOverridesRef}
            liveMotionRef={liveMotionRef}
            controlsRef={controlsRef}
            sceneRefsRef={sceneRefsRef}
          />
        </Suspense>
      </Canvas>

      {/* Stats footer */}
      {!showLoading && !showEmpty && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted bg-surface/85 backdrop-blur border border-border rounded px-2.5 py-1 pointer-events-none">
          {people.length} személy · {connections.length} kapcsolat
        </div>
      )}

      {/* Loading overlay */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-app/80 backdrop-blur-sm pointer-events-none z-30">
          <div className="text-center">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted text-sm">3D nézet betöltése…</p>
          </div>
        </div>
      )}

      {/* Empty overlay */}
      {showEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-30">
          <span className="text-4xl mb-4 opacity-30 select-none">⬡</span>
          <p className="text-text font-medium mb-1">Üres szoba</p>
          <p className="text-muted text-sm mb-5 max-w-xs">
            Adj hozzá személyeket — 3D-ben is ugyanúgy megjelennek, mint a 2D nézetben.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => setCreatePersonOpen(true)}>
              <UserPlus size={13} /> Új személy
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setActiveView("import")}>
              Importálás
            </Button>
          </div>
        </div>
      )}

      {pendingConn && (
        <ConnectionDialog
          fromId={pendingConn.fromId}
          toId={pendingConn.toId}
          people={people}
          onConfirm={async (type, strength, context) => {
            try {
              await createConn.mutateAsync({ from_id: pendingConn.fromId, to_id: pendingConn.toId, type, strength, context })
              toast.success("Kapcsolat létrejött")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Hiba a mentésnél")
            }
            setPendingConn(null)
            setConnectFromId(null)
            setConnectMode(false)
          }}
          onCancel={() => {
            setPendingConn(null)
            setConnectFromId(null)
          }}
        />
      )}
    </div>
  )
}
