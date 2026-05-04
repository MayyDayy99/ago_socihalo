# Feature spec — Hálók összefésülése (Network Merge)

> **Státusz:** ötlet, nincs ütemezve
> **Owner:** —
> **Becsült munka:** 8–14 nap (4 fázisban)

## Egy mondatban

Két beleegyező felhasználó *összenézi* a kapcsolati hálóját, és az átfedésekből + áthidalásokból egy **harmadik, közös nézet** jön létre — új mintázatok, közvetítők, kollektív lehetőségek láthatóvá válnak, anélkül hogy bárki adatait módosítaná a másik.

## Miért érdekes

A jelenlegi modell single-userre van szabva: te a saját hálódat látod, az ügyfeled a sajátját. A valós érték nemcsak abban van hogy *te* hány embert ismersz, hanem abban hogy *együtt* hány emberhez van hozzáférésetek és **hogyan kapcsolódnak**. Az összefésülés a következő szintekre nyit:

- **Közös ismerősök felismerése.** Te X-et "alvó kapcsolat"-ként tartod, partnered "fő üzleti partner"-ként. Ez egyetlen sor új információ, ami másképp nem derülne ki.
- **Hídszemélyek (bridges) a közös hálón.** Az "egyirányú híd" (csak az egyikőtök ismeri) a leg­értékesebb potenciális bemutatás. A klasszikus *introduction* probléma adatosítva.
- **Erősség-eltérések.** Ha te 5★-on tartod Y-t, ő 2★-on, az vagy információs aszimmetria (te tudsz valamit róla amit ő nem) vagy hibajelzés (egyikőtök tévesen ítélt). Beszélgetésindító.
- **Kollektív stratégia.** "Kihez tudunk együtt hozzáférni?" — eseményszervezés, üzleti pitch, gyűjtés, álláskeresés, projekt összeállítás.
- **Új dimenzió a vizualizációban.** Ugyanaz a 3D szoba két "rétegből" — saját + másik fél. A 3D nézet (jelenleg dolgozunk rajta) tálcán kínálja a vizuális metaforát.

## Mit NEM csinál

- Nem ad módosítási jogot a másik adatára. Csak nézet.
- Nem osztja meg a privát mezőket (megjegyzések, last_contact, archivált) automatikusan — csak amit a tulajdonos explicit megoszt.
- Nem permanens merge — sessionalapú, lejár.
- Nem több mint 2-fős. (Group-merge = külön jövőbeli feature, sok privacy meló.)

## Felhasználói történet

> **Anna** dolgozik egy projekten amihez kell egy konkrét szakember. Megosztja a hálóját **Bélával**. A merge nézet azonnal megmutatja: Béla ismer egy "X" nevű közös ismerőst, akiről Anna elfelejtette hogy ismeri Béla. Az "új dimenzió" panel kiemeli: 4 olyan ember van, akit Anna ismer, és Béla 1 lépésre van tőlük rajtuk keresztül. Anna ezekből választja ki a megfelelőt és kéri Bélától a bemutatást.

## Privacy / consent modell

Legfontosabb tervezési elv: **mindkét fél explicit beleegyezése nélkül semmilyen adat nem találkozik**.

Lehetséges megosztási szintek (mindkét fél külön választhat):

| Szint | Mit oszt meg | Mit NEM oszt meg |
|---|---|---|
| **Minimum** | Csak a nevek és csoport-besorolás | Email, telefon, megjegyzés, erősség, kontakt-dátum |
| **Match-only** | Csak azok a személyek akik a másikéval matchelnek (átfedés) | Saját egyedi ismerősök rejtve maradnak |
| **Standard** | Nevek + csoport + szerep + kapcsolat-erősség (szám) | Megjegyzés, e-mail, telefon, kontakt-dátum |
| **Full** | Minden látható ami a saját nézetben is | Csak az archivált rejtve marad |

Default = **Match-only**. A "nem-érintett" emberek így soha nem látszanak a másik félnek.

Időkorlát: a merge session **24 órán át él**, utána automatikusan lezárul (mindkét fél úgy zárja le ahogy kívánja).

Visszavonhatóság: bármelyik fél bármikor felbonthatja, és onnantól semmilyen adat nem látható.

## Identitás-egyezés

A legkényesebb technikai rész. Mikor mondhatjuk hogy "Anna X-e == Béla X-e"?

