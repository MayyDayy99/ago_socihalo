import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { X, Trash2, Archive, ArchiveRestore, Plus } from "lucide-react"
import { useAppStore } from "../../store/useAppStore"
import { usePeople, useUpdatePerson, useDeletePerson } from "../../hooks/usePeople"
import { useConnections, useDeleteConnection } from "../../hooks/useConnections"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import { Chip } from "../../components/ui/Chip"
import { useIsMobile } from "../../hooks/useIsMobile"
import { GROUPS, ROLES } from "../../lib/constants"
import { shortestPath } from "../../lib/metrics"
import type { Person } from "../../store/types"

const GROUP_OPTIONS = [
  { value: "", label: "—" },
  ...Object.entries(GROUPS).map(([k, g]) => ({ value: k, label: g.icon + " " + g.label })),
]
const ROLE_OPTIONS = Object.entries(ROLES).map(([k, r]) => ({ value: k, label: r.badge + " " + r.label }))
const STRENGTH_OPTIONS = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: "★".repeat(n) + "☆".repeat(5 - n) }))

interface EditState {
  display_name: string
  group_key: string
  role_key: string
  strength: number
  notes: string
  met_at: string
  last_contact: string
  tagInput: string
  tags: string[]
}

function toEdit(p: Person): EditState {
  return {
    display_name: p.display_name,
    group_key: p.group_key ?? "",
    role_key: p.role_key,
    strength: p.strength,
    notes: p.notes ?? "",
    met_at: p.met_at ?? "",
    last_contact: p.last_contact ?? "",
    tagInput: "",
    tags: p.tags,
  }
}

