---
name: sync
description: >
  Projekt-Snapshot: aktualisiert die lokalen Memory-Dateien (agent-memory/ und ~/.claude/projects/…/memory/),
  staged alle Änderungen im Repo /Users/razvan/Desktop/Local-Connect, erstellt einen Commit und pusht nach GitHub.
  Verwende diesen Skill immer wenn der User /sync, /push, app-sync, app-push oder "sync" / "push" / "auf github" schreibt,
  oder wenn er die Arbeit für heute beenden will und den Stand sichern möchte.
---

# /sync — Projekt sichern & auf GitHub pushen

## Ziel

1. Memory-Dateien mit dem aktuellen Projektstand aktualisieren
2. Alle lokalen Änderungen committen
3. Zum GitHub-Remote pushen

Führe alle Schritte der Reihe nach aus, ohne Rückfragen — außer wenn ein Schritt fehlschlägt.

---

## Schritt 1 – Projektstand erfassen

Führe folgende Befehle aus, um den aktuellen Stand zu verstehen:

```bash
# Was hat sich geändert?
git -C /Users/razvan/Desktop/Local-Connect status --short

# Letzte Commits
git -C /Users/razvan/Desktop/Local-Connect log --oneline -10
```

Lies außerdem:
- `agent-memory/CODEX_HANDOFF.md` — existierender Handoff-Stand
- `~/.claude/projects/-Users-razvan-Downloads-Local-Connect/memory/project_localconnect.md` — Claude-Memory

---

## Schritt 2 – Memory-Dateien aktualisieren

### 2a) `agent-memory/CODEX_HANDOFF.md`

Aktualisiere den Abschnitt "Zuletzt erledigt" mit:
- Heutigem Datum (`YYYY-MM-DD`)
- Kurzem Stichpunkt-Listing der Änderungen in dieser Session (was wurde gebaut, gefixt, umbenannt?)
- Betroffene Dateien auflisten

Halte den Rest der Datei (Simulator-Befehle, Metro-Befehle, Supabase-URL) unverändert.

### 2b) `~/.claude/projects/-Users-razvan-Downloads-Local-Connect/memory/project_localconnect.md`

Aktualisiere den Abschnitt "Aktueller Stand" mit:
- Heutigem Datum
- 1–3 Sätzen zu den wichtigsten neuen Features/Fixes dieser Session

Halte Stack-Infos, Token-Dokumentation und Befehle unverändert — nur den "Stand"-Abschnitt updaten.

---

## Schritt 3 – Committen

```bash
# Alle relevanten Änderungen stagen (nicht .env oder Secrets)
git -C /Users/razvan/Desktop/Local-Connect add -A -- \
  ':!**/.env' ':!**/.env.*' ':!**/secrets*'

# Status prüfen — zeige was gestaged wird
git -C /Users/razvan/Desktop/Local-Connect status --short
```

Erstelle einen Commit. Die Commit-Message soll:
- Englisch, imperativ, max. 72 Zeichen erste Zeile
- 1–3 Bullet-Points mit den wichtigsten Änderungen (optional, wenn mehr als 1 Thema)

```bash
git -C /Users/razvan/Desktop/Local-Connect commit -m "$(cat <<'EOF'
<kurze Zusammenfassung der Änderungen>

- <Änderung 1>
- <Änderung 2>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Falls `git add -A` versehentlich Secrets staged, stoppe und frage den User.

---

## Schritt 4 – Push

```bash
git -C /Users/razvan/Desktop/Local-Connect push origin HEAD
```

Bei Fehler (z.B. divergierter Branch):
- Zeige die Fehlermeldung dem User
- Schlage `git pull --rebase origin main` vor, führe es aber NICHT automatisch aus

---

## Schritt 5 – Abschlussmeldung

Gib dem User eine kurze Bestätigung:
```
✓ Memory aktualisiert
✓ Commit: "<commit-hash> <commit-message>"
✓ Gepusht → https://github.com/Vanu89-tech/local-connect.git
```

Falls der Push fehlschlug, erkläre kurz warum und was der nächste Schritt ist.

---

## Wichtige Konstanten

| | |
|---|---|
| Repo | `/Users/razvan/Desktop/Local-Connect` |
| Remote | `https://github.com/Vanu89-tech/local-connect.git` |
| Branch | `main` (oder aktueller Branch) |
| Memory-Verzeichnis | `~/.claude/projects/-Users-razvan-Downloads-Local-Connect/memory/` |
| Handoff-Datei | `agent-memory/CODEX_HANDOFF.md` |
| Supabase | `https://ulalsudkwmtuchqljotl.supabase.co` |
| App Bundle | `com.localconnect.app` |
| Simulator | iPhone 17 (iOS 26.5), UDID `1B9DFD12-9FAC-4D2E-A50C-1925076FDBCF` |
