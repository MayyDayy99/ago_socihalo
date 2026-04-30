import { useEffect, useState, useCallback, lazy, Suspense } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./lib/supabase"
import { useAppStore } from "./store/useAppStore"
import { useIsMobile } from "./hooks/useIsMobile"

import MagicLinkScreen   from "./views/Auth/MagicLinkScreen"
import MapView           from "./views/Map/MapView"
import MapModeToggle     from "./views/Map/MapModeToggle"
import PeopleList        from "./views/List/PeopleList"

// 3D view bundles three.js + react-three (~1MB) — lazy so 2D-only users never download it
const Map3DView = lazy(() => import("./views/Map3D/Map3DView"))
import AnalyticsView     from "./views/Analytics/AnalyticsView"
import ImportWizard      from "./views/Import/ImportWizard"
import SettingsView      from "./views/Settings/SettingsView"
import PersonDetail      from "./views/Detail/PersonDetail"
import CommandPalette    from "./views/CommandPalette/CommandPalette"
import CreatePersonModal from "./components/CreatePersonModal"
import ShortcutsOverlay  from "./components/ShortcutsOverlay"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { ToastContainer } from "./components/ui/Toast"

import { Map, List, BarChart2, Upload, Settings, Search, Keyboard } from "lucide-react"
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

function NexusLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="5" fill="#374151"/>
      <circle cx="6" cy="8" r="3" fill="#059669"/>
      <circle cx="26" cy="8" r="3" fill="#DC2626"/>
      <circle cx="6" cy="24" r="3" fill="#D97706"/>
      <circle cx="26" cy="24" r="3" fill="#7C3AED"/>
      <line x1="16" y1="16" x2="6"  y2="8"  stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
      <line x1="16" y1="16" x2="26" y2="8"  stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
      <line x1="16" y1="16" x2="6"  y2="24" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
      <line x1="16" y1="16" x2="26" y2="24" stroke="#9CA3AF" strokeWidth="1.5" opacity="0.7"/>
    </svg>
  )
}

function AppShell() {
  const {
    activeView, setActiveView,
    mapMode,
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
        <nav className="flex items-center h-12 bg-surface border-b border-border-strong px-3 gap-1 flex-shrink-0">
          <div className="flex items-center gap-2 mr-3 pl-1">
            <NexusLogo size={18} />
            <span className="text-sm font-semibold tracking-tight text-text">Nexus</span>
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          {NAV.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`relative flex items-center gap-1.5 px-3 h-8 rounded text-sm transition-colors
                  ${active
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted hover:text-text hover:bg-surface-2"}`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-2.5 h-8 rounded text-xs text-muted hover:text-text hover:bg-surface-2 transition-colors"
              title="Parancspaletta (Ctrl+K)"
            >
              <Search size={13} />
              <span>Keresés</span>
              <kbd className="border border-border-strong rounded px-1 py-0.5 text-[10px] bg-surface-2 ml-1">Ctrl+K</kbd>
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="text-muted hover:text-text p-1.5 rounded hover:bg-surface-2 transition-colors"
              title="Billentyűparancsok (?)"
              aria-label="Billentyűparancsok"
            >
              <Keyboard size={14} />
            </button>
          </div>
        </nav>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <div className="flex items-center justify-between h-12 bg-surface border-b border-border-strong px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <NexusLogo size={16} />
            <span className="text-sm font-semibold tracking-tight text-text">Nexus</span>
            <span className="text-sm text-muted">·</span>
            <span className="text-sm text-text">{NAV.find(n => n.id === activeView)?.label}</span>
          </div>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="text-muted hover:text-text p-1.5 rounded hover:bg-surface-2"
            aria-label="Keresés"
          >
            <Search size={16} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex overflow-hidden ${isMobile ? "flex-col" : ""}`}>
        <main className="flex-1 overflow-hidden min-w-0 relative">
          <ErrorBoundary>
            {activeView === "map" && (
              <>
                {mapMode === "3d" ? (
                  <Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-app">
                      <div className="text-center">
                        <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-muted text-sm">3D motor betöltése…</p>
                      </div>
                    </div>
                  }>
                    <Map3DView />
                  </Suspense>
                ) : (
                  <MapView />
                )}
                <MapModeToggle />
              </>
            )}
            {activeView === "list"      && <PeopleList />}
            {activeView === "analytics" && <AnalyticsView />}
            {activeView === "import"    && <ImportWizard />}
            {activeView === "settings"  && <SettingsView />}
          </ErrorBoundary>
        </main>

      </div>

      {/* Desktop side panel — overlay (fixed-positioned), so it doesn't push the map.
           No key on the component — switching persons re-renders content in place
           instead of remounting the entire panel. */}
      {!isMobile && (
        <AnimatePresence>
          {selectedPersonId && <PersonDetail />}
        </AnimatePresence>
      )}

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="flex items-center justify-around h-14 bg-surface border-t border-border-strong flex-shrink-0 px-2">
          {NAV.map(({ id, Icon, label }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0 flex-1
                  ${active ? "text-accent" : "text-muted"}`}
              >
                <Icon size={18} />
                <span className="text-[10px] truncate">{label}</span>
              </button>
            )
          })}
        </nav>
      )}

      {/* Mobile bottom sheet */}
      {isMobile && (
        <AnimatePresence>
          {selectedPersonId && <PersonDetail />}
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
      <ToastContainer />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-app flex items-center justify-center">
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted text-sm">Betöltés…</p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    let mounted = true

    function cleanAuthUrl() {
      const url = new URL(window.location.href)
      const authParams = ["code", "error", "error_code", "error_description"]
      const hadAuthParams = authParams.some(param => url.searchParams.has(param))
      authParams.forEach(param => url.searchParams.delete(param))

      if (hadAuthParams || url.hash.includes("access_token") || url.hash.includes("refresh_token")) {
        window.history.replaceState(
          {},
          document.title,
          `${url.pathname}${url.search}`
        )
      }
    }

    async function initSession() {
      const url = new URL(window.location.href)
      const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error")
      if (authError) {
        console.error("Supabase auth callback failed:", authError)
        cleanAuthUrl()
        if (mounted) setSession(null)
        return
      }

      const code = url.searchParams.get("code")
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error("Supabase auth code exchange failed:", error.message)
          if (mounted) setSession(null)
        } else if (mounted) {
          setSession(data.session)
        }
        cleanAuthUrl()
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      cleanAuthUrl()
      if (mounted) setSession(session)
    }

    initSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (mounted) setSession(session)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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
