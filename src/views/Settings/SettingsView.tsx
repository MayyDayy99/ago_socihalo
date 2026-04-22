import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/Button"
import { usePeople } from "../../hooks/usePeople"
import { useConnections } from "../../hooks/useConnections"
import { usePwaInstall } from "../../hooks/usePwaInstall"
import { exportAllVcf, exportAllJson } from "../../lib/vcard-export"
import { Download, LogOut, Smartphone } from "lucide-react"

export default function SettingsView() {
  const { data: people = [] } = usePeople()
  const { data: connections = [] } = useConnections()
  const { canInstall, install } = usePwaInstall()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <div className="h-full overflow-y-auto bg-app font-mono p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-text font-serif">Beállítások</h1>

        {/* PWA install */}
        {canInstall && (
          <section className="bg-accent/10 border border-accent/30 rounded-xl p-5 flex items-center gap-4">
            <Smartphone size={20} className="text-accent flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Telepítés az eszközre</p>
              <p className="text-muted text-xs">Asztali ikon, offline elérés</p>
            </div>
            <Button variant="primary" size="sm" onClick={install}>Telepítés</Button>
          </section>
        )}

        {/* Account */}
        <section className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-text font-serif">Fiók</h2>
          <p className="text-xs text-muted">Bejelentkezés magic link-kel. Jelszó nincs.</p>
          <Button variant="danger" onClick={signOut} disabled={signingOut}>
            <LogOut size={13} /> {signingOut ? "Kijelentkezés..." : "Kijelentkezés"}
          </Button>
        </section>

        {/* Data export */}
        <section className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-text font-serif">Adatok exportálása</h2>
          <div className="text-sm text-muted space-y-0.5">
            <p>{people.filter(p => !p.archived).length} aktív személy · {people.filter(p => p.archived).length} archivált</p>
            <p>{connections.length} kapcsolat</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => exportAllJson(people, connections)}
            >
              <Download size={13} /> JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportAllVcf(people.filter(p => !p.archived))}
            >
              <Download size={13} /> VCF (névjegyek)
            </Button>
          </div>
          <p className="text-xs text-muted">A VCF fájl visszaimportálható Google Névjegyekbe, macOS-be vagy Outlookba.</p>
        </section>

        {/* Stack */}
        <section className="bg-surface border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-bold text-text font-serif mb-3">Rendszer</h2>
          <div className="text-xs text-muted space-y-1">
            <p>React 18 · TypeScript · Vite 5</p>
            <p>Tailwind CSS 3 · Framer Motion · D3 v7</p>
            <p>Supabase (Postgres + Auth + Edge Functions)</p>
            <p>GitHub Pages · pnpm</p>
          </div>
        </section>

        {/* Shortcuts hint */}
        <section className="bg-surface border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-bold text-text font-serif mb-2">Billentyűparancsok</h2>
          <p className="text-xs text-muted">
            Nyomd meg a <kbd className="border border-border rounded px-1.5 py-0.5 bg-surface-2 text-white">?</kbd> billentyűt
            bármikor az összes parancs megtekintéséhez.
          </p>
        </section>

        {/* Supabase setup */}
        <section className="bg-surface-2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-yellow-400 mb-2">Supabase konfiguráció</h2>
          <ol className="text-xs text-muted space-y-1 list-decimal list-inside">
            <li>Migráció: <code className="text-accent">supabase/migrations/0001_initial.sql</code></li>
            <li>Email Magic Link bekapcsolva ✓</li>
            <li>Site URL: <code className="text-accent">https://MayyDayy99.github.io/ago_socihalo/</code></li>
            <li>Első login után: signup letiltva</li>
          </ol>
        </section>
      </div>
    </div>
  )
}
