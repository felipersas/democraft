# Democraft Studio

A local Next.js app that previews and renders Democraft compositions. Replaces the deprecated static HTML preview (`packages/preview/`).

Built with **only MIT-licensed Remotion packages** — `remotion`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`. No dependency on Remotion Studio.

## Quick start

```bash
pnpm --filter @democraft/cli exec tsx src/index.ts studio examples/basic-demo/src/demo.ts
```

The CLI:
1. Compiles the demo (`compileDemo`)
2. Captures via Playwright (`runDemo`)
3. Resolves the timeline (`resolveTimeline`)
4. Materializes data into `.democraft/studio-data/` (manifest, timeline, screenshots, recording)
5. Generates an ephemeral session token and launches `pnpm --filter @democraft/studio dev` bound to `127.0.0.1`, with the data dir and token passed only through the child environment
6. Opens at `http://127.0.0.1:3000`

The Studio intentionally does not listen on LAN interfaces: both the package
`dev`/`start` scripts and the CLI bind `127.0.0.1`. Every API operation
with side effects requires both an exact same-origin `Origin` and the ephemeral
session token. The browser obtains that token through a same-origin endpoint and
sends it in a request header; it is never placed in the Studio URL or CLI output.
`localhost` and `::1` remain valid loopback origins for request validation, but
the CLI uses the explicit IPv4 loopback address for deterministic binding.

Studio compilation is process-isolated. Staleness checks, re-resolve and
re-capture compile the authorized demo in a short-lived child process, so edits
to transitive ESM imports are visible without retaining their module cache in
the long-lived Next.js server.

## Workflow

Edit `demo.ts` → run `democraft studio` (or re-run `democraft capture` while studio is running) → the studio auto-reloads via SSE. Tweak transport, scrub the timeline, click **Render MP4** to produce a video file. The render uses the same `renderDemoVideo` pipeline as the headless `democraft render` command.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `space` | Play / pause |
| `←` / `→` | Step one frame (hold `shift` for 10) |
| `shift + ←` / `shift + →` | Jump 10 frames |
| `home` / `end` | Jump to start / end |

## Architecture

The studio is a Next.js 15 app in `packages/studio/`. Three-pane layout: track list on the left, player in the center, render controls on the right. Transport bar at the bottom.

### Data flow

```
.democraft/studio-data/
├── manifest.json
├── timeline.json
├── screenshots/{sceneId}-{stepId}.png
└── recording.webm         (optional)
         ↓
packages/studio/app/api/data/route.ts        (GET → JSON)
packages/studio/app/data/[...path]/route.ts  (serves files)
         ↓
components/PlayerPane.tsx
  <Player component={ProductDemoVideo} inputProps={...} />
```

### Render flow

```
components/RenderPanel.tsx → POST /api/render
                                ↓
app/api/render/route.ts
  renderDemoVideo({ manifest, timeline, screenshotSrcByStepId, recordingFile, ... })
                                ↓
.democraft/renders/{demoId}-{ts}.mp4
```

Render progress streams back via SSE on `/api/events`.

### Live reload

`lib/file-watcher.ts` watches `.democraft/studio-data/` for changes. When the user re-runs `democraft capture` in another terminal, the watcher fires `publishReload()` → the browser's `EventSource` receives a `reload` event → the studio context re-fetches manifest + timeline without losing player state.

### Pieces

| Path | Purpose |
|---|---|
| `app/layout.tsx` | Root layout + `StudioProvider` + starts file watcher |
| `app/page.tsx` + `components/StudioShell.tsx` | Three-pane UI + keyboard shortcuts |
| `components/PlayerPane.tsx` | Wraps `@remotion/player` around `ProductDemoVideo` from `@democraft/remotion/client` |
| `components/Transport.tsx` | Play / pause / step / loop |
| `components/TimelineTrack.tsx` | Camera / cursor / overlay track rows + click-to-seek |
| `components/RenderPanel.tsx` | Scale + CRF sliders, render button, progress modal |
| `app/api/data/route.ts` | Returns `{ manifest, timeline, screenshotBaseUrl, recordingSrc }` |
| `app/api/render/route.ts` | Invokes `renderDemoVideo` from `@democraft/remotion` |
| `app/api/events/route.ts` | SSE stream |
| `lib/event-bus.ts` | In-memory pub/sub connecting API routes and file watcher |
| `lib/studio-context.tsx` | React context: status, playerRef, render state, loop |

### Why a separate `client` entry on `@democraft/remotion`

The composition (`composition.ts`) is client-safe — pure React. The renderer (`index.ts`) imports `@remotion/bundler` and `@remotion/renderer`, which pull in Node-only deps (esbuild, webpack). Splitting the entries lets Next.js bundle the client side without dragging Node modules into the browser.

Import from the right place:

- `import { ProductDemoVideo } from "@democraft/remotion/client"` — browser
- `import { renderDemoVideo } from "@democraft/remotion"` — Node (API routes, CLI)

## Configuration

The studio reads from `.democraft/studio-data/` by default. Override with the `DEMOCRAFT_STUDIO_DATA` env var (set automatically by the `democraft studio` CLI command). Direct `pnpm --filter @democraft/studio dev` launches remain bound to `127.0.0.1`, but do not configure mutation access; use the CLI so it can create the per-process `DEMOCRAFT_STUDIO_SESSION_TOKEN` securely.

## Why not Remotion Studio?

Remotion Studio ships under a custom Company License (not MIT) — free for individuals and small orgs, paid for larger for-profits. The democraft framework stays MIT-only. Building our own studio with `@remotion/player` (MIT) gives us full control of the UX without license concerns.

What we get from `@remotion/player`:
- Frame-accurate preview
- Same React rendering pipeline as the final MP4
- The composition we already wrote — no duplication

What we build ourselves:
- Transport UI
- Timeline track visualization
- Render panel
- Props inspector (Phase 2)
- Visual drag controls (Phase 3)

## Troubleshooting

**`Studio data unavailable` in the browser** — Run `democraft studio <demo.ts>` from the workspace root. The CLI populates `.democraft/studio-data/`. If you launched the studio directly (`pnpm --filter @democraft/studio dev`) without running the CLI, no data exists.

**Port 3000 already in use** — `democraft studio <demo.ts> --port 3001`.

**Mutation returns 401/403/503** — Open the exact loopback URL printed by the
CLI. A `401` indicates a missing/stale session token, `403` an invalid target or
Origin, and `503` that the Studio was started directly without CLI session
configuration.

**Render fails with bundler error** — Check that `@democraft/remotion` is built (`pnpm --filter @democraft/remotion build`). The render API imports from its `dist/`.

**Live reload doesn't fire** — The file watcher only starts if `.democraft/studio-data/` exists when the studio boots. Re-run `democraft studio` after the first capture.
