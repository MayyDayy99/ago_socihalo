import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { Billboard, ContactShadows, Float, Html, Line, OrbitControls, Text } from "@react-three/drei"
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

// ── 3D person avatar — head matches the 2D node, body grounds it in 3D ────
function PersonAvatar({
  person, selected, dimmed, isSource, onSelect,
}: {
  person: PersonWithPos
  selected: boolean
  dimmed: boolean
  isSource: boolean
  onSelect: (e: ThreeEvent<MouseEvent>) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const walkPhase = person.idHash * Math.PI * 2

  // Subtle vertical bob only — no rotation sway (cleaner, calmer look)
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 1.6 + walkPhase) * 0.022
  })

  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const opacity = dimmed ? 0.32 : 1
  const ringColor = isSource ? "#D97706" : selected ? "#111827" : groupColor
  const ringWidth = isSource ? 0.06 : selected ? 0.05 : 0.04

  // Initial letter (matches 2D node)
  const initials = person.display_name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  // Subtle palette — body slightly lighter than limbs so the silhouette reads
  const bodyColor = "#E5E7EB"
  const limbColor = "#B5BBC5"
  const jointColor = "#CBD0D8"

  // Refined proportions — taller, slimmer, arms hanging naturally close to body.
  // Total height ~1.7 units (head top ≈ 1.32, feet bottom ≈ -0.42).
  return (
    <group position={person.pos} onClick={onSelect}>
      <Float speed={1.0} rotationIntensity={0.02} floatIntensity={selected || isSource ? 0.10 : 0.03}>
        <group ref={groupRef}>
          {/* Floor ring — colored by group/state, like the 2D node's outer ring */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.36, 0.44, 64]} />
            <meshBasicMaterial
              color={ringColor}
              transparent
              opacity={isSource ? 0.85 : selected ? 0.65 : 0.32 * opacity}
            />
          </mesh>

          {/* Torso — taller, slimmer capsule */}
          <mesh position={[0, 0.5, 0]} scale={[0.20, 0.78, 0.15]} castShadow>
            <capsuleGeometry args={[1, 1.20, 12, 24]} />
            <meshStandardMaterial color={bodyColor} roughness={0.55} metalness={0} transparent opacity={opacity} />
          </mesh>

          {/* Shoulder caps — small spheres that smooth the torso→arm transition */}
          <mesh position={[-0.20, 0.83, 0]} castShadow>
            <sphereGeometry args={[0.062, 16, 16]} />
            <meshStandardMaterial color={jointColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.20, 0.83, 0]} castShadow>
            <sphereGeometry args={[0.062, 16, 16]} />
            <meshStandardMaterial color={jointColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>

          {/* Arms — slim, hanging naturally (very small outward angle) */}
          <mesh position={[-0.20, 0.55, 0]} rotation={[0, 0, -0.045]} castShadow>
            <capsuleGeometry args={[0.045, 0.5, 8, 16]} />
            <meshStandardMaterial color={limbColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.20, 0.55, 0]} rotation={[0, 0, 0.045]} castShadow>
            <capsuleGeometry args={[0.045, 0.5, 8, 16]} />
            <meshStandardMaterial color={limbColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>

          {/* Hip joint — small smoothing sphere where torso meets legs */}
          <mesh position={[0, 0.07, 0]} scale={[1.1, 0.7, 0.95]} castShadow>
            <sphereGeometry args={[0.10, 16, 16]} />
            <meshStandardMaterial color={jointColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>

          {/* Legs — longer, narrow, close together */}
          <mesh position={[-0.07, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.46, 8, 16]} />
            <meshStandardMaterial color={limbColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.07, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.46, 8, 16]} />
            <meshStandardMaterial color={limbColor} roughness={0.55} transparent opacity={opacity} />
          </mesh>

          {/* HEAD — Billboard so it always reads as the same flat 2D-style circle from any angle.
              Matches the 2D node: white inner + group-color border + initial letter. */}
          <Billboard position={[0, 1.18, 0]} follow={true}>
            {/* Soft halo for selection / source — hidden when neither */}
            {(isSource || selected) && (
              <mesh position={[0, 0, -0.001]}>
                <circleGeometry args={[0.34, 32]} />
                <meshBasicMaterial color={ringColor} transparent opacity={isSource ? 0.18 : 0.12} />
              </mesh>
            )}
            {/* White inner disc */}
            <mesh>
              <circleGeometry args={[0.24, 48]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={opacity} />
            </mesh>
            {/* Light group-color tint inside, matching 2D's fillOpacity 0.12 */}
            <mesh position={[0, 0, 0.001]}>
              <circleGeometry args={[0.24, 48]} />
              <meshBasicMaterial color={groupColor} transparent opacity={0.12 * opacity} />
            </mesh>
            {/* Group color ring (border) */}
            <mesh position={[0, 0, 0.002]}>
              <ringGeometry args={[0.24, 0.24 + ringWidth, 48]} />
              <meshBasicMaterial color={ringColor} transparent opacity={opacity} />
            </mesh>
            {/* Initial letter — group color, matches 2D node */}
            <Text
              position={[0, 0, 0.003]}
              fontSize={0.18}
              color={groupColor}
              anchorX="center"
              anchorY="middle"
              fontWeight={700}
            >
              {initials}
            </Text>
          </Billboard>

          {/* Name label above head — light office style (light bg + dark text) */}
          <Html position={[0, 1.62, 0]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}>
            <div className={`person3d-label-light ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""} ${isSource ? "source" : ""}`}>
              {person.display_name}
            </div>
          </Html>

          {/* Invisible larger hit cylinder so touch clicks land on the figure even at distance */}
          <mesh position={[0, 0.5, 0]} visible={false}>
            <cylinderGeometry args={[0.36, 0.36, 1.7, 12]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
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
    // Beams now anchor to the head Billboard height (y=1.18), not the old 0.92 sphere center.
    const a = new THREE.Vector3(fromPos[0], 1.18, fromPos[2])
    const b = new THREE.Vector3(toPos[0], 1.18, toPos[2])
    const mid = a.clone().lerp(b, 0.5)
    mid.y += Math.max(0.35, a.distanceTo(b) * 0.16)
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
        target={[0, 0.7, 0]}
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
