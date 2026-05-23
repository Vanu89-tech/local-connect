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

## User-Präferenzen

- Kommunikation auf Deutsch
- App-Name: "Locals"
- Der User arbeitet im iPhone Simulator und möchte schnell zwischen Codex und Claude Code wechseln können.
