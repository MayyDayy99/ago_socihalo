export type ShareLevel = "minimum" | "match_only" | "standard" | "full"
export type MergeStatus = "pending" | "active" | "declined" | "expired" | "revoked"

export const SHARE_LEVELS: { value: ShareLevel; label: string; sub: string }[] = [
  { value: "match_only", label: "Csak közös",  sub: "Csak azok, akiket mindketten ismertek (név + csoport)" },
  { value: "minimum",    label: "Minimum",     sub: "Csak nevek és csoport" },
  { value: "standard",   label: "Standard",    sub: "Név, csoport, szerep, erősség — jegyzet/elérhetőség nélkül" },
  { value: "full",       label: "Teljes",      sub: "Minden nem-archivált mező (jegyzet, e-mail, telefon is)" },
]

export interface MergeSession {
  id: string
  initiator_id: string
  partner_email: string
  partner_id: string | null
  initiator_share_level: ShareLevel
  partner_share_level: ShareLevel | null
  status: MergeStatus
  created_at: string
  expires_at: string
  revoked_at: string | null
}

export interface MergeCandidate {
  id: string
  session_id: string
  initiator_person_id: string
  partner_person_id: string
  match_kind: "phone" | "email" | "manual" | "suggested"
  confirmed_by_initiator: boolean
  confirmed_by_partner: boolean
}

export interface MergePartnerPerson {
  id: string
  display_name: string
  group_key: string | null
  role_key?: string
  strength?: number
  emails?: string[]
  phone_numbers?: string[]
  notes?: string | null
  in_overlap: boolean
}

export interface MergeView {
  session: {
    id: string
    status: MergeStatus
    expires_at: string
    my_role: "initiator" | "partner"
    other_share_level: ShareLevel
  }
  partner_people: MergePartnerPerson[]
  partner_connections: Array<{ from_id: string; to_id: string; type: string | null; strength?: number }>
  identity_pairs: Array<{ mine: string; theirs: string }>
  hidden_partner_count: number
}
