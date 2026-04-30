import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { Billboard, ContactShadows, Float, Html, Line, OrbitControls, RoundedBox, Text } from "@react-three/drei"
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

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 2.25 + walkPhase) * 0.045
    groupRef.current.rotation.y = Math.sin(t * 1.15 + walkPhase) * 0.035
  })

  const groupColor = person.group_key ? GROUPS[person.group_key]?.color ?? "#6B7280" : "#6B7280"
  const opacity = dimmed ? 0.3 : 1
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

  // Body fill: light gray + faint group tint, matching the 2D node's "white with group tint" body
  const bodyColor = "#E5E7EB"
  const limbColor = "#9CA3AF"

  return (
    <group position={person.pos} onClick={onSelect}>
      <Float speed={1.2} rotationIntensity={0.04} floatIntensity={selected || isSource ? 0.16 : 0.04}>
        <group ref={groupRef}>
          {/* Floor ring — colored by group/state, like the 2D node's outer ring */}
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.5, 64]} />
            <meshBasicMaterial
              color={ringColor}
              transparent
              opacity={isSource ? 0.85 : selected ? 0.65 : 0.4 * opacity}
            />
          </mesh>

          {/* Torso */}
          <mesh position={[0, 0.32, 0]} scale={[0.22, 0.55, 0.18]}>
            <capsuleGeometry args={[1, 1.25, 8, 18]} />
            <meshStandardMaterial color={bodyColor} roughness={0.6} metalness={0.0} transparent opacity={opacity} />
          </mesh>

          {/* Arms */}
          <mesh position={[-0.34, 0.68, 0]} rotation={[0, 0, selected ? -0.32 : -0.12]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial color={limbColor} roughness={0.6} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.34, 0.68, 0]} rotation={[0, 0, selected ? 0.32 : 0.12]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial color={limbColor} roughness={0.6} transparent opacity={opacity} />
          </mesh>

          {/* Legs */}
          <mesh position={[-0.13, -0.28, 0]} rotation={[0, 0, Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial color={limbColor} roughness={0.6} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.13, -0.28, 0]} rotation={[0, 0, -Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial color={limbColor} roughness={0.6} transparent opacity={opacity} />
          </mesh>

          {/* HEAD — Billboard so it always reads as the same flat 2D-style circle from any angle.
              Matches the 2D node: white inner + group-color border + initial letter. */}
          <Billboard position={[0, 1.05, 0]} follow={true}>
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

          {/* Name label below — light office style (light bg + dark text) */}
          <Html position={[0, -0.65, 0]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}>
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
    const a = new THREE.Vector3(fromPos[0], 0.92, fromPos[2])
    const b = new THREE.Vector3(toPos[0], 0.92, toPos[2])
    const mid = a.clone().lerp(b, 0.5)
    mid.y += Math.max(0.45, a.distanceTo(b) * 0.18)
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
      <fog attach="fog" args={["#F5F5F5", 14, 28]} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} castShadow />
      <directionalLight position={[-4, 6, -2]} intensity={0.4} />

      {/* Light floor — matches the 2D map's bg-app + dot grid aesthetic */}
      <RoundedBox args={[14, 0.06, 12]} radius={0.06} position={[0, -0.04, 0]} receiveShadow>
        <meshStandardMaterial color="#FAFAFA" roughness={0.95} metalness={0.0} />
      </RoundedBox>
      {/* Subtle dot/grid hint — same color as 2D's map-canvas radial-gradient dots */}
      <gridHelper args={[14, 28, "#D1D5DB", "#E5E7EB"]} position={[0, 0.005, 0]} />
      {/* Group zones are a 3D-only concept that the 2D view doesn't show — leave them out
          for visual parity. Re-enable later if the user wants them as a colored zoning hint. */}
      {/* <GroupZones counts={groupCounts} /> */}

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

      <ContactShadows position={[0, 0.01, 0]} opacity={0.18} scale={14} blur={2.6} far={3.2} color="#1f2937" />
      {/* No Environment HDRI — keeps the look matte / office-clean instead of cinematic. */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={5}
        maxDistance={14}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 0.5, 0]}
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
