import { useMemo } from "react"
import { motion } from "framer-motion"
import { X, Check, Link2, Clock } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { usePeople } from "../../hooks/usePeople"
import { useMergeCandidates, useConfirmMatch } from "../../hooks/useMerge"
import { GROUPS } from "../../lib/constants"

interface Props {
  sessionId: string
  myRole: "initiator" | "partner"
  onClose: () => void
}

/** Review identity-match candidates: auto-matches are read-only; suggested need my confirmation. */
export default function MergeReview({ sessionId, myRole, onClose }: Props) {
  const { data: people = [] } = usePeople()
  const { data: candidates = [] } = useMergeCandidates(sessionId)
  const confirm = useConfirmMatch()

  const byId = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const mineOf = (c: { initiator_person_id: string; partner_person_id: string }) =>
    myRole === "initiator" ? c.initiator_person_id : c.partner_person_id
  const iConfirmed = (c: { confirmed_by_initiator: boolean; confirmed_by_partner: boolean }) =>
    myRole === "initiator" ? c.confirmed_by_initiator : c.confirmed_by_partner

  const auto = candidates.filter(c => c.match_kind === "phone" || c.match_kind === "email")
  const suggested = candidates.filter(c => c.match_kind === "suggested" || c.match_kind === "manual")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }} onClick={e => e.stopPropagation()}
        className="bg-surface border border-border-strong rounded-xl w-full max-w-md shadow-panel overflow-hidden max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-text font-semibold text-sm">Azonosságok egyeztetése</h2>
            <p className="text-muted text-xs mt-0.5">Kik ugyanazok a személyek a két hálóban?</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text p-1" aria-label="Bezárás"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {auto.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Automatikus (telefon / e-mail)</p>
              <div className="space-y-1">
                {auto.map(c => {
                  const p = byId.get(mineOf(c))
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-sm px-3 py-2 bg-surface-2 rounded-lg">
                      <Link2 size={13} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-text flex-1 truncate">{p?.display_name ?? "—"}</span>
                      <span className="text-xs text-emerald-600">összekapcsolva</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Javasolt (azonos név)</p>
            {suggested.length === 0 ? (
              <p className="text-muted text-sm py-3 text-center">Nincs több egyeztetendő.</p>
            ) : (
              <div className="space-y-1">
                {suggested.map(c => {
                  const p = byId.get(mineOf(c))
                  const g = p?.group_key ? GROUPS[p.group_key] : null
                  const mine = iConfirmed(c)
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-sm px-3 py-2 border border-border rounded-lg">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                        style={{ background: g ? g.color + "22" : "#F3F4F6", color: g ? g.color : "#6B7280" }}>
                        {(p?.display_name[0] ?? "?").toUpperCase()}
                      </span>
                      <span className="text-text flex-1 truncate">{p?.display_name ?? "—"}</span>
                      {mine ? (
                        <span className="text-xs text-muted inline-flex items-center gap-1"><Clock size={11} /> vár a partnerre</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => confirm.mutate({ mapId: c.id, confirm: true, sessionId })}
                            className="text-emerald-600 hover:bg-emerald-50 rounded p-1" aria-label="Ugyanaz">
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => confirm.mutate({ mapId: c.id, confirm: false, sessionId })}
                            className="text-muted hover:text-red-600 hover:bg-red-50 rounded p-1" aria-label="Nem ugyanaz">
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-border">
          <Button variant="primary" size="sm" onClick={onClose}>Kész</Button>
        </div>
      </motion.div>
    </div>
  )
}
