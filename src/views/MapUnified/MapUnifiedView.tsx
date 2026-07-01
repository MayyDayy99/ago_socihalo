import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { Suspense, useCallback, useMemo, useRef, useState, useEffect } from "react"
import * as THREE from "three"
import { usePeople, useUpdatePersonPosition } from "../../hooks/usePeople"
import { useConnections, useCreateConnection } from "../../hooks/useConnections"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../../components/ui/Button"
import { toast } from "../../components/ui/Toast"
import { UserPlus } from "lucide-react"
import Toolbar from "../Map/Toolbar"
import ConnectModeBanner from "../Map/ConnectModeBanner"
import ConnectionDialog from "../../components/ConnectionDialog"
import UnifiedScene from "./scene/UnifiedScene"
import { useForceLayout } from "./hooks/useForceLayout"
import { useModeTween } from "./hooks/useModeTween"
import { LONG_PRESS_MS, WORLD_SCALE } from "./scene/constants"

// Internal helper: a thin component mounted inside the Canvas that exposes the
// raycaster + camera + controls to the parent via a ref. We need them for the
// drag handler that runs OUTSIDE the canvas (window-level pointermove).
type SceneRefs = {
  camera: THREE.Camera
  gl: THREE.WebGLRenderer
}

function ThreeContextBridge({ refOut }: { refOut: React.MutableRefObject<SceneRefs | null> }) {
  const { camera, gl } = useThree()
  useEffect(() => {
    refOut.current = { camera, gl }
  }, [camera, gl, refOut])
  return null
}

