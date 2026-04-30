import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { ContactShadows, Float, Html, Line, OrbitControls } from "@react-three/drei"
import { Suspense, useMemo, useRef, useCallback, useState } from "react"
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
  person, selected, dimmed, isSource, hovered, onSelect,
}: {
  person: PersonWithPos
  selected: boolean
  dimmed: boolean
  isSource: boolean
  hovered: boolean
  onSelect: (e: ThreeEvent<MouseEvent>) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef<THREE.Group>(null)
  const ringRef  = useRef<THREE.Mesh>(null)
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

  // Per-frame: idle bob, scale tween (hover/select), pulsing selection ring
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.6 + walkPhase) * 0.020
    }
    if (scaleRef.current) {
      const target = selected ? 1.08 : hovered ? 1.02 : 1.0
      const cur = scaleRef.current.scale.x
      const next = THREE.MathUtils.lerp(cur, target, 0.18)
      scaleRef.current.scale.setScalar(next)
    }
    if (ringRef.current && (selected || isSource)) {
      const s = 1 + Math.sin(t * 2.4) * 0.05
      ringRef.current.scale.x = s
      ringRef.current.scale.z = s
    } else if (ringRef.current) {
      ringRef.current.scale.x = 1
      ringRef.current.scale.z = 1
    }
  })

  return (
    <group position={person.pos} onClick={onSelect}>
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
            <mesh position={[-0.075, 0.025, 0.018]} scale={[1.4, 0.5, 1.7]} castShadow>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={footColor} roughness={0.7} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.075, 0.025, 0.018]} scale={[1.4, 0.5, 1.7]} castShadow>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={footColor} roughness={0.7} transparent opacity={opacity} />
            </mesh>

            {/* Legs — slim capsules */}
            <mesh position={[-0.075, 0.27, 0]} castShadow>
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
            <mesh position={[0.075, 0.27, 0]} castShadow>
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
            <mesh position={[0, 0.78, 0]} scale={[1, 1, 0.78]} castShadow>
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
            <mesh position={[-0.245, 0.83, 0.015]} rotation={[0, 0, 0.10]} castShadow>
              <capsuleGeometry args={[0.048, 0.40, 8, 16]} />
              <meshPhysicalMaterial color={torsoColor} roughness={0.6} clearcoat={0.14} clearcoatRoughness={0.4} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.245, 0.83, 0.015]} rotation={[0, 0, -0.10]} castShadow>
              <capsuleGeometry args={[0.048, 0.40, 8, 16]} />
              <meshPhysicalMaterial color={torsoColor} roughness={0.6} clearcoat={0.14} clearcoatRoughness={0.4} transparent opacity={opacity} />
            </mesh>

            {/* Hands — small skin-tone spheres at the end of each arm */}
            <mesh position={[-0.295, 0.60, 0.025]} castShadow>
              <sphereGeometry args={[0.062, 16, 16]} />
              <meshStandardMaterial color={skin} roughness={0.6} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.295, 0.60, 0.025]} castShadow>
              <sphereGeometry args={[0.062, 16, 16]} />
              <meshStandardMaterial color={skin} roughness={0.6} transparent opacity={opacity} />
            </mesh>

            {/* Neck — short tapered cylinder, skin shadow tone */}
            <mesh position={[0, 1.115, 0]} castShadow>
              <cylinderGeometry args={[0.058, 0.07, 0.07, 16]} />
              <meshStandardMaterial color={skinShadow} roughness={0.65} transparent opacity={opacity} />
            </mesh>

            {/* HEAD — sphere, skin tone, with subtle clearcoat for the porcelain feel */}
            <mesh position={[0, 1.27, 0]} castShadow>
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
              <mesh position={[0, 1.30, -0.025]} scale={[1.13, 0.86, 1.08]} castShadow>
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
function ConnectionBeam({
  connection, fromPos, toPos, color, dimmed, selected,
}: {
  connection: Connection
  fromPos: [number, number, number]
  toPos: [number, number, number]
  color: string
  dimmed: boolean
  selected: boolean
}) {
  const points = useMemo(() => {
    // Beams anchor at chest center (~0.85), not at the head — keeps the 'light bridge' arc
    // visually clear of the figure's head and reads as a connection between people, not heads.
    const a = new THREE.Vector3(fromPos[0], 0.85, fromPos[2])
    const b = new THREE.Vector3(toPos[0], 0.85, toPos[2])
    const mid = a.clone().lerp(b, 0.5)
    mid.y += Math.max(0.4, a.distanceTo(b) * 0.18)
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    return curve.getPoints(30)
  }, [fromPos, toPos])

  const strength = connection.strength ?? 3
  return (
    <Line
      points={points}
      color={color}
      lineWidth={selected ? Math.max(2.2, strength * 0.8) : 1.4}
      transparent
      opacity={dimmed ? 0.08 : selected ? 0.95 : 0.55}
      dashed={strength <= 2}
      dashSize={0.12}
      gapSize={0.08}
    />
  )
}

// (Group zone discs were a 3D-only visual; removed for parity with the 2D view.
//  The GROUP_3D centers above are still used as the seed positions for `placeInGroup`.)

// ── Main scene ─────────────────────────────────────────────
function Scene({
  people, connections, onPersonClick, hoveredPersonId, setHovered,
}: {
  people: PersonWithPos[]
  connections: Connection[]
  onPersonClick: (id: string) => void
  hoveredPersonId: string | null
  setHovered: (id: string | null) => void
}) {
  const { selectedPersonId, connectFromId } = useAppStore()

  const positionMap = useMemo(() => {
    const m = new Map<string, [number, number, number]>()
    people.forEach(p => m.set(p.id, p.pos))
    return m
  }, [people])

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
        const fromPos = positionMap.get(c.from_id)
        const toPos   = positionMap.get(c.to_id)
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
              dimmed={!!dimmed}
              onSelect={(e) => { e.stopPropagation(); onPersonClick(p.id) }}
            />
          </group>
        )
      })}

      {/* One big contact shadow under the whole scene — gives every avatar a soft
          catalog-style foot shadow without needing a visible floor. */}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.32} scale={50} blur={2.0} far={2.0} resolution={1024} color="#0f172a" />
      {/* No Environment HDRI — keeps the look matte / clean instead of cinematic. */}
      <OrbitControls
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

  const placedPeople = useMemo(() => computePositions(people), [people])

  const onPersonClick = useCallback((personId: string) => {
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

  // Quietly mute the unused-warning for updatePerson — wire up later if we add 3D drag-to-pin
  void updatePerson

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

      <Canvas shadows camera={{ position: [6, 6, 7], fov: 42 }}>
        <Suspense fallback={null}>
          <Scene
            people={placedPeople}
            connections={connections}
            onPersonClick={onPersonClick}
            hoveredPersonId={hoveredPersonId}
            setHovered={setHoveredPersonId}
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
