# Nexus — Implementation Brief for Claude Code

> **Project:** Personal social network mapping & visualization web app
> **Stack:** React + TypeScript + Vite + D3 + Supabase + GitHub Pages
> **Target user:** Single user (the owner), publicly accessible URL
> **Budget:** 0 Ft/month (free tiers only)
> **Document purpose:** Full implementation spec — read end-to-end before writing code

---

## 0. TL;DR — What we're building

A single-page web app that visualizes the owner's personal social network as an interactive force-directed graph. Data sources: iCloud contacts (via CardDAV), Facebook friends export (JSON), manual entry. Hosted free on GitHub Pages, data stored in Supabase Postgres. Auth: email magic link, locked to the owner's email only.

**Core views:** Map (graph), List (table), Analytics (network metrics), Person Detail (side panel).

**Core actions:** import contacts, tag people (group + role), annotate (notes), connect two people, filter/search, find path between two people.

---

## 1. Tech stack — use these exact choices

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18 + TypeScript** | Industry standard, huge ecosystem |
| Bundler | **Vite 5** | Fast, GitHub Pages friendly |
| Styling | **Tailwind CSS 3** | Utility-first, no runtime cost |
| State | **Zustand** | Tiny, no Redux boilerplate |
| Server state | **@tanstack/react-query v5** | Supabase fetch caching |
| Graph | **D3-force + SVG** | Up to ~1000 nodes; switch to Sigma.js only if needed later |
| Icons | **lucide-react** | Consistent line icons |
| Animation | **framer-motion** | Panels, list transitions |
| Backend | **Supabase** | Postgres + Auth + Edge Functions + Storage |
| Auth | **Supabase Auth, email magic link only** | No passwords to manage |
| Deploy | **GitHub Pages via GitHub Actions** | Free, automatic |
| Package manager | **pnpm** | Faster than npm, disk-efficient |
| Node | **20 LTS** | Matches GH Actions default |

**Do NOT use:** Next.js (GitHub Pages is static, no need for SSR), Redux, styled-components, CRA, Bootstrap, Material UI, Chakra UI.

---

## 2. Prerequisites (owner sets up before you start coding)

The owner must provide these before implementation. Stop and ask if any are missing.

1. **GitHub repo** — `nexus` (private is fine, Pages still works on free plans)
2. **Supabase project** — free tier, note the project URL and anon key
3. **Owner's email** — will be the sole allowed email in auth
4. **Apple ID + App-Specific Password** — for CardDAV import (generated at appleid.apple.com → Sign-In and Security → App-Specific Passwords)
5. **Facebook export** *(optional at start)* — downloaded as JSON from Facebook settings

**GitHub secrets to set** (repo → Settings → Secrets and variables → Actions):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 3. Repository structure

