export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 rounded ${className}`} />
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-lg p-4 space-y-3 ${className}`}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-3 py-2.5 border-b border-border/30">
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-3 w-8" />
      <Skeleton className="h-3 w-6" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}
