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
- Xcode 26.3 auf macOS

## Projektstruktur
- `artifacts/mobile/` — React Native App
- `artifacts/api-server/` — Express 5 Backend (nur /healthz, noch kein echtes API)
- `artifacts/db/` — Drizzle ORM (Schema noch leer)
- `lib/api-zod/`, `lib/api-client-react/` — API-Schicht

## Wichtige Dateien
- `artifacts/mobile/app/_layout.tsx` — Root Navigator, Onboarding/Location-Check
- `artifacts/mobile/app/onboarding.tsx` — Welcome Screen
- `artifacts/mobile/app/location-setup.tsx` — Heimviertel-Setup (NEU)
- `artifacts/mobile/context/AppContext.tsx` — Haupt-State (Posts, Comments, User)
- `artifacts/mobile/context/LocationContext.tsx` — Location-State (NEU)
- `artifacts/mobile/app.json` — bundleIdentifier: com.localconnect.app

## iOS Build
```bash
cd artifacts/mobile
npx expo run:ios
```

## Erledigter Fortschritt

### Location Feature (fertig)
- Pflicht-Standort beim Start
- Heimviertel-Ausnahme: User gibt Viertel/Stadt ein → wird geocoded
- Wenn GPS nahe am Heimviertel (< 500m) → zeigt nur Heimname, nicht genaue Adresse
- Wenn unterwegs → Live-GPS (reverse geocoded auf Stadt/Viertel-Ebene)
- Wenn kein GPS erlaubt → nur Heimviertel-Modus

### Onboarding Flow
Onboarding → Location-Setup → Hauptapp

## Nächste Schritte (geplant)
- Location in Feed-Filterung einbauen (nur Posts aus Nähe zeigen)
- Echte Karte mit anderen Nutzern
- Backend API + Datenbank aufbauen
- Auth (Login/Register) implementieren

## User-Präferenzen
- Kommunikation auf Deutsch
- App-Name: "Locals"
