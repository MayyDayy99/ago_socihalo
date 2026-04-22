import { create } from "zustand"
import type { GroupKey, RoleKey } from "../lib/constants"

export type View = "map" | "list" | "analytics" | "import" | "settings"

interface FilterState {
  search: string
  groups: GroupKey[]
  roles: RoleKey[]
  strengthMin: number
  showArchived: boolean
}

interface AppStore {
  activeView: View
  setActiveView: (v: View) => void

  selectedPersonId: string | null
  setSelectedPersonId: (id: string | null) => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  filters: FilterState
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  resetFilters: () => void

  connectMode: boolean
  setConnectMode: (v: boolean) => void
  connectFromId: string | null
  setConnectFromId: (id: string | null) => void

  pathHighlight: string[] | null
  setPathHighlight: (path: string[] | null) => void

  createPersonOpen: boolean
  setCreatePersonOpen: (open: boolean) => void
}

const defaultFilters: FilterState = {
  search: "",
  groups: [],
  roles: [],
  strengthMin: 1,
  showArchived: false,
}

export const useAppStore = create<AppStore>((set) => ({
  activeView: "map",
  setActiveView: (v) => set({ activeView: v }),

  selectedPersonId: null,
  setSelectedPersonId: (id) => set({ selectedPersonId: id }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  filters: defaultFilters,
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),

  connectMode: false,
  setConnectMode: (v) => set({ connectMode: v, connectFromId: v ? null : null }),
  connectFromId: null,
  setConnectFromId: (id) => set({ connectFromId: id }),

  pathHighlight: null,
  setPathHighlight: (path) => set({ pathHighlight: path }),

  createPersonOpen: false,
  setCreatePersonOpen: (open) => set({ createPersonOpen: open }),
}))
