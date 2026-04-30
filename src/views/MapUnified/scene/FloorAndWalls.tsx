import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import type { ModeTween } from "../hooks/useModeTween"
import { tickTween } from "../hooks/useModeTween"

interface FloorAndWallsProps {
  modeTween: ModeTween
}

export default function FloorAndWalls({ modeTween }: FloorAndWallsProps) {
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const grid2DRef   = useRef<THREE.GridHelper>(null)
  const grid3DRef   = useRef<THREE.GridHelper>(null)
  const wallBackMat = useRef<THREE.MeshStandardMaterial>(null)
  const wallSideMat = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    const p = tickTween(modeTween, performance.now())
    // Floor: more visible in 3D, faint in 2D (just a hint that there's a "scene" underneath)
    if (floorMatRef.current) {
      floorMatRef.current.transparent = true
      floorMatRef.current.opacity = 0.08 + 0.92 * p
    }
    // Walls fully invisible in 2D (top-down view doesn't need walls)
    if (wallBackMat.current) {
      wallBackMat.current.transparent = true
      wallBackMat.current.opacity = 0.82 * p
    }
    if (wallSideMat.current) {
      wallSideMat.current.transparent = true
      wallSideMat.current.opacity = 0.78 * p
    }
    // Grid: keep light dot grid in 2D (subtle), fade slightly in 3D
    if (grid2DRef.current) {
      const mat = grid2DRef.current.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach(m => { m.transparent = true; m.opacity = 0.6 - 0.4 * p })
      else { mat.transparent = true; mat.opacity = 0.6 - 0.4 * p }
    }
    if (grid3DRef.current) {
      const mat = grid3DRef.current.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach(m => { m.transparent = true; m.opacity = 0.4 * p })
      else { mat.transparent = true; mat.opacity = 0.4 * p }
    }
  })

  return (
    <group>
      {/* Floor slab — opacity tweens from faint hint (2D) to full panel (3D) */}
      <RoundedBox args={[11, 0.12, 9]} radius={0.12} position={[0, -0.08, 0]} receiveShadow>
        <meshStandardMaterial ref={floorMatRef} color="#111827" roughness={0.72} metalness={0.1} transparent />
      </RoundedBox>

      {/* Two grids overlaid — one fades out as the other fades in */}
      <gridHelper ref={grid2DRef} args={[11, 22, "#9CA3AF", "#D1D5DB"]} position={[0, 0.005, 0]} />
      <gridHelper ref={grid3DRef} args={[11, 22, "#263653", "#182238"]} position={[0, 0.006, 0]} />

      {/* Back wall */}
      <RoundedBox args={[11, 3.1, 0.14]} radius={0.12} position={[0, 1.45, -4.5]}>
        <meshStandardMaterial ref={wallBackMat} color="#0c1220" roughness={0.82} metalness={0.04} transparent opacity={0} />
      </RoundedBox>

      {/* Side wall */}
      <RoundedBox args={[0.14, 3.1, 9]} radius={0.12} position={[-5.5, 1.45, 0]}>
        <meshStandardMaterial ref={wallSideMat} color="#0b101c" roughness={0.86} metalness={0.04} transparent opacity={0} />
      </RoundedBox>
    </group>
  )
}
