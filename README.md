# netra_web

NETRA dashboard — Next.js 14 (App Router), TypeScript strict, Tailwind. User-facing text is in
Bahasa Indonesia; code is in English.

| Page | |
|---|---|
| `/peta` | live operations map: floor plan, robots with heading, active routes, anomaly pins (pulsing when they need validation), optional last-hour crowd overlay, fleet cards with commands, live event feed |
| `/anomali`, `/anomali/[id]` | validation queue with photos, early vs final detection, confirm / reject with category correction, position on the plan |
| `/patroli`, `/patroli/[id]` | patrol history, start now, per-patrol recap (duration, laps, stops, anomalies, crowd peak), timeline and map |
| `/jadwal` | weekly patrol schedules (WIB) |
| `/rute` | route database: preview on the plan, rename, archive, CSV download |
| `/keramaian` | crowd heatmap (peak or mean) and peak per hour/day, busiest hours |
| `/denah` | upload SVG / PNG / JPG / PDF (PDF page 1 is rendered to PNG in the browser) and calibrate base point, scale (two clicks + distance) and rotation against a recorded route; assign robots |
| `/pengaturan` | robots and tokens, anomaly category rules (validation, Telegram, chat id, minimum confidence) |

Structure: `src/lib` (typed API client, live WebSocket provider, map geometry, labels),
`src/components` (UI primitives, floor-plan viewer with pan/zoom, map layers, chart), and
`src/app/(dashboard)/<route>/_components` for route-specific parts.

## Develop

```bash
npm install
NETRA_API_URL=http://localhost:8080 npm run dev     # proxies /api to netra_api
```

The browser always calls `/api/...` on its own origin; in production Caddy routes `/api` to the
backend (see `infra/`). Replace `public/logos/ezra.svg` and `public/logos/lippo.svg` with the
official logo files.

## Build

```bash
npm run typecheck && npm run build
docker build -t netra-web .
```
