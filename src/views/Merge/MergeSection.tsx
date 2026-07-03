import { useState } from "react"
import { GitMerge, Send, Check, X, ShieldOff, ArrowRight, Clock } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import { toast } from "../../components/ui/Toast"
import { useAppStore } from "../../store/useAppStore"
import {
  useMergeSessions, useCreateMergeInvite, useRespondToMerge, useRevokeMerge, useMyIdentity,
} from "../../hooks/useMerge"
import { SHARE_LEVELS, type ShareLevel, type MergeSession } from "../../lib/merge-types"

const LEVEL_LABEL: Record<ShareLevel, string> = {
  minimum: "Minimum", match_only: "Csak közös", standard: "Standard", full: "Teljes",
}

function confirmFull(level: ShareLevel): boolean {
  if (level !== "full") return true
  return window.confirm("A „Teljes” szint a jegyzeteket, e-maileket és telefonszámokat is megosztja a partnerrel. Biztosan ezt szeretnéd?")
}

export default function MergeSection() {
  const { uid, email } = useMyIdentity()
  const setActiveMergeSessionId = useAppStore(s => s.setActiveMergeSessionId)
  const { data: sessions = [] } = useMergeSessions()
  const createInvite = useCreateMergeInvite()
  const respond = useRespondToMerge()
  const revoke = useRevokeMerge()

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLevel, setInviteLevel] = useState<ShareLevel>("standard")

  // Treat time-expired rows as gone even if their status hasn't been flipped yet.
  const live = (s: MergeSession) => new Date(s.expires_at).getTime() > Date.now()
  const incoming = sessions.filter(s => s.status === "pending" && s.initiator_id !== uid && s.partner_email === email && live(s))
  const outgoing = sessions.filter(s => s.status === "pending" && s.initiator_id === uid && live(s))
  const active   = sessions.filter(s => s.status === "active" && live(s))

  async function sendInvite() {
    const e = inviteEmail.trim().toLowerCase()
    if (!e || !e.includes("@")) { toast.error("Adj meg egy érvényes e-mailt."); return }
    if (e === email) { toast.error("Magaddal nem oszthatod meg."); return }
    if (!confirmFull(inviteLevel)) return
    try {
      await createInvite.mutateAsync({ email: e, level: inviteLevel })
      toast.success("Meghívó elküldve.")
      setInviteEmail("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nem sikerült elküldeni.")
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <GitMerge size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-text">Háló megosztása (merge)</h2>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        Nézd össze a hálódat egy másik felhasználóéval. Csak a közös ismerősök és a rajtuk át elérhető
        emberek látszanak — a többi rejtve marad. Bármikor felbontható, 24 óra után lejár.
      </p>

      {/* Invite */}
      <div className="space-y-2">
        <Input label="Partner e-mail címe" type="email" value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)} placeholder="partner@example.com" />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select label="Megosztási szint" value={inviteLevel}
              onChange={e => setInviteLevel(e.target.value as ShareLevel)}
              options={SHARE_LEVELS.map(l => ({ value: l.value, label: l.label }))} />
          </div>
          <Button variant="primary" onClick={sendInvite} disabled={createInvite.isPending}>
            <Send size={13} /> Meghívás
          </Button>
        </div>
        <p className="text-[11px] text-muted">{SHARE_LEVELS.find(l => l.value === inviteLevel)?.sub}</p>
      </div>

      {/* Incoming */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wider">Beérkező meghívók</p>
          {incoming.map(s => <IncomingRow key={s.id} s={s} onRespond={respond.mutateAsync} />)}
        </div>
      )}

      {/* Active */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wider">Aktív megosztások</p>
          {active.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm bg-surface-2 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-text flex-1 truncate">
                {s.initiator_id === uid ? s.partner_email : "a partnered"}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setActiveMergeSessionId(s.id)}>
                Megnyitás <ArrowRight size={12} />
              </Button>
              <button onClick={() => revoke.mutate(s.id)} className="text-muted hover:text-red-600 p-1" aria-label="Felbontás">
                <ShieldOff size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wider">Elküldött meghívók</p>
          {outgoing.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm px-3 py-2 border border-border rounded-lg">
              <Clock size={13} className="text-muted flex-shrink-0" />
              <span className="text-text flex-1 truncate">{s.partner_email}</span>
              <span className="text-xs text-muted">{LEVEL_LABEL[s.initiator_share_level]}</span>
              <button onClick={() => revoke.mutate(s.id)} className="text-muted hover:text-red-600 p-1" aria-label="Visszavonás">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function IncomingRow({ s, onRespond }: {
  s: MergeSession
  onRespond: (a: { sessionId: string; accept: boolean; level: ShareLevel }) => Promise<void>
}) {
  const [level, setLevel] = useState<ShareLevel>("standard")
  const [busy, setBusy] = useState(false)

  async function act(accept: boolean) {
    if (accept && !confirmFull(level)) return
    setBusy(true)
    try {
      await onRespond({ sessionId: s.id, accept, level })
      toast.success(accept ? "Elfogadva — a megosztás aktív." : "Elutasítva.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba történt.")
    } finally { setBusy(false) }
  }

  return (
    <div className="border border-accent/30 bg-accent/5 rounded-lg p-3 space-y-2">
      <p className="text-sm text-text">Egy felhasználó megosztaná veled a hálóját.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select label="Amit te megosztasz" value={level} onChange={e => setLevel(e.target.value as ShareLevel)}
            options={SHARE_LEVELS.map(l => ({ value: l.value, label: l.label }))} />
        </div>
        <Button variant="primary" size="sm" onClick={() => act(true)} disabled={busy}><Check size={13} /> Elfogadom</Button>
        <Button variant="ghost" size="sm" onClick={() => act(false)} disabled={busy}><X size={13} /> Elutasítom</Button>
      </div>
    </div>
  )
}
