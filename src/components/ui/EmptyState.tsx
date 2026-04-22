import type { ReactNode } from "react"

interface EmptyStateProps {
  icon?: string
  title: string
  sub?: string
  action?: ReactNode
}

export function EmptyState({ icon = "✦", title, sub, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[240px] text-center px-6 font-mono">
      <span className="text-4xl mb-4 opacity-20 select-none">{icon}</span>
      <p className="text-white font-medium mb-1">{title}</p>
      {sub && <p className="text-muted text-sm mb-5 max-w-xs">{sub}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}