**Megbízhatósági szintek:**
1. **Egyező telefonszám** → biztosan ugyanaz az ember (kivéve családon belül megosztott vonal — ritka)
2. **Egyező e-mail** → szinte biztos
3. **Egyező név + egyező csoport** → valószínű, manuális megerősítés kell
4. **Hasonló név (Levenshtein < 3) + hasonló kontextus** → felajánljuk, manuális megerősítés

A merge session indításakor egy **review képernyő** futtatja le az egyezést és listázza:
- Automatikusan match-elt emberek (telefon/e-mail) — már össze van fésülve
- Javasolt match-ek (név + kontextus alapján) — egyenként ✓ vagy ✗
- Nincs match (csak az egyik féllé) — vagy "új ember" vagy "én is hozzáadom"

Az eredmény egy **identity-map**, ami csak az adott merge sessionre érvényes. Egyik féllé sem ír semmit a saját DB-jébe.

## Vizuális nézet

Két alap-ötlet, ki kell próbálni:

**A) Overlay (egy gráf, színezett tulajdonosság)**
- Egyetlen kombinált gráf
- A node színe: `csak Anna ismeri` = piros, `csak Béla` = kék, `mindketten` = bíbor
- Bridge-személy nagyobb, vastagabb halo
- A 2D nézet ezt simán megjeleníti, a 3D nézetben a fej-disc két félkörre osztva

**B) Side-by-side**
- Két panel egymás mellett, két kis szoba
- A közös ismerősök "hídvonalakkal" kötve a két szoba közt
- Klikkre az adott ember kiemelődik mindkét panelen

Default valószínűleg **A**, mert egységes vizuális benyomást ad. **B** akkor jobb ha a két ember nézőpontját külön akarjuk hangsúlyozni (pl. preszentációhoz).

Új dimenzió-panel a jobb oldalon helyettesíti a person detailt a merge mód alatt:

```
┌─────────────────────────────┐
│  Anna ↔ Béla                │
│  Megosztás: Standard        │
│  Lejár: 23 óra 15 perc      │
├─────────────────────────────┤
│  ÁTFEDÉS                    │
│   ●  4 közös ismerős        │
│   ●  ebből 2 erős mindkettő │
│   ●  1 fő ahol erőssége    │
│      eltér 3 csillaggal     │
├─────────────────────────────┤
│  HÍDSZEMÉLYEK               │
│   ●  Béla → Anna 6 új ember │
│   ●  Anna → Béla 11 új      │
├─────────────────────────────┤
│  AJÁNLÁS                    │
│   "Te ismered Z-t. Béla 1   │
│    lépésre van tőle Y-on át.│
│    Kérj bemutatást?"       │
└─────────────────────────────┘
```

## Adatmodell

Új táblák:

```sql
-- Egy merge session
create table public.merge_sessions (
  id            uuid primary key default gen_random_uuid(),
  initiator_id  text not null,         -- Firebase UID
  partner_id    text not null,         -- Firebase UID
  initiator_share_level text not null check (initiator_share_level in ('minimum','match_only','standard','full')),
  partner_share_level   text not null check (partner_share_level in ('minimum','match_only','standard','full')),
  status        text not null check (status in ('pending','active','expired','revoked')) default 'pending',
  created_at    timestamptz default now(),
  expires_at    timestamptz default (now() + interval '24 hours'),
  revoked_at    timestamptz
);

-- A session alatt megerősített identity-map: melyik person matchel kivel
create table public.merge_identity_map (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references public.merge_sessions(id) on delete cascade not null,
  initiator_person_id uuid references public.people(id) on delete cascade,
  partner_person_id   uuid references public.people(id) on delete cascade,
  match_kind    text not null check (match_kind in ('phone','email','manual','suggested')),
  confirmed_by_initiator boolean default false,
  confirmed_by_partner   boolean default false,
  created_at    timestamptz default now()
);
```

Kulcs RLS: a `merge_sessions` és `merge_identity_map` *csak* az érintett két user számára olvasható, és csak a saját oldal-state-jüket tudják módosítani (pl. sajat consent szintjüket, saját megerősítéseiket).

A merge nézet renderelése: a kliensoldalon a session ID-vel kérdezünk le egy speciális Postgres function-t (`get_merge_view(session_id)`), ami visszaadja a két fél által megosztott embereket a megfelelő share_level alapján szűrve. Sosem ír.

