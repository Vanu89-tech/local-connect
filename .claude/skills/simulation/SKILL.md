---
name: simulation
description: Öffnet den iPhone-Simulator mit der installierten Local Connect App (Bundle ID: com.localconnect.app). Verwende diesen Skill immer wenn der User /simulation schreibt, den Simulator starten will, die App im Simulator testen möchte, oder sagt "zeig mir die App", "starte den Simulator", "öffne den Simulator", "simulation starten". Wir arbeiten ausschließlich mit dem Release-Build — kein Metro-Bundler nötig.
---

# Simulation Skill

Startet den iPhone-Simulator mit der Local Connect App (Release-Build, kein Metro nötig).

## Konstanten

- **Bundle ID:** `com.localconnect.app`
- **Fallback-UDID:** `1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF` (iPhone 17, iOS 26-5) — nur verwenden wenn kein Simulator läuft
- **Release-App:** `/Users/razvan/Library/Developer/Xcode/DerivedData/LocalSocial-bupvnnouhvtszkgedigfmvlyryri/Build/Products/Release-iphonesimulator/LocalSocial.app`

## Vorgehen

**Wichtig:** Zuerst prüfen ob bereits ein Simulator läuft (z.B. von Codex gestartet). Falls ja, diesen verwenden — nie einen anderen booten.

1. Simulator booten und öffnen:
   ```bash
   FALLBACK_UDID="1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF"
   # Bereits laufenden Simulator verwenden, sonst Fallback booten
   UDID=$(xcrun simctl list devices | awk '/Booted/{match($0, /\(([A-F0-9-]+)\)/, a); if(a[1]!="") print a[1]}' | head -1)
   if [ -z "$UDID" ]; then
     UDID="$FALLBACK_UDID"
     xcrun simctl boot "$UDID" 2>/dev/null || true
   fi
   open -a Simulator --args -CurrentDeviceUDID "$UDID"
   sleep 2
   ```

2. App starten:
   ```bash
   xcrun simctl launch "$UDID" com.localconnect.app
   ```

## JS-Only Änderungen (schnell, ~15s)

Für reine JS/TS-Änderungen (kein nativer Swift/ObjC Code) **keinen vollen Xcode-Build** machen — Bundle neu erstellen, mit Hermes kompilieren, in die laufende App kopieren:

```bash
UDID=$(xcrun simctl list devices | grep Booted | grep -oE '[A-F0-9-]{36}' | head -1)
HERMESC="/Users/razvan/Desktop/Local-Connect/artifacts/mobile/ios/Pods/hermes-engine/destroot/bin/hermesc"
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
pnpm exec expo export:embed --platform ios --dev false --minify false --reset-cache --bundle-output /tmp/lc_main.js --assets-dest /tmp/lc_assets
"$HERMESC" -emit-binary -out=/tmp/lc_main.jsbundle /tmp/lc_main.js
APP_PATH=$(xcrun simctl get_app_container "$UDID" com.localconnect.app)
cp /tmp/lc_main.jsbundle "$APP_PATH/main.jsbundle"
xcrun simctl terminate "$UDID" com.localconnect.app 2>/dev/null || true
sleep 0.5
xcrun simctl launch "$UDID" com.localconnect.app
```

**Wichtig:** Das Bundle muss mit Hermes kompiliert werden — plain JS funktioniert nicht, da die App Hermes-Bytecode erwartet.

**Wann Xcode-Build nötig:** Nur wenn sich native Abhängigkeiten, `app.json`, Expo-Plugins oder Swift/ObjC-Code geändert haben.

## Nach einem nativen Build

Wenn sich native Abhängigkeiten o.ä. geändert haben, vollen Xcode-Build und Neuinstallation:
```bash
FALLBACK_UDID="1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF"
UDID=$(xcrun simctl list devices | awk '/Booted/{match($0, /\(([A-F0-9-]+)\)/, a); if(a[1]!="") print a[1]}' | head -1)
if [ -z "$UDID" ]; then
  UDID="$FALLBACK_UDID"
  xcrun simctl boot "$UDID" 2>/dev/null || true
fi
cd /Users/razvan/Desktop/Local-Connect/artifacts/mobile
xcodebuild -workspace ios/LocalSocial.xcworkspace -scheme LocalSocial -configuration Release -sdk iphonesimulator -destination "id=$UDID"
RELEASE_APP="/Users/razvan/Library/Developer/Xcode/DerivedData/LocalSocial-bupvnnouhvtszkgedigfmvlyryri/Build/Products/Release-iphonesimulator/LocalSocial.app"
xcrun simctl terminate "$UDID" com.localconnect.app 2>/dev/null || true
xcrun simctl uninstall "$UDID" com.localconnect.app 2>/dev/null || true
xcrun simctl install "$UDID" "$RELEASE_APP"
xcrun simctl launch "$UDID" com.localconnect.app
```

## Kommunikation

Antworte auf Deutsch.
