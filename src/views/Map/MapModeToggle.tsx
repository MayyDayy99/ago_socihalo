import { useAppStore } from "../../store/useAppStore"
import { Box, Layers } from "lucide-react"

export default function MapModeToggle() {
  const { mapMode, setMapMode } = useAppStore()
  const is3D = mapMode === "3d"
  return (
    <div className="absolute top-3 right-3 z-10 flex items-center bg-surface border border-border-strong rounded-lg p-0.5 shadow-card">
      <button
        type="button"
        onClick={() => setMapMode("2d")}
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-xs transition-colors ${
          !is3D ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-text"
        }`}
        title="2D nézet"
        aria-pressed={!is3D}
      >
        <Layers size={12} /> 2D
      </button>
      <button
        type="button"
        onClick={() => setMapMode("3d")}
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-xs transition-colors ${
          is3D ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-text"
        }`}
        title="3D nézet"
        aria-pressed={is3D}
      >
        <Box size={12} /> 3D
      </button>
    </div>
  )
}
