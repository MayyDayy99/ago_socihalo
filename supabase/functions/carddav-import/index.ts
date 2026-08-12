// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

// Lock CORS to known app origins (configurable via ALLOWED_ORIGINS, comma-separated)
// instead of "*", so the function can't be driven from arbitrary sites. The default now
// covers the live custom domain; the legacy Pages URL and local dev are kept for convenience.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://nexus.maydayprod.app,https://mayydayy99.github.io,http://localhost:5173")
  .split(",").map((s) => s.trim()).filter(Boolean)

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? ""
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  }
}

serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405, headers: cors })

  // Require an Authorization header (the app sends the Firebase bearer). This stops the
  // function being used as an anonymous credential-checking oracle / relay.
  if (!req.headers.get("Authorization")) {
    return json(cors, { error: "Hitelesítés szükséges" }, 401)
  }

  try {
    const { appleId, appPassword } = await req.json()
    if (!appleId || !appPassword) {
      return json(cors, { error: "Hiányzó hitelesítési adatok" }, 400)
    }

    const auth = "Basic " + btoa(`${appleId}:${appPassword}`)

    const principalXml = await propfind("https://contacts.icloud.com/", auth, 0, `
      <?xml version="1.0" encoding="utf-8"?>
      <propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>
    `)
    const principalHref = extractXml(principalXml, "current-user-principal", "href")
    if (!principalHref) throw new Error("Nem sikerült megtalálni a principal URL-t")

    const homeXml = await propfind(abs(principalHref), auth, 0, `
      <?xml version="1.0" encoding="utf-8"?>
      <propfind xmlns="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
        <prop><card:addressbook-home-set/></prop>
      </propfind>
    `)
    const homeHref = extractXml(homeXml, "addressbook-home-set", "href")
    if (!homeHref) throw new Error("Nem sikerült megtalálni a névjegykönyv home-ot")

    const listXml = await propfind(abs(homeHref), auth, 1, `
      <?xml version="1.0" encoding="utf-8"?>
      <propfind xmlns="DAV:"><prop><resourcetype/><getetag/></prop></propfind>
    `)
    const hrefs = extractAllHrefs(listXml).filter(h => h.endsWith(".vcf"))

    const cards = await throttledMap(hrefs, 10, async (href) => {
      const res = await fetch(abs(href), { headers: { Authorization: auth } })
      return res.ok ? await res.text() : null
    })

    const parsed = cards
      .filter(Boolean)
      .map(vcf => parseVCard(vcf as string))
      .filter(p => p.display_name)

    return json(cors, { count: parsed.length, people: parsed })
  } catch (err: any) {
    // Log the upstream detail server-side only; never echo it to the client (it would
    // leak iCloud URLs/status and reveal whether credentials were valid).
    console.error("carddav-import failed:", err?.message ?? err)
    return json(cors, { error: "Az iCloud névjegyek importálása sikertelen. Ellenőrizd az Apple ID-t és az app-specifikus jelszót." }, 502)
  }
})

function json(cors: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

function abs(href: string) {
  if (href.startsWith("http")) return href
  return "https://contacts.icloud.com" + href
}

async function propfind(url: string, auth: string, depth: number, body: string) {
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: auth,
      Depth: String(depth),
      "Content-Type": "text/xml; charset=utf-8",
    },
    body,
  })
  if (!res.ok) throw new Error(`PROPFIND ${url} → ${res.status}`)
  return await res.text()
}

function extractXml(xml: string, parent: string, child: string): string | null {
  const re = new RegExp(`<[^>]*${parent}[^>]*>[\\s\\S]*?<[^>]*${child}[^>]*>([^<]+)</[^>]*${child}`, "i")
  const m  = xml.match(re)
  return m ? m[1].trim() : null
}

function extractAllHrefs(xml: string): string[] {
  return [...xml.matchAll(/<[^>]*href[^>]*>([^<]+)</gi)].map(m => m[1].trim())
}

async function throttledMap<T, R>(items: T[], concurrency: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    results.push(...await Promise.all(batch.map(fn)))
  }
  return results
}

// Property name before the first ';' or ':', with any leading "group." prefix removed
// (iCloud emits "item1.TEL;type=CELL:+1...").
function propName(line: string): string | null {
  const head = line.split(/[;:]/, 1)[0]
  if (!head) return null
  const name = head.includes(".") ? head.slice(head.indexOf(".") + 1) : head
  return name.toUpperCase()
}

function parseVCard(vcf: string) {
  const unfolded = vcf.replace(/\r\n[ \t]/g, "")
  const lines = unfolded.split(/\r?\n/)
  const person: any = { display_name: "", phone_numbers: [], emails: [], sources: [{ type: "phone", imported_at: new Date().toISOString() }] }
  for (const line of lines) {
    const prop = propName(line)
    if (!prop) continue
    const idx = line.indexOf(":")
    const value = idx === -1 ? "" : line.slice(idx + 1).trim()
    if (prop === "FN")         person.display_name = value
    else if (prop === "TEL")   { if (value) person.phone_numbers.push(value) }
    else if (prop === "EMAIL") { if (value) person.emails.push(value) }
  }
  return person
}
