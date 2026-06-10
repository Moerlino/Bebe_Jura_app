# Bebe Jura PWA

Private, leichtgewichtige Jura-Wiederholungsapp für iPhone.

## Inhalt

- `data/questions.json`: extrahierter Fragenkatalog
- `index.html`, `styles.css`, `app.js`: App
- `manifest.webmanifest`, `service-worker.js`: PWA-/Offline-Funktion

## Auf dem iPhone installieren

1. Ordner bei Netlify, GitHub Pages oder Vercel veröffentlichen.
2. Die veröffentlichte URL in Safari auf dem iPhone öffnen.
3. Teilen-Symbol antippen.
4. „Zum Home-Bildschirm“ wählen.
5. App als „Bebe Jura“ speichern.

## Netlify-Schnellweg

1. ZIP entpacken.
2. Den entpackten Ordner bei Netlify unter „Add new site“ → „Deploy manually“ hochladen.
3. Die Netlify-URL auf dem iPhone öffnen.

## Lokaler Test

Nicht direkt per Doppelklick öffnen, weil Browser `fetch()` für lokale Dateien blockieren können.

Stattdessen im Ordner starten:

```bash
python3 -m http.server 8080
```

Dann öffnen:

```text
http://localhost:8080
```
