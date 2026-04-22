import { create } from "zustand"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { useEffect } from "react"

type ToastKind = "success" | "error" | "info"
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  ttl: number
}

interface ToastStore {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string, ttl?: number) => void
  remove: (id: number) => void
}

let nextId = 1
const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message, ttl = 2200) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId++, kind, message, ttl }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (msg: string) => useToastStore.getState().push("success", msg),
  error:   (msg: string) => useToastStore.getState().push("error", msg, 4000),
  info:    (msg: string) => useToastStore.getState().push("info", msg),
}

const ICONS = {
  success: <CheckCircle2 size={16} className="text-emerald-600" />,
  error:   <AlertCircle  size={16} className="text-red-600" />,
  info:    <Info         size={16} className="text-blue-600" />,
}

function ToastItemRow({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove)
  useEffect(() => {
    const t = setTimeout(() => remove(item.id), item.ttl)
    return () => clearTimeout(t)
  }, [item.id, item.ttl, remove])
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 12, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex items-center gap-2.5 bg-surface border border-border-strong rounded-lg pl-3 pr-2 py-2 shadow-panel min-w-[220px] max-w-sm"
    >
      {ICONS[item.kind]}
      <span className="text-sm text-text flex-1">{item.message}</span>
      <button
        onClick={() => remove(item.id)}
        className="text-muted hover:text-text p-1 -mr-1"
        aria-label="Bezárás"
      >
        <X size={12} />
      </button>
    </motion.div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="fixed top-3 right-3 z-[60] flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItemRow key={t.id} item={t} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
