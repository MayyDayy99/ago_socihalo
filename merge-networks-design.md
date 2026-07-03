# Network Merge — Kidolgozott terv (v1)

> **Státusz:** jóváhagyásra kész terv · **Alap:** `merge-networks-feature.md` (eredeti ötlet)
> **Cél:** két beleegyező felhasználó *ideiglenesen* összenézi a kapcsolati hálóját, és
> **csak a releváns** metszetet + annak közvetlen frontját látja — nem a másik teljes hálóját.

Ez a dokumentum a korábbi ötlet-specet **döntésekké és megvalósítható tervvé** dolgozza ki,
kihegyezve a két kulcs-elvárásra:

1. **Realtime** — a beleegyezés-folyamat (meghívás → elfogadás → egyeztetés → lejárat) élőben.
2. **„Csak a releváns"** — semmi felesleges információ-áradat; formalizált *relevancia-modell*.

---

## 1. Tervezési elvek

| # | Elv | Következmény |
|---|---|---|
| 1 | **Consent-first** | Mindkét fél explicit beleegyezése nélkül *semmilyen* adat nem találkozik. |
| 2 | **Relevancia, nem teljesség** | A másik teljes hálója sosem ömlik rád — csak a metszet + 1-lépéses front. |
| 3 | **Efemer** | A session 24 órán át él, utána auto-lezárul; nincs perzisztens merge-eredmény. |
| 4 | **Csak-olvasás** | A merge sosem ír a másik (vagy a saját) `people`/`connections` adatába. |
| 5 | **Fokozatos feltárás** | Előbb insight-számok, konkrét emberre részlet csak kattintásra. |
| 6 | **Visszavonhatóság** | Bármelyik fél bármikor bonthatja → a másiknál azonnal eltűnik (realtime + cache-törlés). |

**Tiltólista** (a régi specből, változatlanul): nincs write-access a másik adatára; nincs értesítés a
szóba került közös ismerősnek; nincs perzisztens tárolás; nincs anonim merge.

---

## 2. A relevancia-modell (a terv magja)

A naiv merge — „Anna 200 embere + Béla 200 embere = 400 node" — áttekinthetetlen és nagyrészt
irreleváns. Ehelyett a másik hálóját **három rétegre** bontjuk a *hívó fél nézőpontjából*
(pl. Anna a hívó, Béla a partner):

| Réteg | Definíció (halmaz-szinten) | Érték | Alap-láthatóság |
|---|---|---|---|
| **T0 — Közös** | Béla azon emberei, akik `merge_identity_map`-ben Anna valakijével **megerősítetten** matchelnek | Közös alap, aszimmetriák | **látszik** |
| **T1 — Híd (1 lépés)** | Béla azon emberei (nem T0), akik Béla `connections`-ében **közvetlenül kapcsolódnak egy T0-emberhez** | Bemutatás-lehetőség: „elérhető a közös X-en át" | **látszik** (Standard/Full) |
| **T2 — Diszjunkt** | Béla összes többi embere (semmi kapcsolat a közös maghoz) | Zaj a hívónak | **rejtve** — csak aggregált szám |

Formálisan, ha `S` = a session megerősített identity-párjai, `Pb` = Béla emberei,
`Cb` = Béla kapcsolatai:

```
T0 = { b ∈ Pb : ∃ (a,b) ∈ S }                       -- közös
T1 = { b ∈ Pb \ T0 : ∃ t ∈ T0, (b,t) ∈ Cb ∨ (t,b) ∈ Cb }   -- 1-hop a közös maghoz
T2 = Pb \ (T0 ∪ T1)                                  -- rejtve, csak |T2| jelenik meg
```

A hívó **mindig a teljes SAJÁT hálóját látja**; a partnerből csak `T0 ∪ T1`, plusz a
`T0 ∪ T1` közti Béla-éleket. A `T2` sosem node-ként, csak így: *„Béla ismer még 143 embert,
akikhez nincs közös kapcsolatod."*

### 2.1 Mező-szintű relevancia (mennyi info egy emberre)

A megosztási szint dönti el, **mely mezők** jönnek át — és egyben azt is, **meddig terjed a front**:

| Szint | Látható emberkör | Látható mezők |
|---|---|---|
| **minimum** | T0 | név, csoport |
| **match_only** *(legszigorúbb)* | **csak T0** | név, csoport |
| **standard** *(alap)* | T0 + T1 | név, csoport, szerep, erősség (szám) |
| **full** | T0 + T1 | minden nem-archivált mező (jegyzet, e-mail, telefon, dátumok is) |

**Alap = `standard`.** A jegyzet/e-mail/telefon/kontakt-dátum **soha** nem jön át, csak
explicit `full`-nál — és a `full`-ra váltás külön „biztos vagy benne?" megerősítést kap.
Így „nem ömlik sok info egy emberre": alapból max. 4 metaadat/fő.

