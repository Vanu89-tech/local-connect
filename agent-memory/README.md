# Local-Connect Agent Memory

Dieser Ordner ist der gemeinsame Einstiegspunkt fuer Codex und Claude Code.
Lies zuerst `CURRENT_STATE.md`, bevor du an der App weiterarbeitest.

## Dateien

- `CURRENT_STATE.md` - aktueller Projektstand, offene Themen, wichtigste Befehle.
- `CLAUDE_MEMORY.md` - uebernommene Claude-Code-Memory aus `.claude/.../memory/MEMORY.md`.
- `CODEX_HANDOFF.md` - kompakte Codex-Uebergabe aus dem aktuellen Arbeitsstand.

## Regeln fuer Assistenten

1. Kommunikation mit dem User auf Deutsch.
2. App-Projekt liegt hauptsaechlich in `artifacts/mobile`.
3. Keine fremden Aenderungen zuruecksetzen.
4. Nach groesseren Aenderungen mindestens `pnpm --dir artifacts/mobile exec tsc --noEmit` ausfuehren.
5. Wenn sich der Projektstand wesentlich aendert, diese Memory-Dateien aktualisieren.
