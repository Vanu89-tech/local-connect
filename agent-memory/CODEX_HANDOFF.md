# Codex Handoff

Stand: 2026-07-09

## Wichtigster Kontext

Wir bauen die iOS/Expo-App "Locals" in `/Users/razvan/Desktop/Local-Connect/artifacts/mobile`.
Der sichtbare App-Name ist `Locals`.
Der User möchte iterativ im Simulator testen und Features direkt weiterentwickeln.

## Simulator

- **DER einzige Simulator fuer Locals ab jetzt: iPhone 17 (iOS 27.0), UDID: `AE5622ED-D44C-4B6C-B472-B234A8DABA21`**
- Es gibt mehrere iPhone-17-Simulatoren auf dem System — ab jetzt NUR diesen iOS-27-Simulator nehmen.
- App Bundle ID: `com.localconnect.app`
- Simulator booten (falls Shutdown): `xcrun simctl boot "AE5622ED-D44C-4B6C-B472-B234A8DABA21" && open -a Simulator --args -CurrentDeviceUDID AE5622ED-D44C-4B6C-B472-B234A8DABA21`
- App starten: `xcrun simctl launch "AE5622ED-D44C-4B6C-B472-B234A8DABA21" "com.localconnect.app"`
- Screenshot: `xcrun simctl io "AE5622ED-D44C-4B6C-B472-B234A8DABA21" screenshot /tmp/s.png`
- Fuer native Aenderungen neu bauen: `xcodebuild -workspace ios/LocalSocial.xcworkspace -scheme LocalSocial -configuration Debug -destination 'id=AE5622ED-D44C-4B6C-B472-B234A8DABA21' -derivedDataPath /Users/razvan/Library/Developer/Xcode/DerivedData/LocalSocial-iOS27 build`
- Danach installieren: `xcrun simctl install AE5622ED-D44C-4B6C-B472-B234A8DABA21 /Users/razvan/Library/Developer/Xcode/DerivedData/LocalSocial-iOS27/Build/Products/Debug-iphonesimulator/LocalSocial.app`
- Hinweis: `expo run:ios --device ...` behandelt iOS-27-Simulatoren hier aktuell faelschlich als physische Devices und scheitert an Code Signing.

## Aktueller Fokus

Map/POI-Performance: Augsburg und Umgebung sind jetzt serverseitig als POI-Tile-Cache befuellt.

### POI Cache Stand

- Neue Supabase-Migration: `supabase/migrations/20260709060000_poi_tiles.sql`
- Neue API-Route: `artifacts/api-server/src/routes/poi.ts`
- Mobile API-Client: `artifacts/mobile/lib/poiTiles.ts`
- Importer: `scripts/src/build-poi-tiles.ts`
- Augsburg Cache: 399 Tiles, 21.579 POI-Eintraege, 2 leere Rand-Tiles.
- API-Test erfolgreich: `/api/poi/tiles/augsburg/575:3846` liefert 494 POIs.
- Map lädt POIs: Device-Cache -> API-Tile -> Overpass-Fallback.
- Mobile Cache-Key: `locals_poi_tile_v3:`.

### Naechste wichtige Schritte fuer andere Staedte

1. Region-Erkennung aus GPS/Home-Adresse.
2. Dynamische `regionId` statt festem `augsburg`.
3. Backend Auto-Provisioning fuer noch nicht gecachte Staedte.
4. Background Worker fuer POI-Import, niemals Stadtimport auf dem Handy.
5. Refresh/TTL/Versionierung fuer bestehende Stadt-Tiles, z.B. alle 7-14 Tage.

## Zuletzt erledigt (2026-06-10) — Session 8

### Sim-Tab: LOD-System komplett neu gebaut (simulation-lab.tsx)

- **4 Bugs gefixt:** Hard-Boundary bei Radius-Ende, maxVisible-Hard-Cut, minLod-vs-lodForDistance-Konflikt, keine Hysterese
- `lodForDistance()` → `lodScore()`: gibt kontinuierlichen Float 0.0–1.0 via Smoothstep zurück (kein Stufensprung mehr)
- `applyLodClass()` → `applyLodValue()`: setzt `--lod-scale` + `opacity` als inline CSS-Properties (kein Klassen-Flip mehr)
- `updateLodForAll()`: Sort+Slice → Budget-Pass (150/350/800 Budget je Qualitätsstufe) mit 10% Hysterese-Puffer
- Quality-Profile: `maxVisible`/`guaranteedPeopleRadiusM` entfernt → `budget`, `typeRadius`, `typeCost` pro Entitätstyp
- `typeRadius`: Locals bei WEAK nur 40% des Radius sichtbar, Transit immer 100%, Friends bei WEAK 70%
- Hysterese-Schwellen: Show > 0.06, Hide < 0.02 — verhindert Flackern an der Radiusgrenze
- CSS: 5 `.sim-lod-*`-Klassen → 1 `.sim-culled`-Klasse

