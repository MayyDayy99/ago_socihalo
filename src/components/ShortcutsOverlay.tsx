import { motion } from "framer-motion"

const SHORTCUTS = [
  { section: "Navigáció" },
  { key: "⌘ K",      desc: "Parancspaletta megnyitása" },
  { key: "?",         desc: "Billentyűzetés súgó" },
  { key: "ESC",       desc: "Panel / paletta bezárása" },
  { section: "Térkép" },
  { key: "Kattintás",        desc: "Személy kijelölése / detail panel" },
  { key: "Shift + Húzás",    desc: "Kapcsolat létrehozása" },
  { key: "Húzás",            desc: "Csúcs áthelyezése (pozíció mentve)" },
  { key: "Scroll",           desc: "Zoom be / ki" },
  { key: "Két ujj / Drag",   desc: "Térkép mozgatása" },
  { section: "Lista" },
  { key: "Kattintás sorra",  desc: "Személy megnyitása + ugrás térképre" },
  { section: "Detail panel" },
  { key: "Tab",              desc: "Mezők között ugrás" },
  { key: "Enter",            desc: "Mentés (szövegmezőknél)" },
]

interface Props { onClose: () => void }

export default function ShortcutsOverlay({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-text font-bold text-sm">Billentyűparancsok</span>
          <kbd
            onClick={onClose}
            className="text-xs text-muted border border-border rounded px-1.5 py-0.5 cursor-pointer hover:text-text"
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-1">
          {SHORTCUTS.map((s, i) => {
            if ("section" in s) {
              return (
                <p key={i} className="text-xs text-muted uppercase tracking-wider pt-3 pb-1 first:pt-0">
                  {s.section}
                </p>
              )
            }
            return (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-text/70 text-sm">{s.desc}</span>
                <kbd className="text-xs text-muted border border-border rounded px-2 py-0.5 ml-4 flex-shrink-0 bg-surface-2">
                  {s.key}
                </kbd>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-border text-xs text-muted text-center">
          Nyomd meg a <kbd className="border border-border rounded px-1 py-0.5 bg-surface-2">?</kbd> billentyűt bármikor
        </div>
      </motion.div>
    </div>
  )
}
