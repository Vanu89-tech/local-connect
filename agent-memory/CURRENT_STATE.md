# Current State

Stand: 2026-05-24

## Kurzfassung

Locals ist eine Expo React Native iOS-App mit Supabase Auth/Backend, Kartenmodus, Messenger-Tab, Party-Funktionen, Startmodus `Online`/`Daheim`, Geofencing-Idee und austauschbarem Grafikstil-System.

Der User arbeitet auf Deutsch und testet meistens im iPhone Simulator.

## Projektpfade

- Repo: `/Users/razvan/Desktop/Local-Connect`
- Mobile App: `/Users/razvan/Desktop/Local-Connect/artifacts/mobile`
- Supabase Migrationen: `/Users/razvan/Desktop/Local-Connect/supabase/migrations`
- Shared Agent Memory: `/Users/razvan/Desktop/Local-Connect/agent-memory`

## Aktueller App-Stand

- Auth läuft über Supabase Auth.
- User kann in die App rein.
- Startauswahl `Online` / `Daheim` existiert.
- Heimadresse/500m-Geofencing ist vorbereitet.
- Home-Tab wurde zum Nachrichten/Messenger-Tab.
- Oben im Messenger gibt es horizontale Profil-/Party-Kreise.
- Party im Messenger kann als Gruppenchat simuliert/angezeigt werden.
- Kartenmodus hat Filter: Alles, Menschen, Freunde, Kennenlernen.
- Partys bleiben im Menschen-Filter sichtbar.
- Party-Button/Panel und Party-Erstellung existieren.
- Party folgt dem Host-Standort.
- Party-Marker zoomt beim Klick rein; erneuter Klick soll zur vorherigen Zoomstufe zurück.
- Karte nutzt Comic/Neon-inspirierte POIs, 3D-Buildings und Dev-3D-Button.
- Aktueller Grafikstil ist `neon`.

## Aktueller Stil-Stand

Der Stil wird zentral hier gesteuert:

```text
artifacts/mobile/constants/graphicStyles.ts
artifacts/mobile/constants/colors.ts
```

Aktiv:

```ts
export const ACTIVE_GRAPHIC_STYLE_ID = "neon";
```

Wichtig: Die alten Alias-Namen `comicPink`, `comicBlue`, `comicMint` in `colors.ts` sind derzeit technische Kompatibilitaetsnamen. Sie zeigen auf die aktive Palette. Spaeter sollten sie neutral benannt werden.

## Wichtige Befehle

TypeScript pruefen:

```bash
pnpm --dir /Users/razvan/Desktop/Local-Connect/artifacts/mobile exec tsc --noEmit
```

Diff auf Whitespace pruefen:

```bash
cd /Users/razvan/Desktop/Local-Connect
git diff --check
```

Expo starten:

```bash
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
pnpm exec expo start --dev-client --host localhost
```

## Arbeitsregeln

- Keine fremden Aenderungen verwerfen.
- Bei manuellen Edits `apply_patch` bevorzugen.
- Nach relevanten Code-Aenderungen TypeScript pruefen.
- Nach UI-Aenderungen Simulator/visuelle Kontrolle bevorzugen.
- Memory aktualisieren, wenn ein neues grosses Feature oder ein wichtiger Architekturentscheid dazukommt.

<!-- APP_SYNC_STATUS_START -->
## Letzter Sync

- Timestamp UTC: 20260525T140256Z
- Projekt: Local-Connect
- Branch: master
- Commit vor Sync: 5c4e2b8
- Lokale Änderungen vor Memory-Update: 5
- Hinweis: Dieser Block wird automatisch von /sync aktualisiert.

### Geänderte Dateien vor Sync

- artifacts/mobile/app/(tabs)/_layout.tsx
- artifacts/mobile/app/(tabs)/index.tsx
- artifacts/mobile/app/(tabs)/map.tsx
- artifacts/mobile/app/(tabs)/profile.tsx
- artifacts/mobile/context/AppContext.tsx
<!-- APP_SYNC_STATUS_END -->