### Simulation Skill: Schnell-Rebundle-Workflow etabliert
- JS-Änderungen brauchen keinen vollen Xcode-Build mehr
- `expo export:embed --dev false --minify false` + `hermesc -emit-binary` → Bundle kopieren → ~15s statt Minuten
- Skill aktualisiert mit korrekten Flags (ohne `-O`, mit `--reset-cache`)

### Simulation Skill: Gemeinsamer Simulator für Claude + Codex
- Skill prüft nun zuerst ob bereits ein Simulator läuft (z.B. von Codex) → verwendet diesen
- Verhindert dass Claude und Codex in verschiedenen Simulatoren arbeiten

### Bus/Tram-Symbole (simulation-lab.tsx)
- `transitEl()` und `transitScreenEl()`: Badge-Labels (`B21`, `T1`) → Emoji-Symbole `🚌`/`🚊`
- Marker verkleinert (44px Wrap, 24px Core statt 54px/30px)
- CSS: Transit-Marker-Klassen auf Emoji-basiertes Rendering umgestellt

### Betroffene Dateien
- `artifacts/mobile/app/(tabs)/simulation-lab.tsx`
- `.claude/skills/simulation/skill.md`

## Zuletzt erledigt (2026-06-01) — Session 7

### Swipe-to-Reply Mechanik überarbeitet (index.tsx)

- Pfeil-Indikator (corner-up-left Icon + swipeArrow Styles) komplett entfernt — keine visuelle Ablenkung mehr beim Swipen
- Gestenerkennung verbessert: Threshold 10px → 6px, Winkel 1.8x → 1.3x (Geste wird früher + bei diagonaler Bewegung erkannt)
- Widerstandskurve eingebaut: 1:1 bis 36px, danach nur 40% → natürlicher Gummiband-Effekt
- Haptic-Vorab-Feedback: Light-Impact genau bei 44px-Schwellwert während der Bewegung, Medium beim Loslassen
- Echter Bounceback via `Animated.spring` mit `bounciness: 10` nach erfolgreichem Swipe
- `onPanResponderTerminate` hinzugefügt für sauberes Abbrechen
- Release-Build neu gebaut und auf Simulator installiert (BUILD SUCCEEDED)

### Betroffene Dateien
- `artifacts/mobile/app/(tabs)/index.tsx`

## Zuletzt erledigt (2026-05-28) — Session 6

### Karten-Popup-System komplett gefixt (map.tsx)

**Problem 1 – Freunde zeigten mein Popup:**
- Ursache: Me-Marker hatte `z-index: 90` und `pointer-events` auf dem Wrap — fing Klicks der dahinterliegenden Freunde ab
- Fix: `meFr.wrap.style.pointerEvents = 'none'` (Inline-Style, nicht CSS-Klasse!) + Click-Handler direkt auf `meFr.fig`

**Problem 2 – Blank Map nach Popup-Implementierung:**
- Ursache: `\'` in TypeScript-Template-Literals wird zu `'` ausgewertet → bricht JS-String-Literale im WebView → kompletter Parse-Fehler
- Fix: Alle `innerHTML`-Strings durch `createElement` + `textContent` + `addEventListener` ersetzt

**Problem 3 – Klicks auf Marker tun nichts:**
- Ursache: WKWebView-Bug: CSS-Klasse `pointer-events: none` auf Parent blockiert GESAMTEN Subtree inkl. Kinder mit `pointer-events: auto`
- Fix: Globale CSS-Änderungen rückgängig gemacht; `pointer-events: none` nur Inline auf `meFr.wrap` (Me-Marker)

**Problem 4 – Popup-Animation springt von rechts nach links:**
- Ursache: Keyframe `transform` überschreibt das Basis-CSS `transform: translateX(-50%)` → Popup erscheint rechts, springt dann nach links
- Fix: Eigene `fig-popup-appear`-Keyframes mit `translateX(-50%)` in `from` + `to`, nur auf `.fig-popup-inner.visible`

