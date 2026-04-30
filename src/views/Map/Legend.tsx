import { GROUPS, ROLES } from "../../lib/constants"

export default function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur border border-border rounded-lg p-3 text-xs space-y-3 max-w-[180px]">
      <div>
        <p className="text-muted uppercase tracking-wider mb-1.5">Csoportok</p>
        <div className="space-y-1">
          {Object.entries(GROUPS).map(([key, g]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
              <span className="text-text/80">{g.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-muted uppercase tracking-wider mb-1.5">Szerepek (perem)</p>
        <div className="space-y-1">
          {Object.entries(ROLES).filter(([k]) => k !== "none").map(([, r]) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: r.color }} />
              <span className="text-text/80">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
