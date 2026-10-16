<div align="center">

<img src="docs/logo.svg" width="96" alt="NETRA logo">

# NETRA Fleet dashboard

**The web dashboard of the NETRA patrol command center: live robots on the mall map, patrols and
schedules, anomaly validation, crowd analytics, reports and administration, in English and
Indonesian, light and dark.**

[![CI](https://github.com/DarmawanWeb/netra-fleet-fe/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DarmawanWeb/netra-fleet-fe/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6%20strict-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-5FA04E?logo=nodedotjs&logoColor=white)
![Languages](https://img.shields.io/badge/UI-English%20%7C%20Indonesia-FF9F43)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

[Features](#features) · [Structure](#structure) · [Documentation](#documentation) · [Develop](#develop)

</div>

---

Part of [NETRA](https://github.com/DarmawanWeb/Netra), which deploys it as `netra-web` with the
[backend](https://github.com/DarmawanWeb/netra-fleet-be). Next.js 14 (App Router), TypeScript
strict and Tailwind; no chart or map libraries: the floor plan, the grid, the layers and the charts
are plain SVG. Operators have their own guide,
[Panduan Operator](https://github.com/DarmawanWeb/Netra/blob/main/docs/NETRA-Panduan-Operator.pdf).

## Features

**Monitor**
- **Dashboard** (start page) for the control-room wall: today's figures, a live map with robot
  trails and follow mode, one "needs attention" queue (e-stop, alarms, health, battery, clock,
  detections to confirm or reject), fleet controls including the e-stop, the activity log, today's
  patrol timeline, findings by category and crowd per hour. Fills a 1280 × 700 window without
  scrolling; the sidebar hides (button or `[`), full screen from the header.
- **Operations map**: live robots, active routes, anomaly pins and the crowd of the last hour,
  with layer switches; fleet cards with battery, mode, people, health, commands and live controls;
  a live event feed; any recorded route can be shown without running a patrol.
- **Floor plan or grid**: on a calibrated floor plan, or, until there is one, on a metric grid in
  the robot's map frame (1 m lines, bold every 5 m, axes and origin). Every map, crowd heatmap,
  trails and track replay included, works on both.
- **Robot detail**: AI inspection and people detection controls, CPU, GPU, RAM and temperature,
  battery and people charts, track replay.

**Operate**
- **Patrols**: history, start now, per-patrol recap (figures, map, categories, timeline), PDF report.
- **Schedules**: weekly or one-off.
- **Routes**: the recorded routes on the map, rename, archive, CSV download.
- **Anomalies**: gallery with filters, detail with early and final detection, location, operator
  validation; Excel export.

**Analyse**
- **Crowd**: heatmap (peak or mean), peaks per hour and per day, busiest hours.
- **Reports**: summary PDF or Excel, anomaly and patrol exports, in English or Indonesian.

**Administer**
- **Floor plans**: upload SVG, PNG, JPG or PDF, calibrate the base point, rotation and scale, assign
  robots.
- **Settings**: robots and their tokens, anomaly rules per category, API clients for third-party
  applications (admins).
- **Users and audit log**; menus and buttons follow the role (viewer, operator, supervisor, admin).

## Structure

```
src/
  app/login, app/(dashboard)/<page>   pages (English routes: /map, /anomalies, /patrols, ...)
  components/                         AppShell, FloorPlanView, GridMapView, MapLayers, RobotControls, ui
  i18n/                               en.ts (source of truth), id.ts (type-checked against en), provider
  lib/                                api client, types, live WebSocket, session (RBAC), hooks, theme,
                                      format, geometry, clipboard
```

Themes: the Tailwind `ink-*` (surfaces) and `slate-*` (text) colours are CSS variables swapped by
the `dark` and `light` class in `globals.css`, so every component renders in both themes.
Translations: add a key to `en.ts`; `id.ts` fails to compile until it has the same key.

## Documentation

| Document | Contents |
|---|---|
| [Architecture](docs/architecture.md) | Stack, build and image, environment, source layout, pages and permissions, app shell, data layer and live socket, maps (plan or grid), i18n, theming |
| [Development](docs/development.md) | Running against an API, scripts, lint, format and typecheck, git hooks, CI and images, recipes for pages, API calls and translations |

## Develop

```bash
npm ci
NETRA_API_URL=http://localhost:8080 npm run dev   # proxies /api (and the live socket) to the backend
npm run lint && npm run typecheck && npm run format:check
lefthook install                                  # prettier, eslint, tsc, conventional commits
```

CI ([ci.yml](.github/workflows/ci.yml)) checks formatting, lint, types and the build, then pushes
`ghcr.io/<owner>/netra-web` on `main` and `v*` tags.

Replace `public/logos/ezra.svg` with the official logo file. Released under the
[Apache License 2.0](LICENSE).