### 2.2 Insight-rangsor (mit emelünk ki elsőként)

A jobb panel nem kártyákat zúdít, hanem **rangsorolt insightokat**:

1. **Top hidak** — a legtöbb közös kapcsolóval elérhető T1-emberek (legjobb bemutatás-jelöltek).
2. **Erősség-eltérések** a T0-n (te 5★, ő 2★) — beszélgetésindító / infó-aszimmetria.
3. **Kategória-eltérések** a T0-n (te „alvó", ő „fő partner").
4. **Átfedés-összegzés** (hány közös, ebből hány erős mindkettőnél).

---

## 3. Adatmodell

A jelenlegi sémához illesztve: **`user_id` = Firebase UID (`text`)**, RLS a
`(auth.jwt() ->> 'sub')` claimre. A meghívás **e-mail alapú**, ezért a partner a JWT
`email` claimjén keresztül látja a rá váró meghívót, mielőtt a `partner_id` beköttetne.

```sql
-- ── Merge session ────────────────────────────────────────────
create table public.merge_sessions (
  id                    uuid primary key default gen_random_uuid(),
  initiator_id          text not null,                 -- Firebase UID (auth.jwt()->>'sub')
  partner_email         text not null,                 -- meghívott e-mail (kisbetűsítve)
  partner_id            text,                           -- kitöltődik elfogadáskor
  initiator_share_level text not null default 'standard'
                        check (initiator_share_level in ('minimum','match_only','standard','full')),
  partner_share_level   text
                        check (partner_share_level in ('minimum','match_only','standard','full')),
  status                text not null default 'pending'
                        check (status in ('pending','active','declined','expired','revoked')),
  created_at            timestamptz default now(),
  expires_at            timestamptz default (now() + interval '24 hours'),
  revoked_at            timestamptz,
  constraint no_self_merge check (initiator_id <> coalesce(partner_id, ''))
);
create index merge_sessions_initiator_idx on public.merge_sessions (initiator_id, status);
create index merge_sessions_partner_email_idx on public.merge_sessions (lower(partner_email), status);
create index merge_sessions_partner_idx on public.merge_sessions (partner_id, status);

-- ── Megerősített identitás-párok (session-scope) ─────────────
create table public.merge_identity_map (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid references public.merge_sessions(id) on delete cascade not null,
  initiator_person_id uuid references public.people(id) on delete cascade not null,
  partner_person_id   uuid references public.people(id) on delete cascade not null,
  match_kind          text not null check (match_kind in ('phone','email','manual','suggested')),
  confirmed_by_initiator boolean default false,
  confirmed_by_partner   boolean default false,
  created_at          timestamptz default now(),
  unique (session_id, initiator_person_id, partner_person_id)
);
create index merge_identity_session_idx on public.merge_identity_map (session_id);
```

### 3.1 RLS

```sql
alter table public.merge_sessions     enable row level security;
alter table public.merge_identity_map enable row level security;

-- Egy segéd: a hívó résztvevője-e a sessionnek (sub vagy email alapján)
-- (inline-oljuk a policy-kben, hogy ne kelljen SECURITY DEFINER helper)

-- merge_sessions: látja az initiator, a beköttetett partner, VAGY az e-mailre meghívott.
create policy "merge_sessions_read" on public.merge_sessions
  for select using (
    (auth.jwt() ->> 'sub')   = initiator_id
    or (auth.jwt() ->> 'sub') = partner_id
    or lower(auth.jwt() ->> 'email') = lower(partner_email)
  );

-- Csak az initiator hozhat létre sessiont, és csak saját magára.
create policy "merge_sessions_insert" on public.merge_sessions
  for insert with check ((auth.jwt() ->> 'sub') = initiator_id);

-- Frissítés: az initiator a saját megosztási szintjét/visszavonást; a partner az
-- elfogadást/megosztási szintjét. (A mező-szintű korlátozást a kliens + egy
-- BEFORE UPDATE trigger tartatja be — lásd 5.3.)
create policy "merge_sessions_update" on public.merge_sessions
  for update using (
    (auth.jwt() ->> 'sub') = initiator_id
    or (auth.jwt() ->> 'sub') = partner_id
    or lower(auth.jwt() ->> 'email') = lower(partner_email)
  );

-- merge_identity_map: csak a session két résztvevője.
create policy "merge_identity_rw" on public.merge_identity_map
  for all using (
    exists (
      select 1 from public.merge_sessions s
      where s.id = session_id
        and ((auth.jwt() ->> 'sub') in (s.initiator_id, s.partner_id))
    )
  ) with check (
    exists (
      select 1 from public.merge_sessions s
      where s.id = session_id
        and ((auth.jwt() ->> 'sub') in (s.initiator_id, s.partner_id))
    )
  );
```

