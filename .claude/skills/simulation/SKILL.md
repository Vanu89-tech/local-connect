---
name: simulation
description: Öffnet den iPhone-Simulator mit der installierten Local Connect App (Bundle ID: com.localconnect.app). Verwende diesen Skill immer wenn der User /simulation schreibt, den Simulator starten will, die App im Simulator testen möchte, oder sagt "zeig mir die App", "starte den Simulator", "öffne den Simulator", "simulation starten". Wir arbeiten ausschließlich mit dem Release-Build — kein Metro-Bundler nötig.
---

# Simulation Skill

Startet den iPhone-Simulator mit der Local Connect App (Release-Build, kein Metro nötig).

## Konstanten

- **Bundle ID:** `com.localconnect.app`
- **UDID:** `1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF` (iPhone 17, iOS 26-5)
- **Release-App:** `/Users/razvan/Library/Developer/Xcode/DerivedData/LocalSocial-bupvnnouhvtszkgedigfmvlyryri/Build/Products/Release-iphonesimulator/LocalSocial.app`

## Vorgehen

1. Simulator booten und öffnen:
   ```bash
   UDID="1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF"
   xcrun simctl boot "$UDID" 2>/dev/null || true
   open -a Simulator --args -CurrentDeviceUDID "$UDID"
   sleep 2
   ```

2. App starten:
   ```bash
   xcrun simctl launch "$UDID" com.localconnect.app
   ```

## Nach einem neuen Build

Wenn der User einen neuen Release-Build erstellt hat, erst neu installieren:
```bash
UDID="1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF"
RELEASE_APP="/Users/razvan/Library/Developer/Xcode/DerivedData/LocalSocial-bupvnnouhvtszkgedigfmvlyryri/Build/Products/Release-iphonesimulator/LocalSocial.app"
xcrun simctl terminate "$UDID" com.localconnect.app 2>/dev/null || true
xcrun simctl uninstall "$UDID" com.localconnect.app 2>/dev/null || true
xcrun simctl install "$UDID" "$RELEASE_APP"
xcrun simctl launch "$UDID" com.localconnect.app
```

## Kommunikation

Antworte auf Deutsch. Kein Metro-Bundler — wir arbeiten ausschließlich mit dem Release-Build.
