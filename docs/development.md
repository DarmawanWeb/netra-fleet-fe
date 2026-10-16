# Development

How to run, check and extend the dashboard. The structure of the code is described in [architecture](architecture.md).

## Prerequisites

- Node.js 20: the Docker base image is `node:20-alpine` and CI sets up Node 20. The repository has no `engines` field or `.nvmrc`.
- npm, with the committed `package-lock.json` (lockfile version 3).
- A running NETRA API (`netra-fleet-be`) and an account on it.
- Optional: the `lefthook` binary for the Git hooks. It is not an npm dependency of this repository; install it separately.
- Optional: Docker with Buildx to build the image.

## Install

```bash
npm ci
```

`npm ci` runs the `postinstall` script, which copies `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/pdf.worker.min.mjs`. The copy is git-ignored and is needed to upload PDF floor plans. After an install with `--ignore-scripts`, run `npm run postinstall`.

## Run against an API

The dashboard never uses an absolute API address: REST calls go to `/api/v1/...` on the page's origin and the live socket to `ws(s)://<page host>/api/v1/ws`. The API must therefore answer on the same origin as the dashboard. In production, Caddy does that. In development, [`next.config.mjs`](../next.config.mjs) adds a rewrite when `NETRA_API_URL` is set:

```bash
NETRA_API_URL=http://localhost:8080 npm run dev
```

- Every `/api/:path*` request is proxied to `${NETRA_API_URL}/api/:path*`. Give the base URL of the API without a trailing slash and without `/api`. The port above is the one in the repository README; use the address your API listens on.
- The Next.js server also proxies the WebSocket upgrade of a rewrite to an external URL, so the live connection works through `next dev`.
- `NETRA_API_URL` is read when the dev server starts; restart it after a change.
- Without the variable there is no rewrite: `/api` requests reach Next.js itself and fail, unless another reverse proxy serves the dashboard and the API on one origin.
- Open `http://localhost:3000` (the default port of `next dev`) and sign in with an API account. The token is kept in `localStorage` (`netra.token`); a 401 from the API clears it and returns to `/login`.
- `NEXT_PUBLIC_TZ` sets the display time zone (default `Asia/Jakarta`), for example `NEXT_PUBLIC_TZ=Asia/Makassar npm run dev`.

## npm scripts

| Script         | Command                                    | Use                                                                                                        |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `dev`          | `next dev`                                 | Development server with hot reload                                                                         |
| `build`        | `next build`                               | Production build; the standalone server lands in `.next/standalone`                                        |
| `start`        | `next start`                               | Serves a build; with `output: 'standalone'` Next.js warns and recommends `node .next/standalone/server.js` |
| `typecheck`    | `tsc --noEmit`                             | Type check of the whole project                                                                            |
| `lint`         | `next lint`                                | ESLint                                                                                                     |
| `format`       | `prettier --write "src/**/*.{ts,tsx,css}"` | Format the sources                                                                                         |
| `format:check` | `prettier --check "src/**/*.{ts,tsx,css}"` | Check formatting without writing                                                                           |
| `postinstall`  | Copies the PDF.js worker to `public/`      | Runs after `npm ci`; run by hand after `--ignore-scripts`                                                  |

The standalone server needs `.next/static` and `public` next to it, as the [`Dockerfile`](../Dockerfile) arranges. To try the production image:

```bash
docker build -t netra-web .
docker run --rm -p 3000:3000 netra-web
```

The container serves only the dashboard; `/api` still has to be routed to the API on the same origin, which the deployment repository does with Caddy.

## Lint, format and typecheck

Run all three before pushing; CI runs the same commands and the build:

```bash
npm run lint && npm run typecheck && npm run format:check
```

