export const GROUPS = {
  family:       { label: "Család",    color: "#F87171", icon: "♥" },
  work:         { label: "Munka",     color: "#60A5FA", icon: "●" },
  friend:       { label: "Barát",     color: "#34D399", icon: "★" },
  business:     { label: "Üzleti",    color: "#FBBF24", icon: "◆" },
  acquaintance: { label: "Ismerős",   color: "#A78BFA", icon: "○" },
  community:    { label: "Közösség",  color: "#F472B6", icon: "△" },
  other:        { label: "Egyéb",     color: "#94A3B8", icon: "▫" },
} as const

export const ROLES = {
  key:        { label: "Kulcsember", badge: "★", color: "#D97706" },
  gatekeeper: { label: "Kapuőr",     badge: "🛡", color: "#DC2626" },
  connector:  { label: "Összekötő",  badge: "⬡", color: "#059669" },
  mentor:     { label: "Mentor",     badge: "◈", color: "#7C3AED" },
  dormant:    { label: "Alvó",       badge: "◌", color: "#9CA3AF" },
  none:       { label: "—",          badge: "",  color: "transparent" },
} as const

export const CONNECTION_COLORS: Record<string, string> = {
  family:       "#DC2626",
  work:         "#2563EB",
  friend:       "#059669",
  business:     "#D97706",
  acquaintance: "#7C3AED",
  community:   "#DB2777",
  bridge:       "#F59E0B",
  other:        "#9CA3AF",
}

export const SOURCE_ICONS = {
  phone:    "📱",
  facebook: "f",
  linkedin: "in",
  manual:   "✎",
} as const

export type GroupKey   = keyof typeof GROUPS
export type RoleKey    = keyof typeof ROLES
export type SourceType = keyof typeof SOURCE_ICONS
