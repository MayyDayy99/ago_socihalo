# ago_socihalo (Nexus) – útmutató Claude-nak

Személyes kapcsolati háló térkép: React + TypeScript + Vite + Tailwind + D3/three.js,
Supabase (adat, edge function: `carddav-import`) és Firebase Auth. GitHub Pagesen fut.

A felhasználó magyarul ír, válaszolj magyarul.

## Fontos: a `main` = éles oldal

Minden push a `main`-re élesít (`deploy.yml`). Mindig ágon dolgozz és PR-t nyiss; a
`pr-check.yml` (typecheck + build) zöldje után lehet mergelni.

## Ellenőrzések

```bash
pnpm install --frozen-lockfile
pnpm typecheck
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x pnpm build
```

Helyi futtatáshoz `.env.local` kell (`.env.example` alapján). A felhős konténer a
`*.supabase.co`-t alapból nem éri el, ott build és typecheck megy, élő adat nem.

## Tilos

- Valódi személyes adat (névjegyek, CSV-exportok) commitolása; a `test-import-30.csv`
  csak kitalált tesztadat lehet.
- Kulcsok commitolása: minden `VITE_*` érték GitHub Secretsben van.
- Éles Supabase-migráció vagy edge function deploy Peti kifejezett kérése nélkül.