## Implementációs fázisok

### Fázis 1 — Csontváz (~3 nap)
- DB migráció (a két új tábla + RLS)
- Settings → "Hálók megosztása" szekció: meghívás Firebase UID alapján vagy email alapján
- Meghívás flow: "X meg akarja osztani veled a hálóját" notifikáció (in-app, később push)
- Accept/Decline + share level választás
- Status: van session, de nem mutat semmit

### Fázis 2 — Identity matching (~3 nap)
- Postgres function `compute_match_candidates(session_id)`: visszaadja a telefonszám/email alapján auto-matchelt párokat
- Review képernyő ahol mindkét fél hagyhatja jóvá a javasolt fuzzy match-eket (Levenshtein név + group)
- Identity map mentődik a `merge_identity_map`-be

### Fázis 3 — Vizuális overlay (~3 nap)
- A meglévő 2D + 3D nézetbe egy "merge" mode (új mapMode érték)
- Nodok színe / forma a tulajdonosság szerint
- Combined edge set (mindkét fél kapcsolataival)
- Új side panel: "új dimenzió"-panel a megosztás-statisztikákkal

### Fázis 4 — Insights (~3 nap)
- Bridge-detection: kik az új közvetítők (degree a kombinált hálón)
- Erősség-eltérés highlight
- "Kérj bemutatást" cselekvési pont — egyelőre csak vizuális, később action item-mé válhatna
- Export: a merge nézetből készíthető PDF / kép a session lejárta előtt

### Fázis 5 — Polish (~2 nap)
- Lejárat-emlékeztető 1 órával előbb
- Megosztás módosítása session közben (degrade lehetséges, upgrade nem)
- Audit log (az adott user maga látja kivel mikor osztotta meg)

## Technikai kockázatok

1. **Identity matching false positives.** Két "Kovács Anna" nem ugyanaz. A manuális confirm flow ezt tompítja, de UX-szempontból érzékeny.
2. **Privacy lekvárkép.** Egy nem-figyelmes user "Full"-on oszt meg, és minden kontaktja megjegyzései kiszivárognak. Kell a default = Match-only ÉS egy nagyon explicit "biztos vagy benne?" lépés ha Full-ra vált.
3. **RLS bonyolultság.** A merge view function szigorú: ha bárhol kicsúszik egy `where` feltétel, minden adat látható lehet. Unit teszt minden share_level-re.
4. **Skálázhatóság.** Két 500-fős háló cross-join → 250 ezer pár az identity matchingnél. Indexek + okos prefilter (csak ahol legalább a name első karaktere stimmel) mehet.
5. **Mobil UX.** Két ember haját egyszerre képviselni szűk képernyőn nehéz. Az overlay (A) jobb mobilon, side-by-side (B) csak desktopon.

## Mi van utána (jövő, nem v1)

- **Csoportos merge** (3+ ember). Privacy szempontból nehéz, de értékes ha pl. egy 5-fős csapat együtt vizualizálja a kollektív hálóját.
- **Időbeli "snapshot merge"**: nem egy másik userrel, hanem önmagaddal egy hónappal ezelőtti állapotodban. Mit változtatott a hálón az elmúlt időszak?
- **Persistent shared workspace**: nem session, hanem közös tulajdonú "team graph". Külön projekt, szubsztanciális RBAC munka.
- **Federation**: ha valaha egy user több app-ban (LinkedIn-bemutatás, közös naptár, stb.) tart adatot, a merge view ezeket is bevonhatná.

## Sikerkritérium

A merge-nek akkor van értelme, ha:

- A két fél **5 perc alatt** lát értelmes átfedést (nem fél óra match-jóváhagyás)
- Legalább **egy "új dimenzió"** kiemelődik amire egyik fél sem gondolt
- A **privacy beállítás kontrollja egyértelmű** és nem hibázható el véletlen kattintással
- A merge session **bezárása után** semmilyen másik fél adata nem marad a saját kliensben sem (cache törlés is kell)

## Tiltólista

- Nem ad write-access a másik adatára. *Soha.*
- Nem küld notifikációt a másik féllel közös ismerősnek arról hogy szóba került.
- Nem tárol semmilyen merge-eredményt permanenseben — minden lekérdezés on-demand a session lejártáig.
- Nincs "anonim" merge — mindkét fél tudja kivel oszt meg.
