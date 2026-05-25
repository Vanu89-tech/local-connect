# Claude Memory Snapshot

Quelle: `.claude/projects/-Users-razvan-Downloads-Local-Connect/memory/MEMORY.md`

# Local-Connect Projekt

## Überblick

Hyper-lokale Social App "Locals" — Nutzer sehen was in ihrer Nähe passiert, verbinden sich mit Menschen in der Stadt.

## GitHub

https://github.com/Vanu89-tech/local-connect

## Tech Stack

- React Native + Expo (expo-router, file-based routing)
- TypeScript
- pnpm (Workspace-Setup)
- AsyncStorage für lokale Persistenz
- expo-location für GPS
- Supabase für Auth, Daten, Realtime-nahe App-Daten und Storage
- Xcode/iOS Simulator auf macOS

## Projektstruktur

- `artifacts/mobile/` — React Native App
- `artifacts/api-server/` — Express 5 Backend (nur /healthz, aktuell nicht Hauptpfad)
- `lib/api-zod/`, `lib/api-client-react/` — API-Schicht aus dem Template
- `supabase/migrations/` — SQL-Migrationen für Locals-Backend

## Wichtige Dateien

- `artifacts/mobile/app/_layout.tsx` — Root Navigator, Onboarding/Auth/Location/Startmodus-Check
- `artifacts/mobile/app/presence-choice.tsx` — Startbildschirm mit Online/Daheim
- `artifacts/mobile/app/location-setup.tsx` — Heimadresse/Geofencing-Setup
- `artifacts/mobile/app/(tabs)/map.tsx` — Kartenmodus, Filter, Partys, POIs, 3D
- `artifacts/mobile/app/(tabs)/index.tsx` — Nachrichten/Messenger-Tab
- `artifacts/mobile/context/AppContext.tsx` — App-State
- `artifacts/mobile/context/AuthContext.tsx` — Supabase Auth
- `artifacts/mobile/context/LocationContext.tsx` — Location, Startmodus, Geofencing
- `artifacts/mobile/constants/graphicStyles.ts` — austauschbare Grafikstile
- `artifacts/mobile/constants/colors.ts` — aktive Style-Tokens
- `artifacts/mobile/app.json` — bundleIdentifier: `com.localconnect.app`

## iOS Build

```bash
cd artifacts/mobile
npx expo run:ios
```

## Naechster wichtiger Schritt

Native iOS-App neu bauen/installieren, damit das neue App-Icon sichtbar wird.

Grund:
- `artifacts/mobile/assets/images/icon.png` wurde ersetzt.
- `artifacts/mobile/assets/images/splash-icon.png` wurde ersetzt.
- iOS Homescreen/Splash-Icon aktualisieren sich nicht per Metro/Fast Refresh.

Empfohlener Befehl:

```bash
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
pnpm exec expo run:ios
```

Danach pruefen:
- neues Locals-App-Icon auf dem iPhone Simulator
- Splash-Icon aktualisiert
- App startet weiter mit Supabase-Verbindung

## Aktueller Stand 2026-05-25

- UI-Chrome wurde Apple-like/minimaler modernisiert, Neon-Palette bleibt.
- Kartendarstellung/Gebaeude/POI-Symbole sollten nicht veraendert werden.
- Gruppen- und Partymechanik ist app-weit im `AppContext` verdrahtet.
- Supabase-Migration fuer `groups`, `group_members`, `chat_messages` wurde erstellt und vom User ausgefuehrt.
- Neues App-Icon basiert auf zwei Sprechblasen mit Kartengrid, Variante 3 aus den Vorschlaegen.

## User-Präferenzen

- Kommunikation auf Deutsch
- App-Name: "Locals"
- Der User arbeitet im iPhone Simulator und möchte schnell zwischen Codex und Claude Code wechseln können.
