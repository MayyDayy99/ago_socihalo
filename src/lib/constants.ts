export const GROUPS = {
  family:       { label: "Család",    color: "#DC2626", icon: "♥" },
  work:         { label: "Munka",     color: "#2563EB", icon: "●" },
  friend:       { label: "Barát",     color: "#059669", icon: "★" },
  business:     { label: "Üzleti",    color: "#D97706", icon: "◆" },
  acquaintance: { label: "Ismerős",   color: "#7C3AED", icon: "○" },
  community:    { label: "Közösség",  color: "#DB2777", icon: "△" },
  other:        { label: "Egyéb",     color: "#6B7280", icon: "▫" },
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
