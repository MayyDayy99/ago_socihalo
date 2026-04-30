import { useEffect, useRef } from "react"
import { useAppStore, type MapMode } from "../../../store/useAppStore"
import { TWEEN_DURATION } from "../scene/constants"

// Single source of truth for the 2D ↔ 3D animation:
// `progressRef.current` interpolates 0 (full 2D) ↔ 1 (full 3D).
// All scene channels (camera position, body opacity, floor opacity, edge bezier height,
// ring scale, etc.) read this same ref in useFrame, so the transition is automatically
// coordinated across every animated property.

export interface ModeTween {
  progressRef: React.MutableRefObject<number>
  isTweeningRef: React.MutableRefObject<boolean>
  /** Where to lerp toward as of NOW (target progress 0 or 1). */
  targetRef: React.MutableRefObject<number>
  /** When the current tween started (performance.now()). */
  startedAtRef: React.MutableRefObject<number>
  /** Progress value at the moment the current tween started (so we can re-tween mid-flight without snapping). */
  fromRef: React.MutableRefObject<number>
}

export function useModeTween(): ModeTween {
  const mapMode = useAppStore(s => s.mapMode)
  const progressRef    = useRef(mapMode === "3d" ? 1 : 0)
  const isTweeningRef  = useRef(false)
  const targetRef      = useRef(mapMode === "3d" ? 1 : 0)
  const startedAtRef   = useRef(0)
  const fromRef        = useRef(progressRef.current)

  // When the store flips mapMode, start a new tween from the CURRENT progress
  // (not from 0/1) — handles the "user toggles mid-tween" case smoothly.
  useEffect(() => {
    const nextTarget: number = mapMode === "3d" ? 1 : 0
    if (nextTarget === targetRef.current && !isTweeningRef.current) return
    fromRef.current     = progressRef.current
    targetRef.current   = nextTarget
    startedAtRef.current = performance.now()
    isTweeningRef.current = true
  }, [mapMode])

  return { progressRef, isTweeningRef, targetRef, startedAtRef, fromRef }
}

// Cubic ease-in-out, the standard "feels intentional" curve.
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Helper: given the tween state and the current time, returns the eased progress
// AND advances/finalizes the tween.
export function tickTween(state: ModeTween, now: number): number {
  if (!state.isTweeningRef.current) return state.progressRef.current
  const t = Math.min(1, (now - state.startedAtRef.current) / TWEEN_DURATION)
  const eased = easeInOutCubic(t)
  const next = state.fromRef.current + (state.targetRef.current - state.fromRef.current) * eased
  state.progressRef.current = next
  if (t >= 1) {
    state.isTweeningRef.current = false
    state.progressRef.current = state.targetRef.current
  }
  return state.progressRef.current
}

// Convenience: trigger the tween imperatively (mostly for testing / non-store paths).
export function startTween(state: ModeTween, target: MapMode) {
  state.fromRef.current = state.progressRef.current
  state.targetRef.current = target === "3d" ? 1 : 0
  state.startedAtRef.current = performance.now()
  state.isTweeningRef.current = true
}