```
nexus/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # push → build → Pages
│       └── keepalive.yml       # cron, prevents Supabase pause
├── public/
│   ├── favicon.svg
│   └── manifest.json           # PWA manifest
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css               # Tailwind directives + fonts
│   │
│   ├── lib/
│   │   ├── supabase.ts         # client singleton
│   │   ├── vcard.ts            # vCard parser
│   │   ├── fb-import.ts        # Facebook JSON parser
│   │   ├── metrics.ts          # network analysis (degree, betweenness, paths)
│   │   └── constants.ts        # GROUPS, ROLES, SOURCE_ICONS
│   │
│   ├── store/
│   │   ├── useAppStore.ts      # Zustand: UI state (selected, filters, mode)
│   │   └── types.ts            # Person, Connection, Group shapes
│   │
│   ├── hooks/
│   │   ├── usePeople.ts        # react-query wrapper for people CRUD
│   │   ├── useConnections.ts
│   │   └── useMetrics.ts       # memoized derived metrics
│   │
│   ├── views/
│   │   ├── Auth/
│   │   │   └── MagicLinkScreen.tsx
│   │   ├── Map/
│   │   │   ├── MapView.tsx           # D3 force graph
│   │   │   ├── Legend.tsx
│   │   │   ├── Toolbar.tsx           # search, filters, connect mode
│   │   │   └── MiniMap.tsx
│   │   ├── Detail/
│   │   │   └── PersonDetail.tsx      # side panel
│   │   ├── List/
│   │   │   └── PeopleList.tsx        # table
│   │   ├── Analytics/
│   │   │   └── AnalyticsView.tsx
│   │   ├── Import/
│   │   │   ├── ImportWizard.tsx
│   │   │   ├── CardDavStep.tsx
│   │   │   ├── FacebookStep.tsx
│   │   │   └── ReviewStep.tsx
│   │   ├── Settings/
│   │   │   └── SettingsView.tsx
│   │   └── CommandPalette/
│   │       └── CommandPalette.tsx    # Cmd+K
│   │
│   └── components/
│       ├── ui/                 # primitive components (Button, Input, Select, Chip)
│       ├── Node.tsx            # SVG node renderer
│       └── Edge.tsx            # SVG edge renderer
│
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial.sql    # schema + RLS
│   └── functions/
│       ├── carddav-import/
│       │   └── index.ts        # Deno Edge Function
│       └── _shared/
│           └── cors.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── .env.local                  # gitignored
├── .gitignore
├── README.md
└── DEVELOPMENT.md              # local setup guide
```

---

## 4. package.json

```json
{
  "name": "nexus",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.51.0",
    "d3": "^7.9.0",
    "framer-motion": "^11.3.0",
    "jszip": "^3.10.1",
    "lucide-react": "^0.400.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.0",
    "vite": "^5.3.0"
  }
}
```

---

## 5. vite.config.ts

**Important:** set `base` to the repo name for GitHub Pages routing.

```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/nexus/",           // CHANGE if repo name differs
  build: {
    sourcemap: false,
    target: "es2020",
  },
})
```

---

## 6. Supabase schema — `supabase/migrations/0001_initial.sql`

Apply this via Supabase Dashboard → SQL Editor → paste → Run. Or via CLI: `supabase db push`.

```sql
-- ─── Extensions ──────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Tables ──────────────────────────────────────────────

create table public.people (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  display_name   text not null,
  photo_url      text,
  phone_numbers  text[] default '{}',
  emails         text[] default '{}',
  group_key      text check (group_key in (
    'family','work','friend','business','acquaintance','community','other'
  )),
  role_key       text check (role_key in (
    'key','gatekeeper','connector','mentor','dormant','none'
  )) default 'none',
  tags           text[] default '{}',
  strength       smallint check (strength between 1 and 5) default 3,
  last_contact   date,
  met_at         text,
  notes          text,
  sources        jsonb default '[]'::jsonb,
  archived       boolean default false,
  pinned_x       real,              -- user-pinned positions on the map
  pinned_y       real,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table public.connections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  from_id     uuid references public.people(id) on delete cascade not null,
  to_id       uuid references public.people(id) on delete cascade not null,
  type        text check (type in (
    'family','work','friend','business','acquaintance','community','bridge','other'
  )),
  directed    boolean default false,
  strength    smallint check (strength between 1 and 5),
  context     text,
  confidence  text check (confidence in ('confirmed','inferred','suggested')) default 'confirmed',
  created_at  timestamptz default now(),
  unique (user_id, from_id, to_id),
  check (from_id <> to_id)
);

create table public.groups_custom (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade not null,
  key      text not null,
  label    text not null,
  color    text not null,
  icon     text,
  unique (user_id, key)
);

-- ─── Updated-at trigger ──────────────────────────────────
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────
create index people_user_archived_idx on public.people (user_id, archived);
create index people_group_idx        on public.people (user_id, group_key);
create index people_role_idx         on public.people (user_id, role_key);
create index people_name_idx         on public.people using gin (to_tsvector('simple', display_name));
create index connections_user_from   on public.connections (user_id, from_id);
create index connections_user_to     on public.connections (user_id, to_id);

-- ─── Row Level Security ──────────────────────────────────
alter table public.people         enable row level security;
alter table public.connections    enable row level security;
alter table public.groups_custom  enable row level security;

create policy "own_people"       on public.people        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_connections"  on public.connections   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_groups"       on public.groups_custom for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Auth configuration (Supabase Dashboard)

1. Authentication → Providers → **Email**: enable, Confirm email = ON, Magic Link = ON
2. Authentication → Settings → **Allow new users to sign up** = OFF *(set AFTER the owner signs up once)*
3. Authentication → URL Configuration → **Site URL** = `https://<owner>.github.io/nexus/` *(and `http://localhost:5173` for dev)*
4. Authentication → URL Configuration → **Redirect URLs**: add both production and localhost
5. *(Optional hardening)* after owner's first login, run in SQL Editor:
   ```sql
   -- only allow this one user to access the tables
   -- (this is already enforced by RLS, but we can go further and restrict signup)
   ```

