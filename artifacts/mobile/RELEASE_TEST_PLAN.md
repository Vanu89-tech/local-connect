# Locals Release-Testplan (Friends Testbuild)

## 1) Account & Session
1. Neu registrieren (frische Mail), Login, App neu starten: eingeloggt bleiben.
2. Logout/Login erneut: keine weiße Seite, kein Loop.

## 2) Startmodus & Geofencing
3. Nach App-Start erscheinen nur `Online` / `Daheim`.
4. `Daheim`: Feed + Karte sichtbar, aber keine aktiven Aktionen (Post/Like/Party).
5. `Online`: aktive Aktionen funktionieren.
6. In Home-Nähe (500 m) wird korrekt auf passiv/daheim umgestellt.

## 3) Home Feed
7. Pull-to-refresh lädt ohne Hänger.
8. Post öffnen/schließen, Scroll stabil, keine Sprünge.

## 4) Posten (Text + Foto)
9. Create Post: nur Text posten klappt.
10. Foto aus Mediathek posten klappt.
11. Foto mit Kamera posten klappt.
12. Neuer Post erscheint direkt im Home-Feed mit Bild.
13. App neu starten: Post bleibt da (Supabase).

## 5) Kartenmodus
14. Karte lädt ohne weißen Screen.
15. Zwei-Finger-Swipe nach oben -> 3D, Standard bleibt Top-Down.
16. Doppeltipp zoomt rein, Dreifachtipp auf Ausgangszoom.
17. Filter prüfen:
   - `Alles`: Menschen + POIs + Partys
   - `Menschen`: nur Menschen + Partys (keine POIs)
   - `Freunde` / `Kennenlernen`: Markerlogik korrekt
18. Comic-POIs sichtbar (Bus, Schule, Kirche, Shop, Grünfläche mit 3-Bäume-Symbol).

## 6) Party
19. Party-Panel auf/zu, Scroll im Panel klappt.
20. Party erstellen erscheint auf Karte.
21. Wenn Host sich bewegt, Party bewegt sich mit.

## 7) Stabilität & Akku
22. 10 Minuten zwischen Tabs wechseln (Home/Karte/Create/Profile): keine Crashes.
23. App in Hintergrund 2–3 Min, zurück: keine Fehlerflut, Karte/Feed laden normal.
24. Optional: schwaches Netz testen (WLAN aus/an): keine Totzustände.
