# Current State

Stand: 2026-05-25

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
- Gruppen- und Partymechanik ist app-weit im `AppContext` verdrahtet.
- Supabase-Migration fuer `groups`, `group_members` und `chat_messages` wurde erstellt und vom User in Supabase ausgefuehrt.
- Neues App-Icon wurde aus der gewaehlten Logo-Variante 3 umgesetzt:
  - `artifacts/mobile/assets/images/icon.png`
  - `artifacts/mobile/assets/images/splash-icon.png`
- Naechster wichtiger Schritt: nativer iOS-Rebuild, damit das neue App-Icon auf dem Simulator/Home-Screen sichtbar wird.

## Naechster wichtiger Schritt

Native iOS-App neu bauen/installieren, weil App-Icon-Assets nicht per Metro/Fast Refresh auf dem Homescreen aktualisiert werden.

Empfohlener Befehl:

```bash
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
pnpm exec expo run:ios
```

Danach pruefen:

- iPhone Simulator zeigt neues Locals-App-Icon.
- Splash-Icon ist aktualisiert.
- App startet weiterhin mit Supabase-Verbindung.

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

- Timestamp UTC: 20260525T204258Z
- Projekt: Local-Connect
- Branch: master
- Commit vor Sync: b0706c6
- Lokale Änderungen vor Memory-Update: 13
- Snapshot-Ziel: /Users/razvan/Documents/Local-Connect-sync-state/snapshots/20260525T204258Z
- Hinweis: Dieser Block wird automatisch von /sync aktualisiert.

### Geänderte Dateien vor Sync

- ` M agent-memory/CLAUDE_MEMORY.md`
- ` M agent-memory/CODEX_HANDOFF.md`
- ` M agent-memory/CURRENT_STATE.md`
- ` M artifacts/mobile/app/(tabs)/_layout.tsx`
- ` M artifacts/mobile/app/(tabs)/index.tsx`
- ` M artifacts/mobile/app/(tabs)/map.tsx`
- ` M artifacts/mobile/app/(tabs)/profile.tsx`
- ` M artifacts/mobile/app/presence-choice.tsx`
- ` M artifacts/mobile/assets/images/icon.png`
- ` M artifacts/mobile/assets/images/splash-icon.png`
- ` M artifacts/mobile/constants/graphicStyles.ts`
- ` M artifacts/mobile/context/AppContext.tsx`
- `?? supabase/migrations/20260525190000_groups_parties_messages.sql`
<!-- APP_SYNC_STATUS_END -->
