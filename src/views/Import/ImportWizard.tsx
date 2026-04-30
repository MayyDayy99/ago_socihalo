import { useState } from "react"
import { Smartphone, Facebook, UserPlus, FileText, Table2 } from "lucide-react"
import FacebookStep  from "./FacebookStep"
import CardDavStep  from "./CardDavStep"
import VcfStep      from "./VcfStep"
import CsvStep      from "./CsvStep"
import ReviewStep   from "./ReviewStep"
import { useAppStore } from "../../store/useAppStore"

type Source = "facebook" | "carddav" | "vcf" | "csv" | null
type Step   = "choose" | "import" | "review"

interface SourceCard {
  id: Source
  icon: React.ReactNode
  title: string
  sub: string
}

const SOURCES: SourceCard[] = [
  {
    id: "vcf",
    icon: <FileText size={18} className="text-green-400" />,
    title: "VCF fájl (Google, macOS, Outlook…)",
    sub: "Bármilyen alkalmazásból exportált .vcf névjegyfájl",
  },
  {
    id: "csv",
    icon: <Table2 size={18} className="text-yellow-400" />,
    title: "CSV / táblázat",
    sub: "Excel, Google Táblázat, LinkedIn, bármilyen .csv fájl",
  },
  {
    id: "carddav",
    icon: <Smartphone size={18} className="text-accent" />,
    title: "iCloud (CardDAV, automatikus)",
    sub: "iPhone névjegyeid importálása Apple ID + app-jelszóval",
  },
  {
    id: "facebook",
    icon: <Facebook size={18} className="text-blue-400" />,
    title: "Facebook barátok",
    sub: "Facebook adatexport ZIP feltöltése",
  },
]

export default function ImportWizard() {
  const { setCreatePersonOpen } = useAppStore()
  const [source, setSource] = useState<Source>(null)
  const [step, setStep]     = useState<Step>("choose")
  const [candidates, setCandidates] = useState<unknown[]>([])

  function handleParsed(c: unknown[]) {
    setCandidates(c)
    setStep("review")
  }

  function reset() {
    setSource(null)
    setStep("choose")
    setCandidates([])
  }

  return (
    <div className="h-full overflow-y-auto bg-app p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-lg font-bold text-text mb-1">Névjegyek importálása</h1>
        <p className="text-muted text-sm mb-6">Töltsd fel meglévő kapcsolataidat egyszerre</p>

        {step === "choose" && (
          <div className="space-y-2.5">
            {SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => { setSource(s.id); setStep("import") }}
                className="w-full flex items-center gap-4 bg-surface border border-border rounded-xl p-4 hover:border-accent/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                  {s.icon}
                </div>
                <div>
                  <p className="text-text text-sm font-medium">{s.title}</p>
                  <p className="text-muted text-xs">{s.sub}</p>
                </div>
              </button>
            ))}

            <div className="border-t border-border pt-4 mt-2">
              <p className="text-xs text-muted mb-2">Vagy egyenként:</p>
              <button
                onClick={() => setCreatePersonOpen(true)}
                className="flex items-center gap-2 text-accent text-sm hover:underline"
              >
                <UserPlus size={14} /> Személy manuális hozzáadása
              </button>
            </div>
          </div>
        )}

        {step === "import" && (
          <div>
            <button onClick={reset} className="text-xs text-muted hover:text-text mb-5 flex items-center gap-1">
              ← Vissza a forrásválasztóhoz
            </button>
            <h2 className="text-text font-bold mb-4">
              {SOURCES.find(s => s.id === source)?.title}
            </h2>
            {source === "vcf"      && <VcfStep      onParsed={handleParsed} />}
            {source === "csv"      && <CsvStep      onParsed={handleParsed} />}
            {source === "facebook" && <FacebookStep onParsed={handleParsed} />}
            {source === "carddav"  && <CardDavStep  onParsed={handleParsed} />}
          </div>
        )}

        {step === "review" && (
          <div>
            <button onClick={reset} className="text-xs text-muted hover:text-text mb-4 flex items-center gap-1">
              ← Vissza
            </button>
            <h2 className="text-text font-bold mb-3">Áttekintés és importálás</h2>
            <ReviewStep candidates={candidates as never} onDone={reset} />
          </div>
        )}
      </div>
    </div>
  )
}