| Tool       | Configuration                                                                                | Settings                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint 8   | [`.eslintrc.json`](../.eslintrc.json)                                                        | Extends `next/core-web-vitals` and `next/typescript`; turns off `@next/next/no-img-element`, `@typescript-eslint/no-unused-expressions` and `@typescript-eslint/no-non-null-assertion` |
| Prettier 3 | [`.prettierrc.json`](../.prettierrc.json), [`.prettierignore`](../.prettierignore)           | Single quotes, semicolons, print width 140, trailing commas everywhere; ignores `node_modules`, `.next` and the copied PDF.js worker                                                   |
| TypeScript | [`tsconfig.json`](../tsconfig.json)                                                          | `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, alias `@/*` for `src/*`                                                                                             |
| Tailwind   | [`tailwind.config.ts`](../tailwind.config.ts), [`postcss.config.mjs`](../postcss.config.mjs) | Scans `./src/**/*.{ts,tsx}`; PostCSS runs Tailwind and Autoprefixer                                                                                                                    |

- `noUncheckedIndexedAccess` types an indexed access as possibly `undefined`. The code uses `!` where the element is known to exist, which is why the non-null assertion rule is off.
- `prettier-plugin-tailwindcss` is a dev dependency, but `.prettierrc.json` has no `plugins` entry and Prettier 3 only loads listed plugins. Tailwind classes are therefore not sorted by `format`, `format:check`, the hook or CI.
- The scripts cover only `src/**/*.{ts,tsx,css}` and the hook only staged `*.{ts,tsx,css}` files; neither checks Markdown. Check the documentation by hand:

```bash
npx prettier --check "docs/**/*.md"
```

## Git hooks

[`lefthook.yml`](../lefthook.yml) defines the hooks; install them once per clone:

```bash
lefthook install
```

| Hook       | Command                                                | Runs when                         |
| ---------- | ------------------------------------------------------ | --------------------------------- |
| pre-commit | `npx prettier --check {staged_files}`                  | `*.{ts,tsx,css}` files are staged |
| pre-commit | `npx eslint {staged_files}`                            | `*.{ts,tsx}` files are staged     |
| pre-commit | `npx tsc --noEmit` (whole project)                     | `*.{ts,tsx}` files are staged     |
| commit-msg | `grep -qE` for a Conventional Commits line (see below) | Every commit                      |

The pre-commit commands run in parallel and only check; they never rewrite files. Fix formatting with `npm run format` and stage the result.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on a push to `main`, on a pushed tag matching `v*` and on every pull request. The workflow has `contents: read` and `packages: write` permissions.

| Job     | When                                     | Steps                                                                                                                                                                                       |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check` | Every trigger                            | Checkout; Node 20 with the npm cache; `npm ci`; `npm run format:check`; `npm run lint`; `npm run typecheck`; `npm run build`                                                                |
| `image` | Push events only, after `check` succeeds | Set up Buildx; log in to `ghcr.io` with `GITHUB_TOKEN`; compute tags with `docker/metadata-action`; build and push for `linux/amd64` and `linux/arm64`, with the GitHub Actions build cache |

The image is `ghcr.io/<repository owner>/netra-web`, tagged by these `docker/metadata-action` rules:

| Rule                              | Tag                                                   |
| --------------------------------- | ----------------------------------------------------- |
| `type=ref,event=branch`           | The branch name, `main`                               |
| `type=semver,pattern={{version}}` | The version of a release tag, `1.2.0` for `v1.2.0`    |
| `type=sha,format=short`           | The short commit SHA, with the action's `sha-` prefix |

Pull requests run `check` only and publish nothing.

## Commit convention

Commits follow Conventional Commits on one line, `type(scope): subject` or `type: subject`, with a short lower-case subject and no full stop:

```text
feat(map): show a recorded route without running a patrol
fix(docker): skip install scripts in the deps stage and ignore host node_modules
docs: grid view in the feature list
```

- The `commit-msg` hook accepts a message when one of its lines matches `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+`. A `!` before the colon marks a breaking change.
- Scopes used so far: `map`, `dashboard`, `shell`, `i18n`, `theme`, `robots`, `settings`, `pages`, `docker`, `brand`.
- The hook does not enforce a single line, and a few earlier commits have a body; one line is the convention.

## Recipes

### Add a page

