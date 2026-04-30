import { create } from "zustand"
import type { GroupKey, RoleKey } from "../lib/constants"

export type View = "map" | "list" | "analytics" | "import" | "settings"
export type MapMode = "2d" | "3d"

const MAP_MODE_KEY = "nexus.mapMode"
function loadMapMode(): MapMode {
  if (typeof localStorage === "undefined") return "2d"
  const v = localStorage.getItem(MAP_MODE_KEY)
  return v === "3d" ? "3d" : "2d"
}

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

  mapMode: MapMode
  setMapMode: (m: MapMode) => void

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

  mapMode: loadMapMode(),
  setMapMode: (m) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(MAP_MODE_KEY, m)
    set({ mapMode: m })
  },

  selectedPersonId: null,
  setSelectedPersonId: (id) => set({ selectedPersonId: id }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  filters: defaultFilters,
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),

  connectMode: false,
  setConnectMode: (v) => set({ connectMode: v }),
  connectFromId: null,
  setConnectFromId: (id) => set({ connectFromId: id }),

  pathHighlight: null,
  setPathHighlight: (path) => set({ pathHighlight: path }),

  createPersonOpen: false,
  setCreatePersonOpen: (open) => set({ createPersonOpen: open }),
}))
