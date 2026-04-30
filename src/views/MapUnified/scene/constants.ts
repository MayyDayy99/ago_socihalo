import type { GroupKey } from "../../../lib/constants"

// Scale: d3-force runs in pixel units (~hundreds), the 3D world is ~10x10.
// Multiply pixel coords by WORLD_SCALE when handing to Three.js;
// divide world coords by WORLD_SCALE when persisting to DB.
export const WORLD_SCALE = 0.0125

// 2D camera preset (top-down). The tiny z offset prevents OrbitControls gimbal lock.
export const CAMERA_2D = {
  position: [0, 14, 0.001] as [number, number, number],
  target:   [0, 0, 0]      as [number, number, number],
  fov:      35,
}

// 3D camera preset (perspective).
export const CAMERA_3D = {
  position: [6, 6, 7] as [number, number, number],
  target:   [0, 0.5, 0] as [number, number, number],
  fov:      42,
}

// Per-group "zone" centers on the floor — used as the base position for people
// without a pinned position. Coordinates in world units (post WORLD_SCALE).
export const GROUP_ZONES: Record<GroupKey, { center: [number, number] }> = {
  family:       { center: [-2.5, -1.5] },
  work:         { center: [ 2.5, -1.5] },
  friend:       { center: [-2.5,  1.6] },
  business:     { center: [ 2.5,  1.6] },
  acquaintance: { center: [-3.5,  0.0] },
  community:    { center: [ 3.5,  0.0] },
  other:        { center: [ 0.0,  3.0] },
}

export const UNGROUPED_CENTER: [number, number] = [0, 0]

// Camera tween duration in ms.
export const TWEEN_DURATION = 700

// Long-press touch threshold (ms) before drag mode engages.
export const LONG_PRESS_MS = 400

// FNV-1a hash → [0, 1). Deterministic per-id randomness for gender variation, walk phase.
export function idHash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
