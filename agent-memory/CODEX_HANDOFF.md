# Codex Handoff

Stand: 2026-05-24

## Wichtigster Kontext

Wir bauen die iOS/Expo-App "Locals" in `/Users/razvan/Desktop/Local-Connect/artifacts/mobile`.
Der User möchte iterativ im Simulator testen und Features direkt weiterentwickeln.

## Simulator

- iPhone 17 (iOS 26.5), UDID: `1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF`
- App Bundle ID: `com.localconnect.app`
- App starten: `xcrun simctl launch "1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF" "com.localconnect.app"`
- Screenshot: `xcrun simctl io "1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF" screenshot /tmp/s.png`
- Hinweis: App nutzt eingebetteten JS-Bundle. Dev-Client Deep-Link (`exp+locals://`) funktioniert nicht.
  Für JS-Änderungen sichtbar: App neu bauen (`expo run:ios --device`).

## Aktueller Fokus

Style-System ist vollständig aufgeräumt. Alle `comic*`-Aliase wurden durch neutrale Tokens ersetzt.
Alle Screens wurden geprüft und bereinigt. TypeScript-Check sauber.

## Zuletzt erledigt (2026-05-24) — Session 3

### Proximity Radar – Radar-Overlay Fix (map.tsx)
- React Native `RadarOverlay`-Overlay entfernt (war statisch in der Bildschirmmitte, nicht auf der Karte)
- `onLoad`-Injection korrigiert: war Leaflet `L.circle()` (falsches Framework!) → jetzt MapLibre GL GeoJSON-Polygon
- Eigene `injectRadar` useCallback-Funktion + useEffect → Kreis aktualisiert sich wenn Radius/Position ändert
- MapLibre-Kreis: gestrichelte Linie + transparente Füllung, exakt um User-Koordinaten
- Ich-Marker (roter Punkt auf der Karte) pulsiert jetzt → `meEl.className = 'pulse'`
- Commit: fix: replace expo-notifications + metro config fixes (4b6c6c8)
Betroffene Dateien:
- `artifacts/mobile/app/(tabs)/map.tsx`

### Proximity Radar System – Phase 1–6 (vorherige Session)
- SQL-Migrations: `supabase/migrations/001_proximity.sql` + `002_proximity_realtime.sql`
- `lib/geohash.ts` — Pure-TS Geohash (encode/decode/neighbors)
- `lib/proximity.ts` — upsertMyLocation, fetchNearbyEntities, removeMyLocation
- `lib/notifications.ts` — Alert.alert Fallback (expo-notifications erfordert Config Plugin)
- `context/ProximityContext.tsx` — GPS-Watching, Supabase Realtime (9 Kanäle), Cooldowns
- `components/RadarOverlay.tsx` — Animierte SVG-Pulse-Ringe (4 Ringe, Animated.loop)
- `app/radar-settings.tsx` — Radius-Chips, Sichtbarkeit, Intent
- `app/_layout.tsx` — ProximityProvider hinzugefügt
- `metro.config.js` — unstable_enableSymlinks, pnpm-Store in watchFolders

## Zuletzt erledigt (2026-05-24) — Session 2

### Messenger-Tab Fixes (index.tsx)
- Send-Button: Farbe → `Colors.light.tint` (neon pink, war tintBlue)
- Empfangene Nachrichten (bubbleTheirs): → `Colors.light.tintBlue` (cyan, war backgroundSecondary)
- Text auf cyan-Bubbles: → `Colors.light.onBright` (dunkel, war `text` = unsichtbar auf Cyan)
- Send-Button hatte keinen `onPress`-Handler → `handleSend` implementiert
- Lokale Nachrichten-State (`localMessages` + `scrollRef`) für optimistische Chat-Updates
- Neues Token `onBright: "#02070D"` in `graphicStyles.ts` + `colors.ts`

### Header-Icons Fix (index.tsx)
- Home- und Such-Icons in der Messenger-Kopfzeile waren unsichtbar (helles Icon auf gelbem Button)
- Lösung: Icon-Farbe → `Colors.light.onBright` (dunkel auf hellem Hintergrund)
- Auch: X-Icon im Such-Modal → `Colors.light.onBright`

### /sync Skill erstellt
- `.claude/skills/sync/SKILL.md` angelegt
- Workflow: Memory updaten → commit → push nach GitHub

## Zuletzt erledigt (2026-05-24) — Session 1

### Style-System Umbenennung (vollständig abgeschlossen)
- `comicInk` → `Colors.light.text` (überall ersetzt)
- `comicPaper` → entfernt (war unbenutzt)
- `comicPink` → `Colors.light.tint` (überall ersetzt)
- `comicBlue` → `Colors.light.tintBlue` (überall ersetzt)
- `comicYellow` → `Colors.light.yellow` (neues Token)
- `comicMint` → `Colors.light.mint` (neues Token)
- `map.comicBlue/Pink/Yellow` → `map.accentBlue/accentPink/accentYellow`
- CSS-Variablen: `--comic-blue/pink/yellow` → `--accent-blue/accent-pink/accent-yellow`
- Neues Token `onPrimary` in graphicStyles.ts + colors.ts

### Screen-Audit (create-post, post/[id], profile, onboarding)
- `create-post.tsx`: passiveButtonText, postBtnText, categoryChipTextSelected, chipTextSelected → `Colors.light.onPrimary`
- `profile.tsx`: emptyBtnText → `Colors.light.onPrimary`
- `onboarding.tsx`: bubbleCenter icon-Farbe → `Colors.light.onPrimary`
- `post/[id].tsx`: war bereits sauber, keine Änderungen nötig

Betroffene Dateien:
- `constants/graphicStyles.ts`
- `constants/colors.ts`
- `app/presence-choice.tsx`
- `app/(tabs)/map.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/profile.tsx`
- `app/(auth)/register.tsx`
- `app/create-post.tsx`
- `app/onboarding.tsx`

## Metro / Dev

Metro muss aus dem richtigen Verzeichnis gestartet werden:
```bash
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
pnpm exec expo start --dev-client --host localhost
```

## Sync / GitHub

Der User hat Skills:
- `/sync` bzw. `app-sync`: Snapshot, remote refresh, auto-commit, push.
- `/push` bzw. `app-push`: commit + push.

## Supabase

Projekt-URL: https://ulalsudkwmtuchqljotl.supabase.co

## Offene / naheliegende nächste Aufgaben

- Neue Features bauen (z.B. weiterer Map-Ausbau, Profil-Bearbeitung, etc.)
- Bei Bedarf `expo run:ios` um JS-Änderungen im nativen Build sichtbar zu machen
- Weitere Screens bei Bedarf auf `onPrimary` prüfen (z.B. `user/[id].tsx`)