export default function PersonDetail() {
  const { selectedPersonId, setSelectedPersonId, setPathHighlight } = useAppStore()
  const { data: people = [] } = usePeople()
  const { data: connections = [] } = useConnections()
  const updatePerson   = useUpdatePerson()
  const deletePerson   = useDeletePerson()
  const deleteConn     = useDeleteConnection()

  const isMobile = useIsMobile()
  const person = people.find(p => p.id === selectedPersonId)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (person) { setEdit(toEdit(person)); setDirty(false) }
  }, [person?.id])

  if (!person || !edit) return null

  const myConns = connections.filter(c => c.from_id === person.id || c.to_id === person.id)

  function set<K extends keyof EditState>(key: K, val: EditState[K]) {
    setEdit(e => e ? { ...e, [key]: val } : e)
    setDirty(true)
  }

  async function save() {
    if (!edit) return
    await updatePerson.mutateAsync({
      id: person!.id,
      display_name: edit.display_name,
      group_key: (edit.group_key || null) as Person["group_key"],
      role_key: edit.role_key as Person["role_key"],
      strength: edit.strength,
      notes: edit.notes || null,
      met_at: edit.met_at || null,
      last_contact: edit.last_contact || null,
      tags: edit.tags,
    })
    setDirty(false)
  }

  async function handleDelete() {
    if (!person) return
    if (!confirm(`Törlöd: ${person.display_name}?`)) return
    setSelectedPersonId(null)
    await deletePerson.mutateAsync(person.id)
  }

  async function handleArchive() {
    if (!person) return
    await updatePerson.mutateAsync({ id: person.id, archived: !person.archived })
  }

  function addTag() {
    if (!edit) return
    const t = edit.tagInput.trim()
    if (t && !edit.tags.includes(t)) {
      set("tags", [...edit.tags, t])
    }
    set("tagInput", "")
  }

  function getOther(c: typeof connections[0]) {
    if (!person) return undefined
    const id = c.from_id === person.id ? c.to_id : c.from_id
    return people.find(p => p.id === id)
  }

  return (
    <motion.aside
      initial={isMobile ? { y: "100%" } : { x: 380 }}
      animate={isMobile ? { y: 0 } : { x: 0 }}
      exit={isMobile ? { y: "100%" } : { x: 380 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={
        isMobile
          ? "fixed inset-x-0 bottom-0 z-40 h-[75vh] bg-surface border-t border-border flex flex-col font-mono overflow-hidden rounded-t-2xl shadow-panel"
          : "w-96 h-full bg-surface border-l border-border flex flex-col font-mono overflow-hidden flex-shrink-0 shadow-panel"
      }
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <input
            value={edit.display_name}
            onChange={e => set("display_name", e.target.value)}
            onBlur={() => dirty && save()}
            className="bg-transparent text-xl font-bold text-text font-serif w-full focus:outline-none border-b border-transparent focus:border-accent/40 pb-0.5 transition-colors"
          />
          <div className="flex items-center gap-2 mt-1">
            {person.group_key && (
              <span className="text-xs" style={{ color: GROUPS[person.group_key]?.color }}>
                {GROUPS[person.group_key]?.icon} {GROUPS[person.group_key]?.label}
              </span>
            )}
            {person.role_key !== "none" && (
              <span className="text-xs" style={{ color: ROLES[person.role_key]?.color }}>
                {ROLES[person.role_key]?.badge} {ROLES[person.role_key]?.label}
              </span>
            )}
            {person.archived && (
              <span className="text-xs text-muted">[archivált]</span>
            )}
          </div>
        </div>
        <button onClick={() => setSelectedPersonId(null)} className="text-muted hover:text-text p-1 ml-2 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Group + Role */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Csoport"
            options={GROUP_OPTIONS}
            value={edit.group_key}
            onChange={e => { set("group_key", e.target.value); save() }}
          />
          <Select
            label="Szerep"
            options={ROLE_OPTIONS}
            value={edit.role_key}
            onChange={e => { set("role_key", e.target.value); save() }}
          />
        </div>

        {/* Strength */}
        <Select
          label="Kapcsolat erőssége"
          options={STRENGTH_OPTIONS}
          value={String(edit.strength)}
          onChange={e => { set("strength", Number(e.target.value)); save() }}
        />

        {/* Contact info */}
        {person.emails.length > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">E-mail</p>
            {person.emails.map(e => (
              <p key={e} className="text-sm text-text/80">{e}</p>
            ))}
          </div>
        )}
        {person.phone_numbers.length > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Telefon</p>
            {person.phone_numbers.map(ph => (
              <p key={ph} className="text-sm text-text/80">{ph}</p>
            ))}
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Utolsó kontaktus"
            type="date"
            value={edit.last_contact}
            onChange={e => set("last_contact", e.target.value)}
            onBlur={() => dirty && save()}
          />
          <Input
            label="Hol ismerkedtünk?"
            value={edit.met_at}
            onChange={e => set("met_at", e.target.value)}
            onBlur={() => dirty && save()}
            placeholder="pl. Uni"
          />
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Címkék</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {edit.tags.map(t => (
              <Chip key={t} label={t} onRemove={() => { set("tags", edit.tags.filter(x => x !== t)); save() }} />
            ))}
          </div>
          <div className="flex gap-1">
            <input
              value={edit.tagInput}
              onChange={e => set("tagInput", e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTag()}
              placeholder="Új címke..."
              className="flex-1 bg-app border border-border rounded px-2 py-1 text-xs text-text placeholder-muted focus:outline-none focus:border-accent"
            />
            <Button size="sm" variant="ghost" onClick={addTag}><Plus size={12} /></Button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Megjegyzések</p>
          <textarea
            value={edit.notes}
            onChange={e => set("notes", e.target.value)}
            onBlur={() => dirty && save()}
            rows={4}
            placeholder="Feljegyzések..."
            className="w-full bg-app border border-border rounded px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent resize-none font-mono"
          />
        </div>

        {/* Connections */}
        {myConns.length > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Kapcsolatok ({myConns.length})</p>
            <div className="space-y-1">
              {myConns.map(c => {
                const other = getOther(c)
                if (!other) return null
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1 border-b border-border/40">
                    <button
                      onClick={() => setSelectedPersonId(other.id)}
                      className="text-text/80 hover:text-text truncate"
                    >
                      {other.display_name}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.type && (
                        <span className="text-xs text-muted">{c.type}</span>
                      )}
                      <button
                        onClick={() => deleteConn.mutate(c.id)}
                        className="text-muted hover:text-red-400 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Path finding */}
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Útvonal keresés</p>
          <button
            onClick={() => {
              const targetName = prompt("Célszemély neve?")
              if (!targetName) return
              const target = people.find(p => p.display_name.toLowerCase().includes(targetName.toLowerCase()))
              if (!target) { alert("Nem található: " + targetName); return }
              const path = shortestPath(person.id, target.id, connections)
              if (!path) { alert("Nincs útvonal"); return }
              setPathHighlight(path)
            }}
            className="text-xs text-accent hover:underline"
          >
            Útvonal ehhez a személyhez →
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 p-4 border-t border-border">
        {dirty && (
          <Button variant="primary" size="sm" onClick={save}>
            Mentés
          </Button>
        )}
        <Button
          variant="ghost" size="sm"
          onClick={handleArchive}
          title={person.archived ? "Visszaállítás" : "Archiválás"}
        >
          {person.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {person.archived ? "Visszaáll." : "Archiválás"}
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 size={14} /> Törlés
        </Button>
      </div>
    </motion.aside>
  )
}
