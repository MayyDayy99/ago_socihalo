import { useEffect, useRef } from "react"
import { useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js"
import { useAppStore } from "../../../store/useAppStore"
import { CAMERA_2D, CAMERA_3D } from "./constants"
import type { ModeTween } from "../hooks/useModeTween"
import { tickTween } from "../hooks/useModeTween"

interface CameraRigProps {
  modeTween: ModeTween
}

// Owns the camera and OrbitControls.
// Snapshots current camera state on mode-change so the tween starts from
// wherever the user happens to have orbited to (not from the preset they
// haven't been at since the last switch).
export default function CameraRig({ modeTween }: CameraRigProps) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const mapMode = useAppStore(s => s.mapMode)

  // Snapshot of camera + target at the moment the current tween started
  const fromPosRef    = useRef(new THREE.Vector3())
  const fromTargetRef = useRef(new THREE.Vector3())
  const fromFovRef    = useRef(35)

  // On mount: place camera at the persisted mode's preset, no animation
  useEffect(() => {
    const preset = mapMode === "3d" ? CAMERA_3D : CAMERA_2D
    camera.position.set(...preset.position)
    camera.fov = preset.fov
    camera.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.set(...preset.target)
      controlsRef.current.update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mode change: snapshot current camera state as the tween's `from`
  useEffect(() => {
    fromPosRef.current.copy(camera.position)
    if (controlsRef.current) fromTargetRef.current.copy(controlsRef.current.target)
    fromFovRef.current = camera.fov
  }, [mapMode, camera])

  // Per-frame tween + OrbitControls config swap
  useFrame(() => {
    const p = tickTween(modeTween, performance.now())
    const target = mapMode === "3d" ? CAMERA_3D : CAMERA_2D

    if (modeTween.isTweeningRef.current) {
      // Disable OrbitControls during tween so user input doesn't fight the animation
      if (controlsRef.current) controlsRef.current.enabled = false

      // The tween progress tracks 0→1 (full2D→full3D), but we lerp by "how far from where we
      // started toward the target". Compute alpha relative to from→target preset, not 0→1.
      // Simpler: snap to target preset weighted by current tween fraction.
      // tween's fromRef.current was the progress at tween start; we need a 0..1 alpha
      // for the lerp from snapshotted camera state → target preset.
      const span = modeTween.targetRef.current - modeTween.fromRef.current
      const rawAlpha = Math.abs(span) < 1e-6 ? 1 :
        (p - modeTween.fromRef.current) / span
      const alpha = Math.max(0, Math.min(1, rawAlpha))

      // Lerp position
      camera.position.lerpVectors(
        fromPosRef.current,
        new THREE.Vector3(...target.position),
        alpha,
      )
      // Lerp orbit target
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(
          fromTargetRef.current,
          new THREE.Vector3(...target.target),
          alpha,
        )
      }
      // Lerp fov
      camera.fov = fromFovRef.current + (target.fov - fromFovRef.current) * alpha
      camera.updateProjectionMatrix()

      if (!modeTween.isTweeningRef.current) {
        // Tween just finished — snap to target precisely + re-enable + apply mode-specific config
        applyControlsConfigForMode(controlsRef.current, mapMode)
      }
    } else {
      // Idle — make sure controls config matches current mode (handles initial mount)
      applyControlsConfigForMode(controlsRef.current, mapMode)
    }
  })

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enablePan
      enableZoom
      enableDamping
      dampingFactor={0.12}
    />
  )
}

function applyControlsConfigForMode(controls: OrbitControlsImpl | null, mode: "2d" | "3d") {
  if (!controls) return
  controls.enabled = true
  if (mode === "2d") {
    controls.enableRotate = false
    controls.minPolarAngle = 0
    controls.maxPolarAngle = 0.001  // locked top-down
    controls.minDistance = 6
    controls.maxDistance = 22
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
  } else {
    controls.enableRotate = true
    controls.minPolarAngle = Math.PI * 0.18
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 5
    controls.maxDistance = 14
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
  }
}
