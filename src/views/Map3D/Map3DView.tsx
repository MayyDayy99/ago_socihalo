import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { ContactShadows, Environment, Float, Html, Line, OrbitControls, RoundedBox, Text } from "@react-three/drei"
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

// ── 3D person avatar ───────────────────────────────────────
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

  const groupColor = person.group_key ? GROUPS[person.group_key]?.color : "#6B7280"
  // Deterministic gender variant for visual variety
  const isFemale = person.idHash > 0.5
  const skin = "#f0c2a4"
  const body = isFemale ? "#d986ff" : "#62b8ff"

  const opacity = dimmed ? 0.28 : 1
  const ringColor = isSource ? "#D97706" : selected ? "#111827" : (groupColor ?? "#6B7280")

  return (
    <group position={person.pos} onClick={onSelect}>
      <Float speed={1.2} rotationIntensity={0.05} floatIntensity={selected || isSource ? 0.18 : 0.05}>
        <group ref={groupRef}>
          {/* Floor ring under the person — colored by group/state */}
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.62, 64]} />
            <meshBasicMaterial color={ringColor} transparent opacity={isSource ? 0.85 : selected ? 0.7 : 0.18 * opacity} />
          </mesh>

          {/* Torso */}
          <mesh position={[0, 0.3, 0]} scale={[0.22, 0.55, 0.18]}>
            <capsuleGeometry args={[1, 1.25, 8, 18]} />
            <meshStandardMaterial color={body} roughness={0.38} metalness={0.05} transparent opacity={opacity} />
          </mesh>

          {/* Arms */}
          <mesh position={[-0.34, 0.66, 0]} rotation={[0, 0, selected ? -0.32 : -0.12]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial color={body} roughness={0.42} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.34, 0.66, 0]} rotation={[0, 0, selected ? 0.32 : 0.12]}>
            <capsuleGeometry args={[0.055, 0.36, 6, 10]} />
            <meshStandardMaterial color={body} roughness={0.42} transparent opacity={opacity} />
          </mesh>

          {/* Legs */}
          <mesh position={[-0.13, -0.3, 0]} rotation={[0, 0, Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial color="#2b344e" roughness={0.5} transparent opacity={opacity} />
          </mesh>
          <mesh position={[0.13, -0.3, 0]} rotation={[0, 0, -Math.sin(walkPhase) * 0.12]}>
            <capsuleGeometry args={[0.065, 0.42, 6, 10]} />
            <meshStandardMaterial color="#2b344e" roughness={0.5} transparent opacity={opacity} />
          </mesh>

          {/* Head */}
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.22, 32, 32]} />
            <meshStandardMaterial color={skin} roughness={0.46} transparent opacity={opacity} />
          </mesh>

          {/* Hair */}
          {isFemale ? (
            <mesh position={[0, 1.14, -0.03]} scale={[1.18, 0.68, 1.04]}>
              <sphereGeometry args={[0.24, 32, 16]} />
              <meshStandardMaterial color="#312033" roughness={0.54} transparent opacity={opacity} />
            </mesh>
          ) : (
            <mesh position={[0, 1.23, -0.01]} scale={[1.05, 0.38, 0.96]}>
              <sphereGeometry args={[0.23, 32, 16]} />
              <meshStandardMaterial color="#252232" roughness={0.54} transparent opacity={opacity} />
            </mesh>
          )}

          {/* Name label floating above */}
          <Html position={[0, 1.62, 0]} center distanceFactor={7.2} style={{ pointerEvents: "none" }}>
            <div className={`person3d-label ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""} ${isSource ? "source" : ""}`}>
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
      lineWidth={selected ? Math.max(1.8, strength * 0.7) : 1}
      transparent
      opacity={dimmed ? 0.06 : selected ? 0.95 : 0.32}
      dashed={strength <= 2}
      dashSize={0.12}
      gapSize={0.08}
    />
  )
}

// ── Group zone discs on the floor ──────────────────────────
function GroupZones({ counts }: { counts: Map<GroupKey, number> }) {
  return (
    <>
      {(Object.keys(GROUP_3D) as GroupKey[]).map(k => {
        const c = counts.get(k) ?? 0
        if (c === 0) return null
        const [cx, cz] = GROUP_3D[k].center
        const color = GROUPS[k].color
        const r = Math.min(2.0, 0.8 + c * 0.18)
        return (
          <group key={k}>
            <mesh position={[cx, 0.012, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[r, 64]} />
              <meshBasicMaterial color={color} transparent opacity={0.07} />
            </mesh>
            <Text position={[cx, 0.035, cz - r - 0.3]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color={color}>
              {GROUPS[k].label}
            </Text>
          </group>
        )
      })}
    </>
  )
}

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

  const groupCounts = useMemo(() => {
    const m = new Map<GroupKey, number>()
    people.forEach(p => {
      if (p.group_key) m.set(p.group_key, (m.get(p.group_key) ?? 0) + 1)
    })
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
      <color attach="background" args={["#050813"]} />
      <fog attach="fog" args={["#050813", 8, 18]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 5]} intensity={2.0} castShadow />
      <pointLight position={[0, 3, -2]} intensity={1.4} color="#7ed3ff" />
      <pointLight position={[-4, 2.2, 4]} intensity={0.9} color="#d986ff" />

      {/* Floor + walls */}
      <RoundedBox args={[11, 0.12, 9]} radius={0.12} position={[0, -0.08, 0]} receiveShadow>
        <meshStandardMaterial color="#111827" roughness={0.72} metalness={0.1} />
      </RoundedBox>
      <gridHelper args={[11, 22, "#263653", "#182238"]} position={[0, 0.004, 0]} />
      <RoundedBox args={[11, 3.1, 0.14]} radius={0.12} position={[0, 1.45, -4.5]}>
        <meshStandardMaterial color="#0c1220" roughness={0.82} metalness={0.04} transparent opacity={0.82} />
      </RoundedBox>
      <RoundedBox args={[0.14, 3.1, 9]} radius={0.12} position={[-5.5, 1.45, 0]}>
        <meshStandardMaterial color="#0b101c" roughness={0.86} metalness={0.04} transparent opacity={0.78} />
      </RoundedBox>

      <GroupZones counts={groupCounts} />

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

      <ContactShadows position={[0, -0.01, 0]} opacity={0.42} scale={11} blur={2.4} far={3.2} />
      <Environment preset="city" />
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
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#050813" }}>
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 backdrop-blur border border-white/10 rounded px-2.5 py-1 pointer-events-none">
          {people.length} személy · {connections.length} kapcsolat · 3D nézet
        </div>
      )}

      {/* Loading overlay */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none z-30">
          <div className="text-center">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/70 text-sm">3D szoba betöltése…</p>
          </div>
        </div>
      )}

      {/* Empty overlay */}
      {showEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-30">
          <span className="text-4xl mb-4 opacity-50 select-none">⬡</span>
          <p className="text-white font-medium mb-1">Üres szoba</p>
          <p className="text-white/60 text-sm mb-5 max-w-xs">
            Adj hozzá személyeket — 3D-ben fognak megjelenni a csoportjuk zónájában.
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