---

## 7. Constants — `src/lib/constants.ts`

```typescript
export const GROUPS = {
  family:       { label: "Család",    color: "#E8475F", icon: "♥" },
  work:         { label: "Munka",     color: "#3B82F6", icon: "●" },
  friend:       { label: "Barát",     color: "#10B981", icon: "★" },
  business:     { label: "Üzleti",    color: "#F59E0B", icon: "◆" },
  acquaintance: { label: "Ismerős",   color: "#8B5CF6", icon: "○" },
  community:    { label: "Közösség",  color: "#EC4899", icon: "△" },
  other:        { label: "Egyéb",     color: "#6B7280", icon: "▫" },
} as const

export const ROLES = {
  key:        { label: "Kulcsember", badge: "★", color: "#FFD700" },
  gatekeeper: { label: "Kapuőr",     badge: "🛡", color: "#FF6B35" },
  connector:  { label: "Összekötő",  badge: "⬡", color: "#06B6D4" },
  mentor:     { label: "Mentor",     badge: "◈", color: "#A855F7" },
  dormant:    { label: "Alvó",       badge: "◌", color: "#9CA3AF" },
  none:       { label: "—",          badge: "",  color: "transparent" },
} as const

export const SOURCE_ICONS = {
  phone:    "📱",
  facebook: "f",
  linkedin: "in",
  manual:   "✎",
} as const

export type GroupKey  = keyof typeof GROUPS
export type RoleKey   = keyof typeof ROLES
export type SourceType = keyof typeof SOURCE_ICONS
```

---

## 8. Types — `src/store/types.ts`

```typescript
export interface Person {
  id: string
  user_id: string
  display_name: string
  photo_url: string | null
  phone_numbers: string[]
  emails: string[]
  group_key: GroupKey | null
  role_key: RoleKey
  tags: string[]
  strength: number
  last_contact: string | null
  met_at: string | null
  notes: string | null
  sources: Array<{ type: SourceType; imported_at: string }>
  archived: boolean
  pinned_x: number | null
  pinned_y: number | null
  created_at: string
  updated_at: string
}

export interface Connection {
  id: string
  user_id: string
  from_id: string
  to_id: string
  type: ConnectionType | null
  directed: boolean
  strength: number | null
  context: string | null
  confidence: "confirmed" | "inferred" | "suggested"
  created_at: string
}

export type ConnectionType =
  | "family" | "work" | "friend" | "business"
  | "acquaintance" | "community" | "bridge" | "other"

// ...plus GroupKey, RoleKey, SourceType imported from constants
```

---

## 9. Supabase client — `src/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js"