**Problem 5 – Phantom-Popups ohne Klick auf Figur:**
- Ursache: `fr.wrap` bounding-box umfasst ganzen Name-Tag-Bereich, Klick im transparenten Bereich löste Popup aus
- Fix: `if (e.target === fr.wrap) return;` — nur Klicks auf sichtbare Kindelemente zählen

**Weitere Verbesserungen:**
- `map.on('click')`-Listener-Akkumulation beseitigt: ein einziger Handler schließt alle Popups
- 44pt Mindest-Touch-Target für Me-Marker: `.fig.fig-me { min-width: 44px; min-height: 44px }`
- iOS `touch-action: manipulation` + `-webkit-tap-highlight-color: transparent` auf `.fig` + `.fig-wrap`
- `map.on('dragstart')` schließt nun ebenfalls Inline-Popups

### /sync Skill neu angelegt
- Neuer Pfad: `~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/.../skills/sync/SKILL.md`
- Alter Pfad `~/.claude/skills/sync/` existiert nicht mehr

Betroffene Dateien:
- `artifacts/mobile/app/(tabs)/map.tsx`

## Zuletzt erledigt (2026-05-25) — aktuelle Session

### Modernes App-Design + Gruppen/Parties + Supabase
- UI-Chrome modernisiert: Apple-like/minimaler, gleiche Neon-Palette beibehalten.
- Kartendarstellung, Gebaeude, POIs und Map-Symbole bewusst nicht veraendert.
- Gruppen-/Partymechanik app-weit in `AppContext` verdrahtet.
- Gruppen koennen erstellt, benannt, verwaltet und geloescht werden.
- Party/Gruppe erscheinen als Threads im Nachrichten-Tab.
- Supabase-Migration erstellt: `supabase/migrations/20260525190000_groups_parties_messages.sql`
- User hat SQL fuer Tabellen + RLS-Policies in Supabase ausgefuehrt.

### App-Icon
- User waehlte Logo-Variante 3: zwei Sprechblasen mit Kartengrid, ohne Punkt/Pin.
- Implementiert als:
  - `artifacts/mobile/assets/images/icon.png`
  - `artifacts/mobile/assets/images/splash-icon.png`
- Nativer iOS-Rebuild auf festem iPhone 17 Simulator erledigt.

## Zuletzt erledigt (2026-05-25) — Session 4

### Party-System komplett (map.tsx + AppContext.tsx)
- "Party starten"-Button an den oberen Rand des Composer-Panels verschoben
- Bug fix: Party wurde nicht auf der Karte angezeigt (zIndex 95 + 30m lat-Offset gegen me-Marker-Überlappung)
- Bug fix: Party wurde immer am Heimstandort erstellt statt am eingegebenen Ort (geocoding-Override entfernt)
- `handleCreateParty` async: geocodet die Adresse mit `Location.geocodeAsync()` vor Party-Erstellung
- Sofortiges imperative map-Update via `webViewRef.current.injectJavaScript(...)` nach Party-Erstellung
- Party-Management-UI für den Ersteller: Dropdown mit "Mitglied hinzufügen", "Mitglied entfernen", "Party löschen"
- `deleteParty` und `updatePartyMembers` in AppContext hinzugefügt

### Codebase-Cleanup (alle Tabs)
- `map.tsx`: tote `areMapPartiesEqual`-Funktion, `renderedUsers/Pois/Parties`-States + Debounce-Effect, `visibleParties`-Memo entfernt
- `index.tsx`: `Animated`-Import + totes `emojiAnim`-Ref + Animation-Effect entfernt; `now()` → modul-level `nowTime()`; alle Callbacks in `useCallback` gewrappt; Bug `Date.nowTime()` → `Date.now()` behoben
- `profile.tsx`: `myPosts` → `useMemo`, `renderItem` → `useCallback`; Imports ergänzt
- `_layout.tsx`: toten `listeners`-Block auf "create"-Tab entfernt (feuert nie wenn `tabBarButton` gesetzt)

### /sync Skill erstellt
- Skills-Plugin-Verzeichnis: `~/Library/Application Support/Claude/.../skills/sync/SKILL.md`
- Workflow: Memory updaten (CODEX_HANDOFF, CURRENT_STATE, project_localconnect) → commit → push

Betroffene Dateien:
- `artifacts/mobile/app/(tabs)/map.tsx`
- `artifacts/mobile/app/(tabs)/index.tsx`
- `artifacts/mobile/app/(tabs)/profile.tsx`
- `artifacts/mobile/app/(tabs)/_layout.tsx`
- `artifacts/mobile/context/AppContext.tsx`

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
