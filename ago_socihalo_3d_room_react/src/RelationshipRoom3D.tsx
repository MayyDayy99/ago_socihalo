import { Canvas, useFrame } from "@react-three/fiber"
import { ContactShadows, Environment, Float, Html, Line, OrbitControls, RoundedBox, Text } from "@react-three/drei"
import { Suspense, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { Search, Users, Building2, HeartHandshake, Activity } from "lucide-react"

type Group = "family" | "work" | "friend"
type Gender = "male" | "female"

type Person3D = {
  id: string
  name: string
  gender: Gender
  group: Group
  role: string
  strength: number
  lastContact: string
  position: [number, number, number]
}

type Connection3D = {
  from: string
  to: string
  type: Group
  strength: number
}

const people: Person3D[] = [
  { id: "agi", name: "Ági", gender: "female", group: "family", role: "Központi személy", strength: 96, lastContact: "ma", position: [0, 0, 0] },
  { id: "peti", name: "Peti", gender: "male", group: "family", role: "Társ", strength: 94, lastContact: "ma", position: [-2.1, 0, -1.4] },
  { id: "lili", name: "Lili", gender: "female", group: "family", role: "Család", strength: 89, lastContact: "tegnap", position: [-3.1, 0, .7] },
  { id: "marci", name: "Marci", gender: "male", group: "friend", role: "Barát", strength: 72, lastContact: "3 napja", position: [-1.3, 0, 2.6] },
  { id: "nora", name: "Nóra", gender: "female", group: "friend", role: "Barát", strength: 68, lastContact: "1 hete", position: [.8, 0, 3.1] },
  { id: "eszter", name: "Eszter", gender: "female", group: "friend", role: "Régi barát", strength: 41, lastContact: "1 hónapja", position: [-3.3, 0, 2.2] },
  { id: "dani", name: "Dani", gender: "male", group: "work", role: "Munkatárs", strength: 64, lastContact: "ma", position: [2.2, 0, -1.7] },
  { id: "kata", name: "Kata", gender: "female", group: "work", role: "Projekt partner", strength: 78, lastContact: "2 napja", position: [3.35, 0, -.1] },
  { id: "balazs", name: "Balázs", gender: "male", group: "work", role: "Ügyfél", strength: 48, lastContact: "2 hete", position: [2.15, 0, 1.55] },
  { id: "tamas", name: "Tamás", gender: "male", group: "work", role: "Ismerős", strength: 34, lastContact: "2 hónapja", position: [3.65, 0, 2.65] },
]

const connections: Connection3D[] = [
  { from: "agi", to: "peti", type: "family", strength: 96 },
  { from: "agi", to: "lili", type: "family", strength: 89 },
  { from: "peti", to: "lili", type: "family", strength: 84 },
  { from: "agi", to: "marci", type: "friend", strength: 72 },
  { from: "marci", to: "nora", type: "friend", strength: 68 },
  { from: "agi", to: "nora", type: "friend", strength: 58 },
  { from: "agi", to: "eszter", type: "friend", strength: 41 },
  { from: "agi", to: "dani", type: "work", strength: 64 },
  { from: "dani", to: "kata", type: "work", strength: 78 },
  { from: "kata", to: "balazs", type: "work", strength: 48 },
  { from: "balazs", to: "tamas", type: "work", strength: 34 },
  { from: "peti", to: "dani", type: "work", strength: 37 },
]

const groupColor: Record<Group, string> = {
  family: "#ffb86b",
  work: "#7ed3ff",
  friend: "#84f5b7",
}

const genderColor: Record<Gender, string> = {
  male: "#62b8ff",
  female: "#d986ff",
}

const groupLabel: Record<Group, string> = {
  family: "Család",
  work: "Munka",
  friend: "Barátok",
}

function personById(id: string) {
  return people.find((p) => p.id === id)!
}

function isConnected(selectedId: string, id: string) {
  return selectedId === id || connections.some((c) =>
    (c.from === selectedId && c.to === id) || (c.to === selectedId && c.from === id)
  )
}

function ConnectionBeam({ connection, selectedId, filter }: { connection: Connection3D; selectedId: string; filter: "all" | Group | "hot" | "weak" }) {
  const from = personById(connection.from)
  const to = personById(connection.to)
  const active = connection.from === selectedId || connection.to === selectedId
  const visibleByFilter =
    filter === "all" ||
    filter === connection.type ||
    (filter === "hot" && connection.strength >= 70) ||
    (filter === "weak" && connection.strength < 55)

  const points = useMemo(() => {
    const a = new THREE.Vector3(from.position[0], .92, from.position[2])
    const b = new THREE.Vector3(to.position[0], .92, to.position[2])
    const mid = a.clone().lerp(b, .5)
    mid.y += Math.max(.45, a.distanceTo(b) * .18)
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    return curve.getPoints(36)
  }, [from, to])

  return (
    <Line
      points={points}
      color={groupColor[connection.type]}
      lineWidth={active ? Math.max(1.8, connection.strength / 26) : 1}
      transparent
      opacity={visibleByFilter ? (active ? .96 : .22) : .04}
      dashed={connection.strength < 55}
      dashSize={.12}
      gapSize={.08}
    />
  )
}

function PersonAvatar({
  person,
  selected,
  dimmed,
  onSelect,
}: {
  person: Person3D
  selected: boolean
  dimmed: boolean
  onSelect: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const walkPhase = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.getElapsedTime()
    const bob = Math.sin(t * 2.25 + walkPhase) * .045
    const sway = Math.sin(t * 1.15 + walkPhase) * .035
    group.current.position.y = bob
    group.current.rotation.y = sway
  })

  const color = genderColor[person.gender]
  const opacity = dimmed ? .28 : 1

  return (
    <group position={person.position} onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <Float speed={1.2} rotationIntensity={.05} floatIntensity={selected ? .18 : .05}>
        <group ref={group}>
          <mesh position={[0, .08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[.45, .62, 64]} />
            <meshBasicMaterial color={selected ? "#b7ecff" : groupColor[person.group]} transparent opacity={selected ? .95 : .18 * opacity} />
          </mesh>

          <mesh position={[0, .3, 0]} scale={[.22, .55, .18]}>
            <capsuleGeometry args={[1, 1.25, 8, 18]} />
            <meshStandardMaterial color={color} roughness={.38} metalness={.05} transparent opacity={opacity} />
          </mesh>

          <mesh position={[-.34, .66, 0]} rotation={[0, 0, selected ? -.32 : -.12]}>
            <capsuleGeometry args={[.055, .36, 6, 10]} />
            <meshStandardMaterial color={color} roughness={.42} transparent opacity={opacity} />
          </mesh>
          <mesh position={[.34, .66, 0]} rotation={[0, 0, selected ? .32 : .12]}>
            <capsuleGeometry args={[.055, .36, 6, 10]} />
            <meshStandardMaterial color={color} roughness={.42} transparent opacity={opacity} />
          </mesh>

          <mesh position={[-.13, -.3, 0]} rotation={[0, 0, Math.sin(walkPhase) * .12]}>
            <capsuleGeometry args={[.065, .42, 6, 10]} />
            <meshStandardMaterial color="#2b344e" roughness={.5} transparent opacity={opacity} />
          </mesh>
          <mesh position={[.13, -.3, 0]} rotation={[0, 0, -Math.sin(walkPhase) * .12]}>
            <capsuleGeometry args={[.065, .42, 6, 10]} />
            <meshStandardMaterial color="#2b344e" roughness={.5} transparent opacity={opacity} />
          </mesh>

          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[.22, 32, 32]} />
            <meshStandardMaterial color="#f1c4a8" roughness={.46} transparent opacity={opacity} />
          </mesh>

          {person.gender === "female" ? (
            <mesh position={[0, 1.14, -.03]} scale={[1.18, .68, 1.04]}>
              <sphereGeometry args={[.24, 32, 16]} />
              <meshStandardMaterial color="#312033" roughness={.54} transparent opacity={opacity} />
            </mesh>
          ) : (
            <mesh position={[0, 1.23, -.01]} scale={[1.05, .38, .96]}>
              <sphereGeometry args={[.23, 32, 16]} />
              <meshStandardMaterial color="#252232" roughness={.54} transparent opacity={opacity} />
            </mesh>
          )}

          <Html position={[0, 1.58, 0]} center distanceFactor={7.2} style={{ pointerEvents: "none" }}>
            <div className={`person-label ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}>
              {person.name}
            </div>
          </Html>
        </group>
      </Float>
    </group>
  )
}

function RoomZones() {
  return (
    <>
      <mesh position={[-2.6, .012, -.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.7, 64]} />
        <meshBasicMaterial color={groupColor.family} transparent opacity={.065} />
      </mesh>
      <Text position={[-2.7, .035, -2.65]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.18} color="#ffcf95">
        Család
      </Text>

      <mesh position={[2.7, .012, .75]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 64]} />
        <meshBasicMaterial color={groupColor.work} transparent opacity={.06} />
      </mesh>
      <Text position={[3.15, .035, -2.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.18} color="#b7ecff">
        Munka
      </Text>

      <mesh position={[-1.5, .012, 2.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.9, 64]} />
        <meshBasicMaterial color={groupColor.friend} transparent opacity={.06} />
      </mesh>
      <Text position={[-2.15, .035, 4.25]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.18} color="#bafbd6">
        Barátok
      </Text>
    </>
  )
}

function VirtualRoom({
  selectedId,
  setSelectedId,
  filter,
}: {
  selectedId: string
  setSelectedId: (id: string) => void
  filter: "all" | Group | "hot" | "weak"
}) {
  return (
    <>
      <color attach="background" args={["#050813"]} />
      <fog attach="fog" args={["#050813", 7, 15]} />
      <ambientLight intensity={.75} />
      <directionalLight position={[3, 6, 5]} intensity={2.2} castShadow />
      <pointLight position={[0, 3, -2]} intensity={1.6} color="#7ed3ff" />
      <pointLight position={[-4, 2.2, 4]} intensity={1.1} color="#d986ff" />

      <group>
        <RoundedBox args={[9, .12, 7]} radius={.12} position={[0, -.08, .35]} receiveShadow>
          <meshStandardMaterial color="#111827" roughness={.72} metalness={.1} />
        </RoundedBox>

        <gridHelper args={[9, 18, "#263653", "#182238"]} position={[0, .004, .35]} />

        <RoundedBox args={[9, 3.1, .14]} radius={.12} position={[0, 1.45, -3.18]}>
          <meshStandardMaterial color="#0c1220" roughness={.82} metalness={.04} transparent opacity={.82} />
        </RoundedBox>
        <RoundedBox args={[.14, 3.1, 7]} radius={.12} position={[-4.48, 1.45, .35]}>
          <meshStandardMaterial color="#0b101c" roughness={.86} metalness={.04} transparent opacity={.78} />
        </RoundedBox>

        <RoomZones />

        {connections.map((connection) => (
          <ConnectionBeam key={`${connection.from}-${connection.to}`} connection={connection} selectedId={selectedId} filter={filter} />
        ))}

        {people.map((person) => (
          <PersonAvatar
            key={person.id}
            person={person}
            selected={person.id === selectedId}
            dimmed={!isConnected(selectedId, person.id)}
            onSelect={() => setSelectedId(person.id)}
          />
        ))}
      </group>

      <ContactShadows position={[0, -.01, .35]} opacity={.42} scale={9} blur={2.4} far={3.2} />
      <Environment preset="city" />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={4.2}
        maxDistance={10}
        minPolarAngle={Math.PI * .25}
        maxPolarAngle={Math.PI * .48}
        target={[0, .55, .35]}
      />
    </>
  )
}

function DetailPanel({ person }: { person: Person3D }) {
  const direct = connections
    .filter((c) => c.from === person.id || c.to === person.id)
    .map((c) => ({ connection: c, other: personById(c.from === person.id ? c.to : c.from) }))

  return (
    <aside className="detail-panel">
      <div className="panel-card profile-card">
        <div className="avatar-chip" style={{ background: `linear-gradient(135deg, ${genderColor[person.gender]}, ${groupColor[person.group]})` }}>
          {person.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2>{person.name}</h2>
          <p>{person.role} · {groupLabel[person.group]}</p>
        </div>
      </div>

      <div className="metric-grid">
        <div><strong>{person.strength}%</strong><span>kapcsolati erő</span></div>
        <div><strong>{direct.length}</strong><span>direkt kapcsolat</span></div>
        <div><strong>{person.lastContact}</strong><span>utolsó kontakt</span></div>
        <div><strong>{groupLabel[person.group]}</strong><span>fő zóna</span></div>
      </div>

      <div className="panel-card">
        <h3>Kapcsolatok</h3>
        {direct.map(({ connection, other }) => (
          <div className="relation" key={`${connection.from}-${connection.to}`}>
            <div>
              <strong>{other.name}</strong>
              <span>{groupLabel[connection.type]} · {connection.strength >= 70 ? "erős" : connection.strength < 55 ? "gyenge" : "közepes"}</span>
            </div>
            <div className="bar"><i style={{ width: `${connection.strength}%`, background: groupColor[connection.type] }} /></div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function RelationshipRoom3D() {
  const [selectedId, setSelectedId] = useState("agi")
  const [filter, setFilter] = useState<"all" | Group | "hot" | "weak">("all")
  const [query, setQuery] = useState("")
  const selected = personById(selectedId)

  function runSearch(value: string) {
    setQuery(value)
    const found = people.find((p) =>
      p.name.toLowerCase().includes(value.toLowerCase()) ||
      p.role.toLowerCase().includes(value.toLowerCase()) ||
      groupLabel[p.group].toLowerCase().includes(value.toLowerCase())
    )
    if (found) setSelectedId(found.id)
  }

  return (
    <div className="room-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Users size={19} /></div>
          <div>
            <strong>ago_socihalo</strong>
            <span>3D Kapcsolati Szoba</span>
          </div>
        </div>

        <label className="search">
          <Search size={15} />
          <input value={query} onChange={(event) => runSearch(event.target.value)} placeholder="Keresés név, szerep vagy zóna szerint..." />
        </label>

        <nav className="filters">
          {[
            ["all", "Összes", Users],
            ["family", "Család", HeartHandshake],
            ["work", "Munka", Building2],
            ["friend", "Barátok", Users],
            ["hot", "Erős", Activity],
            ["weak", "Gyenge", Activity],
          ].map(([id, label, Icon]) => (
            <button key={id as string} className={filter === id ? "active" : ""} onClick={() => setFilter(id as typeof filter)}>
              <Icon size={14} /> {label as string}
            </button>
          ))}
        </nav>
      </header>

      <main className="stage">
        <Canvas shadows camera={{ position: [5.2, 5.2, 6.2], fov: 42 }}>
          <Suspense fallback={null}>
            <VirtualRoom selectedId={selectedId} setSelectedId={setSelectedId} filter={filter} />
          </Suspense>
        </Canvas>

        <div className="hud">
          <div><strong>3D motor:</strong> React Three Fiber</div>
          <div><strong>Mozgás:</strong> finom lebegés + emberi test animáció</div>
          <div><strong>Kapcsolat:</strong> térbeli fényívek</div>
        </div>
      </main>

      <DetailPanel person={selected} />
    </div>
  )
}
