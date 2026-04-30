# ago_socihalo – 3D Kapcsolati Szoba prototípus

Ez már nem CSS-perspektívás demo, hanem valódi WebGL/Three.js alapú React prototípus.

## Mit tud

- teljes 3D szoba padlóval, falakkal és zónákkal
- 10 próbaember
- egyszerű, ember formájú 3D piktogram karakterek
- fiú/lány variáns
- mozgó emberek: finom lebegés, testmozgás, sway/bob animáció
- térbeli ívelt kapcsolatvonalak
- kapcsolat-erősség szerinti fény/vonalvastagság
- család / munka / barátok szűrők
- erős / gyenge kapcsolat szűrő
- kattintható személyek
- jobb oldali adatpanel
- OrbitControls: kamera forgatás, zoom, pan

## Futtatás

```bash
npm install
npm run dev
```

## Beépítés az ago_socihalo projektbe

A meglévő projekt React + Vite + TypeScript. A `package.json` dependencies részéhez add hozzá:

```json
"three": "^0.171.0",
"@react-three/fiber": "^8.17.10",
"@react-three/drei": "^9.122.0"
```

Dev dependency:

```json
"@types/three": "^0.171.0"
```

Majd másold be:

```text
src/RelationshipRoom3D.tsx
src/styles.css
```

A meglévő `MapView` mellé érdemes tenni, nem azonnal helyette. Javasolt útvonal:

```text
src/views/Map3D/RelationshipRoom3D.tsx
src/views/Map3D/RelationshipRoom3D.css
```

## Következő profi lépés

A mostani próbadata helyére az app saját `Person` és `Connection` típusait kell bekötni:

- `people` tömb helyett `usePeople()`
- `connections` tömb helyett `useConnections()`
- `selectedId` helyett `useAppStore().selectedPersonId`
- a pozíciókat lehet generálni csoport szerint vagy menteni adatbázisba

## Fontos technikai döntés

Ezt nem Canvas 2D-vel érdemes építeni, hanem WebGL-lel. Canvas 2D csak ál-3D lenne. A React Three Fiber jó irány, mert JSX-ben írható, mégis valódi 3D.
