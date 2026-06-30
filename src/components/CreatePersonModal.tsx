import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Select } from "./ui/Select"
import { useCreatePerson } from "../hooks/usePeople"
import { useAppStore } from "../store/useAppStore"
import { GROUPS, ROLES } from "../lib/constants"
import { toast } from "./ui/Toast"

const GROUP_OPTIONS = [
  { value: "", label: "— nincs —" },
  ...Object.entries(GROUPS).map(([k, g]) => ({ value: k, label: g.icon + " " + g.label })),
]
const ROLE_OPTIONS = Object.entries(ROLES).map(([k, r]) => ({ value: k, label: (r.badge || "—") + " " + r.label }))

export default function CreatePersonModal() {
  const { createPersonOpen, setCreatePersonOpen, setSelectedPersonId } = useAppStore()
  const createPerson = useCreatePerson()

  const [name, setName] = useState("")
  const [group, setGroup] = useState("")
  const [role, setRole] = useState("none")
  const [strength, setStrength] = useState("3")
  const [error, setError] = useState<string | null>(null)

  // The modal is always mounted (returns null when closed), so clear leftover form state
  // whenever it closes — otherwise a cancelled entry reappears on the next open.
  useEffect(() => {
    if (!createPersonOpen) {
      setName(""); setGroup(""); setRole("none"); setStrength("3"); setError(null)
    }
  }, [createPersonOpen])

  if (!createPersonOpen) return null

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const person = await createPerson.mutateAsync({
        display_name: name.trim() || "Névtelen",
        group_key: (group || null) as never,
        role_key: role as never,
        strength: Number(strength),
      })
      setCreatePersonOpen(false)
      setSelectedPersonId(person.id)
      setName(""); setGroup(""); setRole("none"); setStrength("3")
      toast.success(`Hozzáadva: ${person.display_name}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("relation") && msg.includes("does not exist")) {
        setError("A Supabase adatbázis még nincs beállítva. Futtasd le a migrációt: supabase/migrations/0001_initial.sql")
      } else if (msg.includes("JWT")) {
        setError("Bejelentkezési hiba. Próbálj újra bejelentkezni.")
      } else {
        setError(msg)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-surface border border-border-strong rounded-xl p-6 w-96 shadow-panel"
      >
        <h2 className="text-text font-semibold mb-5 text-lg">Új személy</h2>
        <form onSubmit={handle} className="space-y-4">
          <Input
            label="Név"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Kovács Anna"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Csoport" options={GROUP_OPTIONS} value={group} onChange={e => setGroup(e.target.value)} />
            <Select label="Szerep" options={ROLE_OPTIONS} value={role} onChange={e => setRole(e.target.value)} />
          </div>
          <Select
            label="Kapcsolat erőssége"
            options={[1,2,3,4,5].map(n => ({ value: String(n), label: "★".repeat(n) + "☆".repeat(5-n) }))}
            value={strength}
            onChange={e => setStrength(e.target.value)}
          />
          {error && (
            <p className="text-family text-xs bg-family/10 border border-family/20 rounded px-3 py-2 leading-relaxed">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreatePersonOpen(false)}>Mégse</Button>
            <Button variant="primary" type="submit" disabled={createPerson.isPending}>
              {createPerson.isPending ? "Mentés..." : "Létrehozás"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