### 3.2 Realtime

```sql
alter table public.merge_sessions     replica identity full;
alter table public.merge_identity_map replica identity full;
alter publication supabase_realtime add table public.merge_sessions;
alter publication supabase_realtime add table public.merge_identity_map;
```

A kliens a `merge_sessions`-re iratkozik fel (ahol résztvevő) → a meghívás, elfogadás,
megosztási-szint-váltás, visszavonás, lejárat mind élő eseményként érkezik.

---

## 4. A merge-nézet: `get_merge_view` (SECURITY DEFINER, csak-olvasás)

A nézetet **egyetlen Postgres függvény** számolja. `SECURITY DEFINER`, mert mindkét fél
`people`/`connections` adatát olvasnia kell — **ezért a függvény maga kényszeríti ki**
a hozzáférést (a hívó résztvevő-e, aktív-e a session), és a share_level + relevancia szűrést.

**Szerződés:**

```
get_merge_view(p_session_id uuid) returns jsonb
```

**Algoritmus (pszeudokód):**

```
sub := auth.jwt() ->> 'sub'
s   := merge_sessions WHERE id = p_session_id
GUARD: s.status = 'active' AND now() < s.expires_at AND sub IN (s.initiator_id, s.partner_id)
       különben RAISE insufficient_privilege

caller := (sub = s.initiator_id ? 'initiator' : 'partner')
other  := a másik fél user_id-ja
other_level := a másik fél share_level-je   -- amit a MÁSIK osztott meg (ezt látja a hívó)

S   := merge_identity_map WHERE session_id = s.id AND confirmed_by_initiator AND confirmed_by_partner
T0  := other azon emberei, akik S-ben szerepelnek
T1  := (other_level IN ('standard','full'))
         ? other azon emberei (∉T0), akik connections-ben kapcsolódnak egy T0-hoz
         : ∅                                   -- minimum/match_only: nincs front
T2n := |other emberei| - |T0 ∪ T1|             -- csak szám

fields := other_level szerint (2.1 tábla)
return jsonb: {
  own:      { nodes: hívó teljes people-je (RLS-szerű, saját), edges: saját connections },
  partner:  { nodes: (T0∪T1) a `fields` szerint szűrve, edges: T0∪T1 közti other-élek },
  overlap:  [ {a_person, b_person, a_strength, b_strength, a_role, b_role} ... ],  -- T0 párok
  bridges:  [ {b_person, via:[közös kapcsolók], reachable_score} ... ],           -- T1 rangsor
  hidden_partner_count: T2n
}
```

**Kritikus:** minden `select` a függvényben szűr `s.id`-ra ÉS a fenti halmazokra — egyetlen
kihagyott `where` = szivárgás. Ezért a függvényhez **share_level-enkénti teszt** kötelező (7.).

Az azonosító-jelöltek (auto-match) hasonló elven külön függvény:
`compute_match_candidates(p_session_id)` → telefon/e-mail egyezés (biztos) + fuzzy név+csoport
(javasolt), a `merge_identity_map`-be `suggested`/auto státusszal.

---

## 5. UX-folyam

### 5.1 Meghívás & beleegyezés (Fázis 1, realtime)

```
Anna: Beállítások → „Háló megosztása" → e-mail: bela@…  → Megosztási szint: Standard → Meghívás
      ↳ INSERT merge_sessions (status=pending, partner_email='bela@…')

Béla (bejelentkezve): élő értesítés „Anna megosztaná veled a hálóját"
      ↳ Elfogadom → megosztási szint választás → UPDATE (partner_id=sub, partner_share_level, status=active)
      ↳ Elutasítom → status=declined
Anna: élőben látja, hogy aktív lett (vagy elutasítva).
```

Megosztási-szint kontroll: alap `standard`; a `full` külön piros „biztos?" megerősítő modál.
Session közben **downgrade lehet, upgrade nem** (bizalom-monoton).

### 5.2 Identitás-egyeztetés (Fázis 2)

- `compute_match_candidates` lefut → auto-match (telefon/e-mail) rögtön `confirmed`*,
  fuzzy jelöltek (Levenshtein név < 3 + csoport) `suggested`.
- Review-képernyő: mindkét fél egyenként ✓/✗ a `suggested`-ekre (élőben látják a haladást).
- Skálázás: prefilter (csak ahol a név első karaktere egyezik) → nem cross-join 250k párra.

*Az auto-match is kaphat egy „nem ugyanaz" visszavonást, ha valaki családi közös telefonszám.

### 5.3 Nézet & insightok (Fázis 3)

