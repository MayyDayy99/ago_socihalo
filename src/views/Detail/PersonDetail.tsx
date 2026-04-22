import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { X, Trash2, Archive, ArchiveRestore, Plus, Link2, Route, Check } from "lucide-react"
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
import { toast } from "../../components/ui/Toast"
import PathFindDialog from "../../components/PathFindDialog"
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
  const {
    selectedPersonId, setSelectedPersonId,
    setPathHighlight,
    setConnectMode, setConnectFromId,
    setActiveView,
  } = useAppStore()
  const { data: people = [] } = usePeople()
  const { data: connections = [] } = useConnections()
  const updatePerson   = useUpdatePerson()
  const deletePerson   = useDeletePerson()
  const deleteConn     = useDeleteConnection()

  const isMobile = useIsMobile()
  const person = people.find(p => p.id === selectedPersonId)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [pathDialogOpen, setPathDialogOpen] = useState(false)

  useEffect(() => {
    if (person) { setEdit(toEdit(person)); setDirty(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id])

  // Flash "Saved" badge briefly when a save settles
  useEffect(() => {
    if (!updatePerson.isSuccess) return
    setSavedFlash(true)
    const t = setTimeout(() => setSavedFlash(false), 1400)
    return () => clearTimeout(t)
  }, [updatePerson.isSuccess, updatePerson.data])

  if (!person || !edit) return null

  const myConns = connections.filter(c => c.from_id === person.id || c.to_id === person.id)

  function set<K extends keyof EditState>(key: K, val: EditState[K]) {
    setEdit(e => e ? { ...e, [key]: val } : e)
    setDirty(true)
  }

  async function save(extra?: Partial<Person>) {
    if (!edit || !person) return
    try {
      await updatePerson.mutateAsync({
        id: person.id,
        display_name: edit.display_name,
        group_key: (edit.group_key || null) as Person["group_key"],
        role_key: edit.role_key as Person["role_key"],
        strength: edit.strength,
        notes: edit.notes || null,
        met_at: edit.met_at || null,
        last_contact: edit.last_contact || null,
        tags: edit.tags,
        ...extra,
      })
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mentés sikertelen")
    }
  }

  async function handleDelete() {
    if (!person) return
    if (!confirm(`Biztosan törlöd: ${person.display_name}?`)) return
    setSelectedPersonId(null)
    try {
      await deletePerson.mutateAsync(person.id)
      toast.success("Személy törölve")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Törlés sikertelen")
    }
  }

  async function handleArchive() {
    if (!person) return
    try {
      await updatePerson.mutateAsync({ id: person.id, archived: !person.archived })
      toast.success(person.archived ? "Visszaállítva" : "Archiválva")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mentés sikertelen")
    }
  }

  function startConnect() {
    if (!person) return
    setActiveView("map")
    setConnectMode(true)
    setConnectFromId(person.id)
  }

  function addTag() {
    if (!edit) return
    const t = edit.tagInput.trim()
    if (t && !edit.tags.includes(t)) {
      const newTags = [...edit.tags, t]
      setEdit(e => e ? { ...e, tags: newTags, tagInput: "" } : e)
      setDirty(true)
    } else {
      setEdit(e => e ? { ...e, tagInput: "" } : e)
    }
  }

  function getOther(c: typeof connections[0]) {
    if (!person) return undefined
    const id = c.from_id === person.id ? c.to_id : c.from_id
    return people.find(p => p.id === id)
  }

  return (
    <>
      <motion.aside
        initial={isMobile ? { y: "100%" } : { x: 380 }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: "100%" } : { x: 380 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 z-40 h-[78vh] bg-surface border-t border-border-strong flex flex-col overflow-hidden rounded-t-2xl shadow-panel"
            : "w-[360px] h-full bg-surface border-l border-border flex flex-col overflow-hidden flex-shrink-0"
        }
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-border-strong" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-surface">
          <div className="flex-1 min-w-0">
            <input
              value={edit.display_name}
              onChange={e => set("display_name", e.target.value)}
              onBlur={() => dirty && save()}
              placeholder="Név"
              aria-label="Név"
              className="bg-transparent text-lg font-semibold text-text w-full focus:outline-none border-b border-transparent focus:border-accent/40 pb-0.5 transition-colors"
            />
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {person.group_key && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: GROUPS[person.group_key]?.color + "1A", color: GROUPS[person.group_key]?.color }}>
                  {GROUPS[person.group_key]?.icon} {GROUPS[person.group_key]?.label}
                </span>
              )}
              {person.role_key !== "none" && (
                <span className="text-xs" style={{ color: ROLES[person.role_key]?.color }}>
                  {ROLES[person.role_key]?.badge} {ROLES[person.role_key]?.label}
                </span>
              )}
              {person.archived && (
                <span className="text-xs text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5">archivált</span>
              )}
              {savedFlash && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-emerald-600 inline-flex items-center gap-1 ml-auto"
                >
                  <Check size={11} /> mentve
                </motion.span>
              )}
            </div>
          </div>
          <button onClick={() => setSelectedPersonId(null)} className="text-muted hover:text-text p-1 ml-2 transition-colors" aria-label="Bezárás">
            <X size={16} />
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-surface-2/50">
          <Button variant="primary" size="sm" onClick={startConnect}>
            <Link2 size={12} /> Kapcsolat
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPathDialogOpen(true)}>
            <Route size={12} /> Útvonal…
          </Button>
          <div className="ml-auto" />
          <button
            onClick={handleArchive}
            className="text-muted hover:text-text p-1.5 rounded hover:bg-surface-3 transition-colors"
            title={person.archived ? "Visszaállítás" : "Archiválás"}
            aria-label={person.archived ? "Visszaállítás" : "Archiválás"}
          >
            {person.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
          <button
            onClick={handleDelete}
            className="text-muted hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
            title="Törlés"
            aria-label="Törlés"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Csoport"
              options={GROUP_OPTIONS}
              value={edit.group_key}
              onChange={e => { set("group_key", e.target.value); setTimeout(() => save({ group_key: (e.target.value || null) as Person["group_key"] }), 0) }}
            />
            <Select
              label="Szerep"
              options={ROLE_OPTIONS}
              value={edit.role_key}
              onChange={e => { set("role_key", e.target.value); setTimeout(() => save({ role_key: e.target.value as Person["role_key"] }), 0) }}
            />
          </div>

          <Select
            label="Kapcsolat erőssége"
            options={STRENGTH_OPTIONS}
            value={String(edit.strength)}
            onChange={e => { set("strength", Number(e.target.value)); setTimeout(() => save({ strength: Number(e.target.value) }), 0) }}
          />

          {person.emails.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">E-mail</p>
              {person.emails.map(e => (
                <p key={e} className="text-sm text-text">{e}</p>
              ))}
            </div>
          )}
          {person.phone_numbers.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Telefon</p>
              {person.phone_numbers.map(ph => (
                <p key={ph} className="text-sm text-text">{ph}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Utolsó kontaktus"
              type="date"
              value={edit.last_contact}
              onChange={e => set("last_contact", e.target.value)}
              onBlur={() => dirty && save()}
            />
            <Input
              label="Hol ismerkedtetek?"
              value={edit.met_at}
              onChange={e => set("met_at", e.target.value)}
              onBlur={() => dirty && save()}
              placeholder="pl. Egyetem"
            />
          </div>

          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Címkék</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {edit.tags.map(t => (
                <Chip key={t} label={t} onRemove={() => { const newTags = edit.tags.filter(x => x !== t); setEdit(e => e ? { ...e, tags: newTags } : e); setDirty(true); save({ tags: newTags }) }} />
              ))}
              {edit.tags.length === 0 && <span className="text-xs text-muted italic">nincs címke</span>}
            </div>
            <div className="flex gap-1">
              <input
                value={edit.tagInput}
                onChange={e => set("tagInput", e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Új címke + Enter…"
                className="flex-1 bg-surface border border-border-strong rounded px-2 py-1 text-xs text-text placeholder-muted focus:outline-none focus:border-accent"
              />
              <Button size="sm" variant="ghost" onClick={addTag}><Plus size={12} /></Button>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Megjegyzések</p>
            <textarea
              value={edit.notes}
              onChange={e => set("notes", e.target.value)}
              onBlur={() => dirty && save()}
              rows={4}
              placeholder="Feljegyzések, kontextus…"
              className="w-full bg-surface border border-border-strong rounded px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {myConns.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Kapcsolatok ({myConns.length})</p>
              <div className="space-y-1">
                {myConns.map(c => {
                  const other = getOther(c)
                  if (!other) return null
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-b-0">
                      <button
                        onClick={() => setSelectedPersonId(other.id)}
                        className="text-text hover:text-accent truncate text-left flex-1"
                      >
                        {other.display_name}
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.type && (
                          <span className="text-xs text-muted">{c.type}</span>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              await deleteConn.mutateAsync(c.id)
                              toast.success("Kapcsolat törölve")
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Hiba a törlésnél")
                            }
                          }}
                          className="text-muted hover:text-red-600 transition-colors p-0.5"
                          aria-label="Kapcsolat törlése"
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
        </div>
      </motion.aside>

      {pathDialogOpen && (
        <PathFindDialog
          fromPerson={person}
          people={people}
          onPick={(toId) => {
            const path = shortestPath(person.id, toId, connections)
            setPathDialogOpen(false)
            if (!path) {
              toast.error("Nincs útvonal e két személy között")
              return
            }
            setPathHighlight(path)
            setActiveView("map")
            toast.success(`Útvonal: ${path.length - 1} lépés`)
          }}
          onCancel={() => setPathDialogOpen(false)}
        />
      )}
    </>
  )
}
