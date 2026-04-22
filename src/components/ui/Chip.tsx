interface ChipProps {
  label: string
  color?: string
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}

export function Chip({ label, color, onRemove, onClick, active }: ChipProps) {
  return (
    <span
      onClick={onClick}
      style={color ? { borderColor: color + "44", color } : undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-mono transition-colors
        ${active ? "bg-accent/20 border-accent text-accent" : "border-border text-muted"}
        ${onClick ? "cursor-pointer hover:brightness-125" : ""}
      `}
    >
      {label}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="ml-0.5 hover:text-text transition-colors"
        >
          ×
        </button>
      )}
    </span>
  )
}
