import { motion, AnimatePresence } from "framer-motion"
import { GitMerge, ArrowRight } from "lucide-react"
import { useAppStore } from "../store/useAppStore"
import { useMergeSessions, useMyIdentity } from "../hooks/useMerge"

/** Global banner: alerts the invitee (live) that someone wants to merge networks. */
export default function MergeInviteBanner() {
  const { uid, email } = useMyIdentity()
  const setActiveView = useAppStore(s => s.setActiveView)
  const { data: sessions = [] } = useMergeSessions()

  const incoming = sessions.filter(s => s.status === "pending" && s.initiator_id !== uid && s.partner_email === email)
  if (incoming.length === 0) return null

  return (
    <AnimatePresence>
      <motion.button
        initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
        onClick={() => setActiveView("settings")}
        className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-accent text-white text-sm rounded-full pl-4 pr-3 py-2 shadow-panel"
      >
        <GitMerge size={14} />
        <span>{incoming.length === 1 ? "Egy felhasználó megosztaná veled a hálóját" : `${incoming.length} megosztási meghívó vár rád`}</span>
        <span className="inline-flex items-center gap-1 font-medium">Megnézem <ArrowRight size={13} /></span>
      </motion.button>
    </AnimatePresence>
  )
}
