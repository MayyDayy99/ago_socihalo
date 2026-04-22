import type { GroupKey, RoleKey, SourceType } from "../lib/constants"

export interface Person {
  id: string
  user_id: string
  display_name: string
  photo_url: string | null
  phone_numbers: string[]
  emails: string[]
  group_key: GroupKey | null
  role_key: RoleKey
  tags: string[]
  strength: number
  last_contact: string | null
  met_at: string | null
  notes: string | null
  sources: Array<{ type: SourceType; imported_at: string }>
  archived: boolean
  pinned_x: number | null
  pinned_y: number | null
  created_at: string
  updated_at: string
}

export interface Connection {
  id: string
  user_id: string
  from_id: string
  to_id: string
  type: ConnectionType | null
  directed: boolean
  strength: number | null
  context: string | null
  confidence: "confirmed" | "inferred" | "suggested"
  created_at: string
}

export type ConnectionType =
  | "family" | "work" | "friend" | "business"
  | "acquaintance" | "community" | "bridge" | "other"