export default function MapUnifiedView() {
  const { data: people = [], isLoading } = usePeople()
  const { data: connections = [] } = useConnections()
  const persistPosition = useUpdatePersonPosition()
  const createConn   = useCreateConnection()
  const {
    selectedPersonId, setSelectedPersonId,
    connectMode, connectFromId, setConnectFromId, setConnectMode,
    setCreatePersonOpen, setActiveView,
    pathHighlight,
  } = useAppStore()

  // Filter people (mirrors MapView's filter logic)
  const filters = useAppStore(s => s.filters)
  const filteredPeople = useMemo(() => {
    return people.filter(p => {
      if (!filters.showArchived && p.archived) return false
      if (filters.groups.length && !filters.groups.includes(p.group_key!)) return false
      if (filters.roles.length && !filters.roles.includes(p.role_key)) return false
      if (p.strength < filters.strengthMin) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!p.display_name.toLowerCase().includes(q) &&
            !p.emails.some(e => e.toLowerCase().includes(q)) &&
            !p.tags.some(t => t.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [people, filters])
  const filteredIds = useMemo(() => new Set(filteredPeople.map(p => p.id)), [filteredPeople])
  const filteredConnections = useMemo(
    () => connections.filter(c => filteredIds.has(c.from_id) && filteredIds.has(c.to_id)),
    [connections, filteredIds]
  )

  const { positionsRef, pinNode, releaseNode, reheat } = useForceLayout(filteredPeople, filteredConnections)
  const modeTween = useModeTween()

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const [pendingConn, setPendingConn] = useState<{ fromId: string; toId: string } | null>(null)

  const sceneRefsRef = useRef<SceneRefs | null>(null)
  const dragStateRef = useRef<{
    id: string
    pointerId: number
    longPressTimer: number | null
    dragActive: boolean
    moved: boolean
    startClient: { x: number; y: number }
    rect: DOMRect | null
  } | null>(null)

  // Click handler — connect-mode logic + selection
  const handlePersonClick = useCallback((id: string) => {
    // Suppress click if a real drag was performed (click fires after pointerup)
    if (dragStateRef.current && dragStateRef.current.moved && dragStateRef.current.dragActive) return
    // Read connect state live so this handler stays referentially stable (lets the memoized
    // PersonAvatar skip re-renders correctly).
    const { connectMode, connectFromId } = useAppStore.getState()
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(id)
      } else if (connectFromId !== id) {
        setPendingConn({ fromId: connectFromId, toId: id })
      } else {
        setConnectFromId(null)
        setConnectMode(false)
      }
    } else {
      setSelectedPersonId(id)
    }
  }, [setConnectFromId, setConnectMode, setSelectedPersonId])

  // Pointer-down on an avatar — starts the drag/long-press logic
  const handlePersonPointerDown = useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    if (e.shiftKey) {
      setConnectFromId(id)
      setConnectMode(true)
      return
    }
    if (useAppStore.getState().connectMode) return

    const native = e.nativeEvent as PointerEvent
    const isTouch = native.pointerType === "touch"
    const longPressMs = isTouch ? LONG_PRESS_MS : 0
    let dragActive = !isTouch
    const moveThreshold = isTouch ? 8 : 2

    const canvasEl = (e.eventObject as THREE.Object3D & { __r3f?: { root?: { gl?: { domElement: HTMLCanvasElement } } } }).__r3f?.root?.gl?.domElement
                  ?? sceneRefsRef.current?.gl.domElement
                  ?? null
    const rect = canvasEl ? canvasEl.getBoundingClientRect() : null

    const state = {
      id,
      pointerId: native.pointerId,
      longPressTimer: null as number | null,
      dragActive,
      moved: false,
      startClient: { x: native.clientX, y: native.clientY },
      rect,
    }
    dragStateRef.current = state

    function pinAtPointer(clientX: number, clientY: number) {
      const refs = sceneRefsRef.current
      if (!refs || !state.rect) return
      const ndc = new THREE.Vector2(
        ((clientX - state.rect.left) / state.rect.width) * 2 - 1,
        -((clientY - state.rect.top) / state.rect.height) * 2 + 1,
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(ndc, refs.camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const hit = new THREE.Vector3()
      // intersectPlane returns null (leaving `hit` untouched) when the ray misses the
      // plane — `hit` is always a truthy object, so check the RETURN value, not `hit`.
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      pinNode(id, hit.x, hit.z)
      reheat(0.12)
    }

    if (isTouch) {
      setPressedId(id)
      state.longPressTimer = window.setTimeout(() => {
        state.longPressTimer = null
        state.dragActive = true
        navigator.vibrate?.(15)
        pinAtPointer(state.startClient.x, state.startClient.y)
      }, longPressMs)
    }

    function onPointerMove(me: PointerEvent) {
      if (me.pointerId !== state.pointerId) return
      const dx = me.clientX - state.startClient.x
      const dy = me.clientY - state.startClient.y
      const dist = Math.hypot(dx, dy)
      if (dist > moveThreshold) state.moved = true
      if (isTouch && !state.dragActive && state.moved) {
        // Touch panning before long-press fired — abort drag attempt entirely
        if (state.longPressTimer !== null) clearTimeout(state.longPressTimer)
        cleanup()
        return
      }
      if (!state.dragActive) return
      pinAtPointer(me.clientX, me.clientY)
    }

    function onPointerUp(me: PointerEvent) {
      if (me.pointerId !== state.pointerId) return
      if (state.longPressTimer !== null) clearTimeout(state.longPressTimer)
      if (state.moved && state.dragActive) {
        const pos = positionsRef.current.get(id)
        if (pos) {
          // Persist in DB (pixel scale) without invalidating ["people"] (would rebuild the sim).
          persistPosition.mutate({
            id,
            pinned_x: pos.x / WORLD_SCALE,
            pinned_y: pos.z / WORLD_SCALE,
          })
        }
      } else if (!state.moved && !state.dragActive) {
        // Tap with no movement, no drag — release any temporary pin we may have set
        // (we didn't pin in this branch, so nothing to release)
      }
      cleanup()
    }

    function cleanup() {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
      setPressedId(null)
      dragStateRef.current = null
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
  }, [setConnectFromId, setConnectMode, pinNode, reheat, positionsRef, persistPosition])

  const handlePersonHover = useCallback((id: string | null) => {
    setHoveredId(id)
  }, [])

  // ESC cancels connect mode / pending dialog
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (pendingConn) { setPendingConn(null); return }
      if (connectMode) {
        setConnectMode(false)
        setConnectFromId(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [connectMode, pendingConn, setConnectMode, setConnectFromId])

  const pathSet = useMemo(() => pathHighlight ? new Set(pathHighlight) : null, [pathHighlight])

  // Suppress unused var warning (releaseNode reserved for future use)
  void releaseNode

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
          <ThreeContextBridge refOut={sceneRefsRef} />
          <UnifiedScene
            people={filteredPeople}
            connections={filteredConnections}
            positionsRef={positionsRef}
            modeTween={modeTween}
            selectedPersonId={selectedPersonId}
            connectFromId={connectFromId}
            connectMode={connectMode}
            hoveredId={hoveredId}
            pressedId={pressedId}
            pathSet={pathSet}
            onPersonClick={handlePersonClick}
            onPersonPointerDown={handlePersonPointerDown}
            onPersonHover={handlePersonHover}
          />
        </Suspense>
      </Canvas>

      {/* Stats footer */}
      {!showLoading && !showEmpty && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 backdrop-blur border border-white/10 rounded px-2.5 py-1 pointer-events-none">
          {filteredPeople.length} személy · {filteredConnections.length} kapcsolat
          {filteredPeople.length !== people.length && (
            <span className="ml-1 text-accent">(szűrve)</span>
          )}
        </div>
      )}

      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none z-30">
          <div className="text-center">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/70 text-sm">Hálózat betöltése…</p>
          </div>
        </div>
      )}

      {showEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-30">
          <span className="text-4xl mb-4 opacity-50 select-none">⬡</span>
          <p className="text-white font-medium mb-1">Üres hálózat</p>
          <p className="text-white/60 text-sm mb-5 max-w-xs">
            Adj hozzá személyeket, vagy importálj névjegyeket egy meglévő forrásból.
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
