# Current State

Stand: 2026-05-28

## Kurzfassung

Locals ist eine Expo React Native iOS-App mit Supabase Auth/Backend, Kartenmodus, Messenger-Tab, Party-Funktionen, Startmodus `Online`/`Daheim`, Geofencing-Idee und austauschbarem Grafikstil-System.

Der User arbeitet auf Deutsch und testet meistens im iPhone Simulator. **DER einzige Simulator fuer Locals: iPhone 17 (iOS 26.5), UDID `1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF`.** Es gibt mehrere iPhone-17-Simulatoren — nur dieser hat die App installiert. Immer diesen booten, nie einen anderen.
- App-Name fuer Nutzer: `Locals`.
- Messenger-Fundament gestartet: Optimistic Sending, Sendestatus, Realtime-Dedupe, App-Fokus-Resync und Chat-Bilder via `chat-images`.
- Neue Supabase-Migration ausfuehren: `supabase/migrations/20260528090000_chat_reliability_security.sql`.
- Fuer Start direkt ueber App-Icon im Simulator: Release-Build installieren mit `pnpm exec expo run:ios --configuration Release --device 1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF`. Das eingebettete JS-Bundle startet ohne Metro.

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
- Karten-Popup-System vollständig gefixt: Inline-Popups über Figurenköpfen, korrekte Animation, Phantom-Popup-Fix, WKWebView pointer-events-Fix.
- Karte nutzt Comic/Neon-inspirierte POIs, 3D-Buildings und Dev-3D-Button.
- Aktueller Grafikstil ist `neon`.
- Gruppen- und Partymechanik ist app-weit im `AppContext` verdrahtet.
- Supabase-Migration fuer `groups`, `group_members` und `chat_messages` wurde erstellt und vom User in Supabase ausgefuehrt.
- Supabase-Migration fuer Chat-Zuverlaessigkeit/Sicherheit wurde erstellt: `supabase/migrations/20260528090000_chat_reliability_security.sql`.
- Neues App-Icon wurde aus der gewaehlten Logo-Variante 3 umgesetzt:
  - `artifacts/mobile/assets/images/icon.png`
  - `artifacts/mobile/assets/images/splash-icon.png`
- Naechster wichtiger Schritt: neue Chat-Migration in Supabase ausfuehren und Messenger im Simulator testen.

## Naechster wichtiger Schritt

Neue Chat-Migration in Supabase ausfuehren: `supabase/migrations/20260528090000_chat_reliability_security.sql`
(noch nicht ausgefuehrt — Messenger-Fundament wartet darauf).

Empfohlener Befehl:

```bash
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
pnpm exec expo run:ios
```

Danach pruefen:

- iPhone Simulator zeigt neues Locals-App-Icon.
- Standard-Simulator fuer Locals: iPhone 17, UDID `1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF`.
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

- Timestamp UTC: 20260601T014841Z
- Projekt: Local-Connect
- Branch: master
- Commit vor Sync: 39d3cfa
- Lokale Änderungen vor Memory-Update: 1
- Snapshot-Ziel: /Users/razvan/Documents/Local-Connect-sync-state/snapshots/20260601T014841Z
- Hinweis: Dieser Block wird automatisch von /sync aktualisiert.

### Geänderte Dateien vor Sync

- ` M artifacts/mobile/app/(tabs)/map.tsx`
<!-- APP_SYNC_STATUS_END -->
