# RING RUSH — Neon Reaktionsspiel

Ein Selbstbau-Neon-Arcade-Game: Drücke den Button im perfekten Moment — je länger
du wartest, desto mehr Punkte (inkl. Gedulds-Multiplikator, Boost ×1–×10,
Overdrive, Phönix, Happy-End-Feuerwerk).

Das Projekt ist eine **Next.js**-App, die zu **100 % statisch** gebaut wird
(`next build` → Ordner `out/`). Der fertige Build läuft auf jedem beliebigen
statischen Webserver — ganz ohne Datenbank oder Backend.

## Entwicklung

```bash
bun install     # oder: npm install
bun run dev     # Entwicklungsserver auf http://localhost:3000
bun run build   # statischer Export nach out/
```

## Deploy (GitHub Pages)

In `.github/workflows/deploy.yml` liegt ein fertiger Workflow: Bei jedem Push
auf `main` baut GitHub das Spiel automatisch und veröffentlicht es unter

```
https://<DEIN-NAME>.github.io/<REPO-NAME>/
```

Einmalig aktivieren: **Settings → Pages → Build and deployment → Source:
„GitHub Actions“**. Der Pfad-Präfix (basePath) wird vom Workflow automatisch
aus dem Repository-Namen abgeleitet — der Repo-Name kann also frei gewählt
werden.

## Struktur

```
src/app/                     Seite + Layout + Fonts
src/components/game/         Ring-Rush-Spielkomponente
src/lib/game/config.ts       Balancing (Zeit, Preise, Punkteformel)
src/lib/game/sound.ts        SFX-Engine (Sounds: mixkit.co, Gratis-Lizenz)
src/lib/game/particles.ts    Partikel & Feuerwerk
public/game/                 Hintergrundbild + 13 Sound-Effekte
.github/workflows/           Auto-Deploy zu GitHub Pages
```

Viel Spaß beim Spielen! 🎮
