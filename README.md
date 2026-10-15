# netra-fleet-fe

Dashboard of **NETRA Fleet**, the patrol command center for Pashupati robots. Next.js 14 (App
Router), TypeScript strict, Tailwind; no chart or map libraries — the floor plan, layers and charts
are plain SVG.

## Features

- **Dashboard** (start page) — wall-display overview: situation figures, live map with robot
  trails and follow mode, one "needs attention" queue (e-stop, alarms, health, battery, clock,
  detections to validate with Confirm / Reject), fleet controls including E-stop, activity log,
  today's patrol timeline, findings by category and crowd per hour. Fills a 1280 × 700+ window
  without scrolling; the sidebar can be hidden (button or `[`), full screen from the header.
- **Operations map** — live robots on the calibrated floor plan, active routes, anomaly pins, crowd
  layer, layer toggles; fleet cards with battery, mode, people, health and commands; live event feed.
  Without a calibrated floor plan (or with the Grid switch) the map is a metric grid in the robot's
  map frame: 1 m lines, bold every 5 m, axes and origin, robots with heading, routes, anomaly pins.
- **Anomalies** — gallery with filters, detail with early/final detection, location on the plan and
  operator validation; Excel export.
- **Patrols** — history, start now, per-patrol recap (stats, map, categories, timeline), PDF report.
- **Schedules** — weekly or one-off.
- **Routes** — database of recorded routes, rename, archive, CSV download.
- **Crowd** — heatmap (peak/mean), per-hour and per-day peaks, busiest hours.
- **Robot detail** — track replay from the telemetry history, battery and people charts.
- **Floor plans** — upload SVG/PNG/JPG/PDF, calibrate base point, rotation and scale, assign robots.
- **Reports** — summary PDF/Excel, anomaly and patrol exports, in English or Indonesian.
- **Administration** — users and roles, audit log, robots and tokens, anomaly rules.
- **Access control** — menus and buttons follow the role (viewer, operator, supervisor, admin).
- **Dark and light mode**, **English (default) and Indonesian**, remembered per browser.

## Structure

```
src/
  app/login, app/(dashboard)/<page>   pages (English routes: /map, /anomalies, /patrols, ...)
  components/                         AppShell, FloorPlanView, MapLayers, BarChart, ui, icons
  i18n/                               en.ts (source of truth), id.ts (type-checked against en), provider
  lib/                                api client, types, live WebSocket, session (RBAC), theme, format, geometry
```

Themes: Tailwind `ink-*` (surfaces) and `slate-*` (text) colours are CSS variables, swapped by the
`dark` / `light` class in `globals.css`, so every component renders in both themes. Translations:
add a key to `en.ts`; `id.ts` fails to compile until it has the same key.

## Develop

```bash
npm ci
NETRA_API_URL=http://localhost:8080 npm run dev   # proxies /api to the backend
npm run lint && npm run typecheck && npm run format:check
lefthook install                                  # prettier, eslint, tsc, conventional commits
```

CI checks formatting, lint, types and the build, then pushes `ghcr.io/<owner>/netra-web` on `main`
and `v*` tags.

Replace `public/logos/ezra.svg` and `public/logos/lippo.svg` with the official logo files.
