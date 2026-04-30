import { useMemo } from "react"
import { Environment } from "@react-three/drei"
import { type ThreeEvent } from "@react-three/fiber"
import type { Person, Connection } from "../../../store/types"
import PersonAvatar from "./PersonAvatar"
import ConnectionEdge from "./ConnectionEdge"
import FloorAndWalls from "./FloorAndWalls"
import GroupZones from "./GroupZones"
import CameraRig from "./CameraRig"
import type { Pos } from "../hooks/useForceLayout"
import type { ModeTween } from "../hooks/useModeTween"

interface SceneProps {
  people: Person[]
  connections: Connection[]
  positionsRef: React.MutableRefObject<Map<string, Pos>>
  modeTween: ModeTween
  selectedPersonId: string | null
  connectFromId: string | null
  connectMode: boolean
  hoveredId: string | null
  pressedId: string | null
  pathSet: Set<string> | null
  onPersonClick: (id: string, e: ThreeEvent<MouseEvent>) => void
  onPersonPointerDown: (id: string, e: ThreeEvent<PointerEvent>) => void
  onPersonHover: (id: string | null) => void
}

export default function UnifiedScene({
  people, connections, positionsRef, modeTween,
  selectedPersonId, connectFromId, connectMode,
  hoveredId, pressedId, pathSet,
  onPersonClick, onPersonPointerDown, onPersonHover,
}: SceneProps) {
  const neighborSet = useMemo(() => {
    if (!hoveredId) return null
    const s = new Set<string>([hoveredId])
    for (const c of connections) {
      if (c.from_id === hoveredId) s.add(c.to_id)
      if (c.to_id === hoveredId) s.add(c.from_id)
    }
    return s
  }, [hoveredId, connections])

  return (
    <>
      <color attach="background" args={["#050813"]} />
      <fog attach="fog" args={["#050813", 9, 22]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 5]} intensity={2.0} castShadow />
      <pointLight position={[0, 3, -2]} intensity={1.2} color="#7ed3ff" />
      <pointLight position={[-4, 2.2, 4]} intensity={0.9} color="#d986ff" />

      <FloorAndWalls modeTween={modeTween} />
      <GroupZones people={people} modeTween={modeTween} />

      {/* Edges */}
      {connections.map(c => {
        const isAdjacentToSelected =
          selectedPersonId !== null &&
          (c.from_id === selectedPersonId || c.to_id === selectedPersonId)
        const isAdjacentToHover =
          hoveredId !== null &&
          (c.from_id === hoveredId || c.to_id === hoveredId)
        const dimmed = (selectedPersonId !== null && !isAdjacentToSelected) ||
                       (hoveredId !== null && !isAdjacentToHover)
        const inPath = pathSet ? (pathSet.has(c.from_id) && pathSet.has(c.to_id)) : false
        return (
          <ConnectionEdge
            key={c.id}
            connection={c}
            positionsRef={positionsRef}
            modeTween={modeTween}
            isDimmed={dimmed}
            isPathHighlighted={inPath}
            isAdjacentToSelected={isAdjacentToSelected}
          />
        )
      })}

      {/* Avatars */}
      {people.map(p => {
        const isSel = selectedPersonId === p.id
        const isSrc = connectFromId === p.id
        const isDrop = connectMode && !!connectFromId && hoveredId === p.id && connectFromId !== p.id
        const inPath = pathSet?.has(p.id) ?? false
        const dimmed =
          (hoveredId !== null && neighborSet && !neighborSet.has(p.id) && !isSrc) ||
          (selectedPersonId !== null && !isSel && !isSrc &&
            !connections.some(c =>
              (c.from_id === selectedPersonId && c.to_id === p.id) ||
              (c.to_id === selectedPersonId && c.from_id === p.id)
            ))
        return (
          <PersonAvatar
            key={p.id}
            person={p}
            positionsRef={positionsRef}
            modeTween={modeTween}
            isSelected={isSel}
            isConnectSource={isSrc}
            isDropTarget={!!isDrop}
            isPathHighlighted={inPath}
            isDimmed={!!dimmed}
            isPressed={pressedId === p.id}
            onClick={(e) => { e.stopPropagation(); onPersonClick(p.id, e) }}
            onPointerDown={(e) => { e.stopPropagation(); onPersonPointerDown(p.id, e) }}
            onPointerOver={(e) => { e.stopPropagation(); onPersonHover(p.id) }}
            onPointerOut={(e) => { e.stopPropagation(); onPersonHover(null) }}
          />
        )
      })}

      <Environment preset="city" />
      <CameraRig modeTween={modeTween} />
    </>
  )
}