const url     = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // needed for magic link
  },
})
```

---

## 10. CardDAV Edge Function — `supabase/functions/carddav-import/index.ts`

The owner provides Apple ID + app-specific password. The function proxies the CardDAV calls (browser can't do these due to CORS). Returns parsed vCards as JSON.

```typescript
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405, headers: cors })

  try {
    const { appleId, appPassword } = await req.json()
    if (!appleId || !appPassword) {
      return json({ error: "Missing credentials" }, 400)
    }

    const auth = "Basic " + btoa(`${appleId}:${appPassword}`)

    // Step 1: Find principal URL
    const principalXml = await propfind("https://contacts.icloud.com/", auth, 0, `
      <?xml version="1.0" encoding="utf-8"?>
      <propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>
    `)
    const principalHref = extractXml(principalXml, "current-user-principal", "href")
    if (!principalHref) throw new Error("Could not discover principal")

    // Step 2: Find addressbook home set
    const homeXml = await propfind(abs(principalHref), auth, 0, `
      <?xml version="1.0" encoding="utf-8"?>
      <propfind xmlns="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
        <prop><card:addressbook-home-set/></prop>
      </propfind>
    `)
    const homeHref = extractXml(homeXml, "addressbook-home-set", "href")
    if (!homeHref) throw new Error("Could not discover addressbook home")

    // Step 3: List addressbook collections + get vcard hrefs
    const listXml = await propfind(abs(homeHref), auth, 1, `
      <?xml version="1.0" encoding="utf-8"?>
      <propfind xmlns="DAV:"><prop><resourcetype/><getetag/></prop></propfind>
    `)
    const hrefs = extractAllHrefs(listXml).filter(h => h.endsWith(".vcf"))

    // Step 4: GET each vCard (in parallel, throttled)
    const cards = await throttledMap(hrefs, 10, async (href) => {
      const res = await fetch(abs(href), { headers: { Authorization: auth } })
      return res.ok ? await res.text() : null
    })

    // Step 5: Parse and return
    const parsed = cards
      .filter(Boolean)
      .map(vcf => parseVCard(vcf as string))
      .filter(p => p.display_name)

    return json({ count: parsed.length, people: parsed })
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────
function json(body: unknown, status = 200) {
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
  // lightweight regex-based extractor; enough for the 5-tag responses Apple sends
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

// Minimal vCard parser — handles common FN, TEL, EMAIL, PHOTO fields
function parseVCard(vcf: string) {
  const unfolded = vcf.replace(/\r\n[ \t]/g, "")   // RFC 6350 line folding
  const lines = unfolded.split(/\r?\n/)
  const person: any = { display_name: "", phone_numbers: [], emails: [] }
  for (const line of lines) {
    if (line.startsWith("FN:"))     person.display_name = line.slice(3).trim()
    if (line.startsWith("TEL"))     person.phone_numbers.push(line.split(":").pop()!.trim())
    if (line.startsWith("EMAIL"))   person.emails.push(line.split(":").pop()!.trim())
    // PHOTO is base64 and large — skip for now, fetch later if needed
  }
  return person
}
```

**Deploy the function:**
```bash
npx supabase functions deploy carddav-import --project-ref <project-id>
```

**Call it from the client:**
```typescript
const { data, error } = await supabase.functions.invoke("carddav-import", {
  body: { appleId, appPassword },
})
```

**Security note:** the app-specific password is only sent once per import, never stored. Do NOT persist it in localStorage or Supabase.

---

## 11. Facebook import — client-side (no backend)

User downloads their Facebook data export (JSON format), uploads the ZIP. Client-side unpacks with `jszip`, reads `friends_and_followers/your_friends.json`, shows preview, user confirms, writes to Supabase.

```typescript
import JSZip from "jszip"

export async function parseFacebookExport(file: File) {
  const zip   = await JSZip.loadAsync(file)
  const path  = "friends_and_followers/your_friends.json"
  const entry = zip.file(path)
  if (!entry) throw new Error(`${path} not found in archive`)
  const raw   = await entry.async("string")
  const json  = JSON.parse(raw)

  // Structure: { friends_v2: [ { name: "...", timestamp: ... }, ... ] }
  return (json.friends_v2 ?? []).map((f: any) => ({
    display_name: f.name,
    sources: [{ type: "facebook", imported_at: new Date().toISOString() }],
  }))
}
```

---

## 12. Graph rendering — `src/views/Map/MapView.tsx`

Use D3-force for simulation, render SVG via React (not D3 append). This keeps React in control of the DOM and makes interactions declarative.

**Key behaviors:**
- Node size ∝ degree (2–18px radius range)
- Node fill = group color
- Node stroke = role color (if role ≠ none), 3px
- Edge stroke = type color; `bridge` type uses dashed yellow
- Hover node → neighbors stay at full opacity, others dim to 0.15
- Click node → open `PersonDetail` panel, update selected in Zustand store
- Drag node → pins it (writes `pinned_x/y` to DB on drop)
- Shift+drag from A to B → creates connection (opens type dialog)
- Scroll → zoom; two-finger → pan
- Simulation uses forceLink + forceManyBody(-180) + forceCollide(25) + forceCenter

**Reference implementation** lives in the existing prototype file `social-network-map.jsx` — adapt that code, splitting into Node, Edge, Legend, Toolbar sub-components, and moving state to Zustand + react-query.

---

## 13. Network metrics — `src/lib/metrics.ts`

```typescript
import type { Person, Connection } from "../store/types"

export interface NetworkMetrics {
  degreeMap: Map<string, number>
  betweennessMap: Map<string, number>
  density: number
  groupCounts: Map<string, number>
  topConnectors: Array<{ person: Person; degree: number }>
  topBridges: Array<{ person: Person; score: number }>
}

export function computeMetrics(
  people: Person[],
  connections: Connection[]
): NetworkMetrics {
  // 1. Degree centrality (counts)
  const degree = new Map<string, number>()
  people.forEach(p => degree.set(p.id, 0))
  connections.forEach(c => {
    degree.set(c.from_id, (degree.get(c.from_id) ?? 0) + 1)
    degree.set(c.to_id,   (degree.get(c.to_id)   ?? 0) + 1)
  })

  // 2. Betweenness — for a 500-node graph, full Brandes' algorithm is fine (O(VE))
  const betweenness = brandesBetweenness(people, connections)

  // 3. Density
  const n = people.length
  const density = n > 1 ? (2 * connections.length) / (n * (n - 1)) : 0

  // 4. Group counts
  const groupCounts = new Map<string, number>()
  people.forEach(p => {
    const k = p.group_key ?? "other"
    groupCounts.set(k, (groupCounts.get(k) ?? 0) + 1)
  })

  // 5. Top lists
  const topConnectors = [...people]
    .map(p => ({ person: p, degree: degree.get(p.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10)

  const topBridges = [...people]
    .map(p => ({ person: p, score: betweenness.get(p.id) ?? 0 }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return { degreeMap: degree, betweennessMap: betweenness, density, groupCounts, topConnectors, topBridges }
}

/** Shortest path between two nodes using BFS — for the "who knows X?" feature */
export function shortestPath(
  fromId: string,
  toId: string,
  connections: Connection[]
): string[] | null {
  const adj = buildAdjacency(connections)
  const visited = new Set<string>([fromId])
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]

  while (queue.length) {
    const { id, path } = queue.shift()!
    if (id === toId) return path
    for (const next of adj.get(id) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({ id: next, path: [...path, next] })
      }
    }
  }
  return null
}

// brandesBetweenness + buildAdjacency: standard implementations
// (see https://algo.ing.unimo.it/people/marco/talks/2003-ida-tutorial.pdf)
```

**Performance note:** memoize with `useMemo` in `useMetrics` hook, keyed on `people.length + connections.length + lastUpdate`. Don't recompute on every render.

---

## 14. GitHub Actions — `.github/workflows/deploy.yml`

```yaml
name: Deploy to Pages
on:
  push: { branches: [main] }
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          VITE_SUPABASE_URL:      ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - name: Add SPA 404 fallback
        run: cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**After first push:** go to repo → Settings → Pages → Build source = "GitHub Actions".

---

## 15. GitHub Actions — `.github/workflows/keepalive.yml`

```yaml
name: Supabase Keepalive
on:
  schedule:
    - cron: "0 12 */3 * *"    # every 3rd day at 12:00 UTC
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST
        run: |
          curl -sSf \
            "${{ secrets.VITE_SUPABASE_URL }}/rest/v1/people?select=id&limit=1" \
            -H "apikey: ${{ secrets.VITE_SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.VITE_SUPABASE_ANON_KEY }}" \
            > /dev/null
          echo "Pinged Supabase OK"
```

Supabase projects pause after 7 days of inactivity; this ping every 3 days keeps it alive.

---

## 16. Implementation milestones

**Build in this order. Each milestone is shippable.**

### M1 — Scaffold *(0.5 day)*
- pnpm init, install deps, Vite + React + Tailwind
- `/src` structure laid out
- Supabase client connects, can `SELECT 1`
- Deploy pipeline works → owner can see a "Hello Nexus" at the Pages URL

### M2 — Auth *(0.5 day)*
- MagicLinkScreen: email input → sends link → redirects back → session persists
- Protected routes: if no session, show login; else show app
- Sign out button in settings
- **After owner's first successful login: disable signups in Supabase dashboard**

### M3 — CRUD + manual people *(1 day)*
- usePeople hook (react-query: list, insert, update, delete, archive)
- useConnections hook
- Basic List view: table of people, add/edit/delete
- PersonDetail side panel with full edit form
- No graph yet — validate data layer is solid

### M4 — Map view *(2–3 days)*
- D3 force simulation running, nodes rendered as SVG
- Node sizing by degree, coloring by group
- Pan / zoom / drag / click
- Hover neighborhood highlight
- Legend, simple toolbar
- Connect mode (shift+drag or button)

### M5 — Filters + search *(0.5 day)*
- Zustand store for filter state
- Search bar (fuzzy match on name)
- Filter by group, role, source, strength
- Filter reflects into both Map and List views

### M6 — Facebook import *(0.5 day)*
- ImportWizard → FacebookStep: file upload, parse, preview, dedupe, write
- Handle duplicates: match on name similarity, let owner merge

### M7 — CardDAV import *(1 day)*
- Deploy `carddav-import` Edge Function
- ImportWizard → CardDavStep: credentials form, call function, preview, dedupe, write
- Clear error messages if Apple rejects

### M8 — Analytics view *(1 day)*
- Compute metrics (degree, betweenness, density)
- Render cards: totals, top connectors, top bridges, group breakdown, role distribution
- All sortable; clicking a person jumps to map

### M9 — Command palette + path finding *(0.5 day)*
- Cmd+K palette: search, actions, navigate
- "Path to X" command: BFS, highlight route on map

### M10 — Polish *(1–2 days)*
- Empty states, loading skeletons, error boundaries
- PWA manifest + install prompt
- Keyboard shortcuts help overlay
- Mobile layout (bottom sheet instead of side panel)
- Dark mode only (skip light mode for v1)
- Export all data as JSON and VCF

**Total estimated time: 8–11 days of focused work.**

---

## 17. Design language — quick reference

Full design brief lives in the companion document. Condensed for implementation:

- **Theme:** dark, slightly cool black background (`#0F1117`), never pure `#000`
- **Font:** `JetBrains Mono` for UI + data; titles in weight 700, body in 400–500
- **Motion:** spring-based, 200–260ms; hover 80ms; `prefers-reduced-motion` respected
- **Density:** medium-high — this user is a power user
- **Colors per group:** listed in `constants.ts`, use CSS variables: `--color-family`, `--color-work`, …
- **Never use:** purple-white gradients, iOS stock blue, Inter, Roboto, emoji-heavy UI
- **Accessibility:** WCAG 2.1 AA; every color-coded thing must also have an icon or label; keyboard navigable

---

## 18. Environment files

**`.env.example`** (commit this):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**`.env.local`** (gitignore this):
```
VITE_SUPABASE_URL=https://<real-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<real-anon-key>
```

**`.gitignore`**:
```
node_modules
dist
.env.local
.env.production
.DS_Store
*.log
.vscode
.idea
```

---

## 19. README.md (what Claude Code should write)

```markdown
# Nexus

Personal social network mapping and visualization.
Single-user web app. Dark interface. Dark data.

## Local dev

\`\`\`bash
pnpm install
cp .env.example .env.local   # fill in Supabase values
pnpm dev
\`\`\`

## Deploy

Push to `main` → GitHub Actions builds and deploys to Pages.

## Stack

React · TypeScript · Vite · Tailwind · D3 · Supabase · GitHub Pages.

## License

Private. All rights reserved.
```

---

## 20. Testing checklist (manual, before calling it done)

- [ ] Magic link login works on both dev and production
- [ ] Logged out → redirected to login
- [ ] Import from Facebook: 100+ friends → no errors
- [ ] Import from CardDAV: full contact list → no timeouts
- [ ] Create a person manually → appears on both map and list
- [ ] Create a connection by shift+dragging → appears on map
- [ ] Delete a person → removes all their connections
- [ ] Archive a person → hidden from map by default, visible with filter
- [ ] Edit notes → saves, survives reload
- [ ] Filter by group → map + list both update
- [ ] Search "anna" → highlights on map, filters list
- [ ] Analytics: top connectors match what you'd expect
- [ ] Path finding: "path to X" → BFS result highlighted
- [ ] Drag a node → position persists after reload
- [ ] Resize window → layout adapts, no broken SVG
- [ ] Mobile (375px) → bottom sheet works, graph pannable
- [ ] `prefers-reduced-motion` → animations disabled
- [ ] Tab through the UI → focus ring visible everywhere
- [ ] Export all → JSON file downloads, reimports cleanly
- [ ] Sign out → session cleared, magic link required again

---

## 21. Things NOT to build (anti-scope)

Explicitly out of scope for v1:
- ❌ Light mode
- ❌ Email / calendar / LinkedIn integrations
- ❌ Reminders or notifications
- ❌ AI-powered "summarize this person"
- ❌ Multi-user sharing
- ❌ Native desktop or mobile apps
- ❌ Real-time collaboration
- ❌ Comments or activity history
- ❌ Any form of social feed

If the owner requests these later, they become separate v2 features.

---

## 22. Open questions to resolve with owner before coding

1. **Owner's email** for auth whitelist — ask before M2
2. **Repo name** (affects `base` in vite.config.ts) — ask before M1
3. **Custom domain** (affects Site URL in Supabase) — ask at M10
4. **Profile photos** — sync from CardDAV (heavy) or skip? — ask at M7
5. **Hungarian-only UI** or also English? — ask at M1

---

## 23. Success criteria

The build is "done" when:

1. Owner can log in from any device with magic link
2. Owner can import 500+ contacts from iCloud in <2 minutes
3. Owner can import Facebook friends from a zip in <30 seconds
4. Map renders 500 nodes at 60fps on a mid-range laptop
5. All data persists across reloads and devices
6. Monthly cost: **0 Ft**
7. Owner can find any person in <3 seconds via search or filter
8. Owner can identify key people, gatekeepers, bridges at a glance

---

## End of brief

Claude Code: read this entire document before writing any code. Ask clarifying questions if any section is ambiguous. Build milestone by milestone, pushing working code after each one. Keep commits small and descriptive. When in doubt, favor simplicity — this is a single-user tool, not a platform.
