export const GROUPS = {
  family:       { label: "Család",    color: "#C85454", icon: "♥" },
  work:         { label: "Munka",     color: "#5085B5", icon: "●" },
  friend:       { label: "Barát",     color: "#4FA870", icon: "★" },
  business:     { label: "Üzleti",    color: "#C4A030", icon: "◆" },
  acquaintance: { label: "Ismerős",   color: "#7E6AB0", icon: "○" },
  community:    { label: "Közösség",  color: "#C06090", icon: "△" },
  other:        { label: "Egyéb",     color: "#7A7568", icon: "▫" },
} as const

export const ROLES = {
  key:        { label: "Kulcsember", badge: "★", color: "#E09A4A" },
  gatekeeper: { label: "Kapuőr",     badge: "🛡", color: "#C85454" },
  connector:  { label: "Összekötő",  badge: "⬡", color: "#4FA870" },
  mentor:     { label: "Mentor",     badge: "◈", color: "#7E6AB0" },
  dormant:    { label: "Alvó",       badge: "◌", color: "#7A7568" },
  none:       { label: "—",          badge: "",  color: "transparent" },
} as const

export const CONNECTION_COLORS: Record<string, string> = {
  family:       "#C85454",
  work:         "#5085B5",
  friend:       "#4FA870",
  business:     "#C4A030",
  acquaintance: "#7E6AB0",
  community:    "#C06090",
  bridge:       "#E09A4A",
  other:        "#7A7568",
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
