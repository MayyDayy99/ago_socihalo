import { motion, AnimatePresence } from "framer-motion"
import { Link2, X } from "lucide-react"

interface Props {
  active: boolean
  sourceName: string | null
  onCancel: () => void
}

export default function ConnectModeBanner({ active, sourceName, onCancel }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -32, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute top-3 left-3 z-20 flex items-center gap-2.5 bg-accent text-white text-sm px-3 py-2 rounded-lg shadow-panel"
        >
          <Link2 size={14} />
          {sourceName ? (
            <span>
              Kapcsolat innen: <strong>{sourceName}</strong> — kattints a célszemélyre
            </span>
          ) : (
            <span>Kapcsolat módban: kattints az első személyre</span>
          )}
          <button
            onClick={onCancel}
            className="ml-2 -mr-1 p-1 rounded hover:bg-white/20 transition-colors"
            title="Mégse (ESC)"
            aria-label="Mégse"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
