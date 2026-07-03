import { useState } from "react"
import { signOut as firebaseSignOut } from "../../lib/firebase"
import { Button } from "../../components/ui/Button"
import { usePeople } from "../../hooks/usePeople"
import { useConnections } from "../../hooks/useConnections"
import { usePwaInstall } from "../../hooks/usePwaInstall"
import { exportAllVcf, exportAllJson } from "../../lib/vcard-export"
import { Download, LogOut, Smartphone } from "lucide-react"
import MergeSection from "../Merge/MergeSection"

export default function SettingsView() {
  const { data: people = [] } = usePeople()
  const { data: connections = [] } = useConnections()
  const { canInstall, install } = usePwaInstall()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await firebaseSignOut()
  }

  return (
    <div className="h-full overflow-y-auto bg-app p-6">
      <div className="max-w-lg mx-auto space-y-5">
        <h1 className="text-xl font-semibold text-text">Beállítások</h1>

        {canInstall && (
          <section className="bg-accent/5 border border-accent/30 rounded-xl p-5 flex items-center gap-4">
            <Smartphone size={20} className="text-accent flex-shrink-0" />
            <div className="flex-1">
              <p className="text-text text-sm font-medium">Telepítés az eszközre</p>
              <p className="text-muted text-xs">Asztali ikon, offline elérés</p>
            </div>
            <Button variant="primary" size="sm" onClick={install}>Telepítés</Button>
          </section>
        )}

        <section className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-text">Fiók</h2>
          <p className="text-xs text-muted">Bejelentkezés Google-fiókkal (Firebase Auth). Jelszó nincs.</p>
          <Button variant="danger" onClick={signOut} disabled={signingOut}>
            <LogOut size={13} /> {signingOut ? "Kijelentkezés…" : "Kijelentkezés"}
          </Button>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-4">
          <h2 className="text-sm font-semibold text-text">Adatok exportálása</h2>
          <div className="text-sm text-muted space-y-0.5">
            <p>{people.filter(p => !p.archived).length} aktív személy · {people.filter(p => p.archived).length} archivált</p>
            <p>{connections.length} kapcsolat</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => exportAllJson(people, connections)}>
              <Download size={13} /> JSON
            </Button>
            <Button variant="secondary" onClick={() => exportAllVcf(people.filter(p => !p.archived))}>
              <Download size={13} /> VCF (névjegyek)
            </Button>
          </div>
          <p className="text-xs text-muted">A VCF fájl visszaimportálható Google Névjegyekbe, macOS-be vagy Outlookba.</p>
        </section>

        <MergeSection />

        <section className="bg-surface border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-text mb-3">Rendszer</h2>
          <div className="text-xs text-muted space-y-1">
            <p>React 18 · TypeScript · Vite 5</p>
            <p>Tailwind CSS 3 · Framer Motion · D3 v7</p>
            <p>Firebase Auth (Google) · Supabase (Postgres + Edge Functions)</p>
            <p>GitHub Pages · pnpm</p>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-text mb-2">Billentyűparancsok</h2>
          <p className="text-xs text-muted">
            Nyomd meg a <kbd className="border border-border-strong rounded px-1.5 py-0.5 bg-surface-2 text-text">?</kbd> billentyűt
            bármikor az összes parancs megtekintéséhez.
          </p>
        </section>

        <section className="bg-surface-2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-700 mb-2">Konfiguráció</h2>
          <ol className="text-xs text-muted space-y-1 list-decimal list-inside">
            <li>Supabase migrációk: <code className="text-accent">supabase/migrations/</code> (a 0004 állítja át a sémát Firebase-authra)</li>
            <li>Firebase: Authentication → Sign-in method → Google bekapcsolva ✓</li>
            <li>Supabase: Authentication → Third Party Auth → Firebase hozzáadva (project ID)</li>
            <li>Engedélyezett domain: <code className="text-accent">MayyDayy99.github.io</code> (Firebase → Authorized domains)</li>
          </ol>
        </section>
      </div>
    </div>
  )
}