1. Create `src/app/(dashboard)/<route>/page.tsx` with `'use client'` and a default export. Routes are English (`/floor-plans`, `/schedules`). Put page-only components in `_components/` and helpers in `_lib/` beside it; folders starting with `_` are not routes.
2. Build it from the [UI primitives](architecture.md#ui-primitives) and load data with `useAsync`. Add `revision` from `useLive()` to the deps when the data changes with live events.
3. Hide controls the role may not use with `useMe().can(...)`. The route itself is not guarded in the browser, so the API must refuse what the role may not do.
4. Add a navigation item to `SECTIONS` in [`AppShell.tsx`](../src/components/AppShell.tsx), with the path, a `nav.*` label key, an icon from [`icons.tsx`](../src/components/icons.tsx) (or a new one made with `base(d)`) and the permission that shows it.
5. Add every new string to both dictionaries, as in [Add a translation](#add-a-translation).
6. For a full-width wall page like the dashboard, add the path to `DENSE` in `AppShell.tsx`.
7. Run the checks and look at the page in both themes and both languages.

```tsx
'use client';

import { Button, Empty, ErrorNote, PageTitle, Panel } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useLive } from '@/lib/live';
import { useMe } from '@/lib/session';

export default function ExamplePage() {
  const { t } = useI18n();
  const { can } = useMe();
  const { revision } = useLive();
  const robots = useAsync(() => api.robots.list(), [revision]);

  return (
    <>
      <PageTitle
        title={t('example.title')}
        subtitle={t('example.subtitle')}
        actions={can('operate') && <Button variant="primary">{t('common.start')}</Button>}
      />
      <ErrorNote error={robots.error} />
      <Panel title={t('nav.example')}>
        {robots.data?.length ? robots.data.map((r) => <div key={r.id}>{r.name}</div>) : <Empty>{t('map.noRobots')}</Empty>}
      </Panel>
    </>
  );
}
```

The navigation item for it, in the right section of `SECTIONS`:

```tsx
{ href: '/example', label: 'nav.example', icon: IconReport, perm: 'view' },
```

### Add an API call

1. Type the response in [`src/lib/types.ts`](../src/lib/types.ts) with the field names the API sends (snake_case).
2. Add a function to the resource's group in `api` in [`src/lib/api.ts`](../src/lib/api.ts), and import the type there. Paths are relative to `/api/v1`: `request` adds the prefix, the bearer token, the JSON header and the error handling. Use `query(params, range)` for query strings and `withToken(path)` for URLs given to `<img>`, an SVG `<image>` or a link. Do not call `fetch` directly.
3. Read with `useAsync`; write in an async handler that catches the error and shows it with `ErrorNote`. `ApiError.status` tells statuses apart, as the login page does for 429.
4. If the API announces changes to the resource on the WebSocket, add the message to `LiveMessage` in `types.ts`, and add its type to the list in [`live.tsx`](../src/lib/live.tsx) that increases `revision` if pages should refetch.

With a placeholder resource, `widgets`:

```ts
// src/lib/types.ts
export interface Widget {
  id: number;
  robot_id: string;
  name: string;
  created_at: string;
}

// src/lib/api.ts, inside `api`
widgets: {
  list: (range: Range, robotId?: string) => request<Widget[]>(`/widgets${query({ robot_id: robotId }, range)}`),
  rename: (id: number, name: string) => request<void>(`/widgets/${id}`, json('PUT', { name })),
  imageUrl: (id: number) => withToken(`/widgets/${id}/image`),
},
```

```tsx
const widgets = useAsync(() => api.widgets.list(presetRange(preset)), [preset, revision]);
const [error, setError] = useState<string>();

const rename = async (id: number, name: string) => {
  setError(undefined);
  try {
    await api.widgets.rename(id, name);
    widgets.reload();
  } catch (e) {
    setError(e instanceof Error ? e.message : t('common.failed'));
  }
};
```

### Add a translation

1. Add the key to [`src/i18n/en.ts`](../src/i18n/en.ts) in the section of the page or feature. Use `{name}` placeholders for values.
2. Add the same path to [`src/i18n/id.ts`](../src/i18n/id.ts). `npm run typecheck` fails until both files have the same keys.
3. Use it with `t('section.key', { name })`. `t` only accepts existing keys, so a typo fails the type check.
4. For a value that comes from the API, such as a navigation state, add it under the matching section with the raw value as the key (`navState.BLOCKED`) and render it with `tx('navState', value)`. A missing entry shows the raw value with spaces for underscores.
5. A new built-in anomaly category also needs `category.<code>` in both files and the code in the built-in list of `useRules` in [`hooks.ts`](../src/lib/hooks.ts); other categories show the label of their rule.

```ts
// en.ts, robot section
lastSeen: 'Last seen {ago}',
// id.ts, robot section
lastSeen: 'Terakhir terlihat {ago}',
// in a component
t('robot.lastSeen', { ago: fmt.ago(robot.last_seen) });
```

### Check both themes and both languages

- Use the header switches (sun or moon, EN or ID); the login page has them too. Choices are stored per browser in `netra.theme` and `netra.locale`. Remove `netra.theme` to see the first-visit default, which follows `prefers-color-scheme`.
- Colour with the theme tokens: `ink-*` for surfaces, `slate-*` for text, `accent`, `ok`, `warn` and `danger`, with opacity modifiers as needed. Tailwind's fixed colours (`cyan-400`, `white`) and hex values do not change with the theme. In SVG, use `rgb(var(--accent))` and the like, or choose colours with `useTheme().theme`, or with `useMapDay()` inside a `FloorPlanView`.
- Indonesian strings are often longer: check truncation in the sidebar, badges, readouts, table headers and buttons.
- Check the dashboard at 1280 × 700 or more (the wall layout, which must fit without scrolling) and in a narrow window (drawer sidebar, stacked layout).
- Turn on reduced motion in the operating system: the robot pulse, inspection sweep and anomaly ripples should disappear.
