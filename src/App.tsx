import { useEffect, useState, useCallback } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./lib/supabase"
import { useAppStore } from "./store/useAppStore"
import { useIsMobile } from "./hooks/useIsMobile"

import MagicLinkScreen   from "./views/Auth/MagicLinkScreen"
import MapView           from "./views/Map/MapView"
import PeopleList        from "./views/List/PeopleList"
import AnalyticsView     from "./views/Analytics/AnalyticsView"
import ImportWizard      from "./views/Import/ImportWizard"
import SettingsView      from "./views/Settings/SettingsView"
import PersonDetail      from "./views/Detail/PersonDetail"
import CommandPalette    from "./views/CommandPalette/CommandPalette"
import CreatePersonModal from "./components/CreatePersonModal"
import ShortcutsOverlay  from "./components/ShortcutsOverlay"
import { ErrorBoundary } from "./components/ErrorBoundary"

import { Map, List, BarChart2, Upload, Settings } from "lucide-react"
import type { View } from "./store/useAppStore"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

const NAV: Array<{ id: View; label: string; Icon: typeof Map }> = [
  { id: "map",       label: "Térkép",      Icon: Map },
  { id: "list",      label: "Lista",       Icon: List },
  { id: "analytics", label: "Elemzés",     Icon: BarChart2 },
  { id: "import",    label: "Importálás",  Icon: Upload },
  { id: "settings",  label: "Beállítások", Icon: Settings },
]

function AppShell() {
  const {
    activeView, setActiveView,
    selectedPersonId,
    commandPaletteOpen, setCommandPaletteOpen,
  } = useAppStore()

  const isMobile = useIsMobile()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setCommandPaletteOpen(true)
    }
    if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
      setShortcutsOpen(s => !s)
    }
  }, [setCommandPaletteOpen])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className={`flex flex-col bg-app ${isMobile ? "h-[100dvh]" : "h-screen"}`}>
      {/* Top navigation — desktop */}
      {!isMobile && (
        <nav className="flex items-center h-11 bg-surface border-b border-border px-4 gap-0.5 flex-shrink-0 shadow-card">
          <div className="flex items-center gap-2 mr-5">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="5" fill="#C9924A"/>
              <circle cx="6" cy="8" r="3" fill="#4D9E6E"/>
              <circle cx="26" cy="8" r="3" fill="#BF5454"/>
              <circle cx="6" cy="24" r="3" fill="#C49A3D"/>
              <circle cx="26" cy="24" r="3" fill="#7A68A8"/>
              <line x1="16" y1="16" x2="6" y2="8" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="16" x2="26" y2="8" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="16" x2="6" y2="24" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="16" x2="26" y2="24" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
            </svg>
            <span className="text-sm font-bold tracking-widest text-text font-serif">Nexus</span>
          </div>
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors
                ${activeView === id
                  ? "bg-surface-2 text-text"
                  : "text-muted hover:text-text hover:bg-surface-2/50"}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShortcutsOpen(true)}
              className="text-muted hover:text-white text-xs font-mono transition-colors"
              title="Billentyűparancsok (?)"
            >
              ?
            </button>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
            >
              <kbd className="border border-border rounded px-1 py-0.5 text-xs font-mono bg-surface-2">⌘K</kbd>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <div className="flex items-center justify-between h-11 bg-surface border-b border-border px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="5" fill="#C9924A"/>
              <circle cx="6" cy="8" r="3" fill="#4D9E6E"/>
              <circle cx="26" cy="8" r="3" fill="#BF5454"/>
              <circle cx="6" cy="24" r="3" fill="#C49A3D"/>
              <circle cx="26" cy="24" r="3" fill="#7A68A8"/>
              <line x1="16" y1="16" x2="6" y2="8" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="16" x2="26" y2="8" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="16" x2="6" y2="24" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="16" x2="26" y2="24" stroke="#C9924A" strokeWidth="1.5" opacity="0.5"/>
            </svg>
            <span className="text-sm font-bold tracking-widest text-text font-serif">Nexus</span>
          </div>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="text-muted p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex overflow-hidden ${isMobile ? "flex-col" : ""}`}>
        <main className="flex-1 overflow-hidden">
          <ErrorBoundary>
            {activeView === "map"       && <MapView />}
            {activeView === "list"      && <PeopleList />}
            {activeView === "analytics" && <AnalyticsView />}
            {activeView === "import"    && <ImportWizard />}
            {activeView === "settings"  && <SettingsView />}
          </ErrorBoundary>
        </main>

        {/* Desktop side panel */}
        {!isMobile && (
          <AnimatePresence>
            {selectedPersonId && <PersonDetail key={selectedPersonId} />}
          </AnimatePresence>
        )}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="flex items-center justify-around h-14 bg-surface border-t border-border flex-shrink-0 px-2">
          {NAV.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0
                ${activeView === id ? "text-accent" : "text-muted"}`}
            >
              <Icon size={18} />
              <span className="text-[9px] font-mono truncate">{label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Mobile bottom sheet */}
      {isMobile && (
        <AnimatePresence>
          {selectedPersonId && <PersonDetail key={selectedPersonId} />}
        </AnimatePresence>
      )}

      {/* Global overlays */}
      <AnimatePresence>
        {commandPaletteOpen && <CommandPalette />}
      </AnimatePresence>

      <AnimatePresence>
        {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      </AnimatePresence>

      <CreatePersonModal />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-app flex items-center justify-center font-mono">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted text-sm font-serif">Betöltés...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <LoadingScreen />
  if (!session)             return <MagicLinkScreen />

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