- A meglévő **2D térkép** kap egy `merge` módot (a `mapMode` mellé egy külön merge-state).
- Node-szín tulajdonság szerint: **csak te** (kék), **csak ő** (borostyán), **közös** (bíbor).
- Csak `T0 ∪ T1` a partnerből; `T2` a panelen számként.
- Jobb oldali **„Új dimenzió" panel** (a person-detail helyett merge módban): átfedés, top hidak,
  erősség-eltérések, „Kérj bemutatást" (v1-ben vizuális jelölés).

Panel-vázlat:

```
┌─ Anna ↔ Béla · Standard · Lejár: 23:15 ─┐
│ ÁTFEDÉS   ● 4 közös · 2 erős mindkettőnél │
│ HIDAK     ● Béla→Anna 6 új elérhető       │
│           ● Anna→Béla 11 új               │
│ ELTÉRÉS   ● „X": te ★5 · ő ★2             │
│ REJTVE    ● +143 nem-kapcsolódó (Béla)    │
└───────────────────────────────────────────┘
```

### 5.4 Lezárás

Lejárat / visszavonás → realtime esemény → a kliens **azonnal elveti** a merge-state-et és a
lekért adatot (React Query cache invalidálás + a merge-nézet unmountja). Semmi nem marad a kliensben.

---

## 6. Implementációs fázisok

| Fázis | Tartalom | Kimenet | Becslés |
|---|---|---|---|
| **0** | Migráció: 2 tábla + RLS + realtime; `get_merge_view` + `compute_match_candidates` váz | DB kész, tesztelhető SQL-ből | ~1 nap |
| **1** | Meghívás & consent flow (Settings UI + realtime értesítés + accept/decline + szintválasztás) | Élő session, még nincs gráf | ~2 nap |
| **2** | Identitás-matching (auto + review UI) | Kész identity-map | ~2 nap |
| **3** | Merge overlay a 2D térképen + „új dimenzió" panel (relevancia-rétegek, insightok) | **Használható v1** | ~3 nap |
| **4** *(v1 után)* | 3D overlay polish, lejárat-emlékeztető, audit log, PDF/kép export | — | ~3 nap |
| **jövő** | Csoportos merge (3+), időbeli snapshot-merge, perzisztens team-graph | — | külön projekt |

Minden fázis külön PR + review + deploy → korán látható érték, kis kockázat.

---

## 7. Kockázatok és tesztelés

| Kockázat | Mitigáció |
|---|---|
| **RLS/függvény-szivárgás** (kihagyott `where`) | `get_merge_view`-ra **share_level-enkénti unit teszt** (minimum/match_only/standard/full): full ↛ jegyzet/telefon; match_only ↛ T1; nem-résztvevő ↛ semmi. |
| **Identitás false-positive** (két „Kovács Anna") | Auto-match csak telefon/e-mailre; név+csoport csak `suggested` + kézi ✓; visszavonható. |
| **„Full" véletlen kiszivárgás** | Alap `standard`; `full` külön megerősítés; a nézet mezőit a függvény szűri, nem a kliens. |
| **Skálázás** (cross-join) | Prefilter első-karakter egyezésre + indexek; a merge-nézet on-demand, nem streamelt. |
| **Session-utáni maradék** | Lejárat/visszavonás realtime → kliens-cache törlés + unmount; a szerver semmit sem perzisztál. |
| **Mobil UX** | Overlay (egy gráf) mobilon is működik; side-by-side csak desktop-opció (v1-ben nem). |

---

## 8. Sikerkritérium

- A két fél **5 percen belül** lát értelmes átfedést (nem fél órás match-jóváhagyás).
- Legalább **egy „új dimenzió"** kiemelődik, amire egyik fél sem gondolt (top híd).
- A **privacy-kontroll egyértelmű**, véletlen kattintással nem lehet elrontani (alap = standard).
- **Lezárás után** semmilyen másik-fél-adat nem marad — a kliens cache is tiszta.

---

## 9. Eldöntött alapértékek (a `merge-networks-feature.md` opcióiból)

| Kérdés | Döntés | Indok |
|---|---|---|
| Megosztási alapszint | **standard** + relevancia-réteg (T0+T1 látszik, T2 rejtve) | Egyensúly info/privacy közt; „nem ömlik sok" |
| Meghívás | **e-mail alapján** (JWT email claim) | Barátságosabb, mint nyers UID |
| Vizuál | **overlay** a meglévő 2D térképen | Egységes, mobilbarát; a 3D polish jön később |
| Session-idő | **24 óra**, downgrade közben igen / upgrade nem | Bizalom-monoton |
| Realtime hatóköre | **session-életciklus** (meghívás/consent/match/lejárat) | A merge-nézet on-demand marad (anti-flooding) |

Ezek módosíthatók — de a v1 ezekkel indul.
