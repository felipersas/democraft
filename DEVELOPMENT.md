# Development guide

Quick reference for working on the Democraft monorepo.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- **Playwright browsers** (first time only): `pnpm exec playwright install chromium`

## First-time setup

```bash
pnpm install
pnpm build          # builds all workspace packages (tsup)
```

`pnpm build` is required once after install because workspace packages
(`@democraft/compiler`, `@democraft/schema`, …) resolve from `dist/`.
After editing a package's source, rebuild it (or let `pnpm typecheck`/`turbo`
do it automatically — turbo tracks dependencies).

## Day-to-day commands

All commands run from the repo root unless noted.

```bash
pnpm build          # build all packages (turbo)
pnpm typecheck      # typecheck all packages
pnpm test           # run all tests (vitest)
pnpm lint           # eslint
pnpm format         # prettier --check (use --write to fix)
```

To target a single package, use the pnpm filter:

```bash
pnpm --filter @democraft/studio typecheck
pnpm --filter @democraft/studio exec next build
pnpm --filter @democraft/cli test
pnpm --filter @democraft/remotion build
```

### Rebuilding a single package after source edits

Workspace packages compile to `dist/` via tsup. If you edit source under
`packages/*/src/`, rebuild that package for consumers to pick up the change:

```bash
pnpm --filter @democraft/remotion build      # most common (studio consumes it)
pnpm --filter @democraft/schema build
pnpm --filter @democraft/compiler build
```

`turbo` (used by `pnpm build` / `typecheck`) handles the dependency graph
automatically — running `pnpm typecheck` from the root rebuilds upstream
packages that changed before typechecking downstream ones.

## Running the studio

The studio is a Next.js app (`packages/studio/`) that previews and renders
captured demos. It's launched via the CLI.

### Full flow (with the demo-app example)

The demo-app is a small HTTP server that Playwright captures against. It must
be running for capture (but **not** for preview/editing after the first capture).

**Terminal 1 — start the target app:**

```bash
pnpm --filter @democraft/example-demo-app start
# → Demo app listening on http://localhost:4173
```

**Terminal 2 — launch the studio:**

```bash
pnpm exec democraft studio examples/demo-app/src/demo.ts
# → Studio ready at http://localhost:3000
```

The first run captures (Playwright navigates the app on :4173). Subsequent
runs **reuse the cached capture** and open instantly without Playwright.

Useful flags:

```bash
--port 3210        # change the studio port (default 3000)
--no-capture       # force-skip capture; error if none exists (default: reuse if exists)
--headless         # run Playwright headless (default: headed)
--fps 30           # override timeline fps (default 60)
```

### Capture-only (without the studio)

```bash
pnpm exec democraft capture examples/demo-app/src/demo.ts
```

This starts the demo app, runs Playwright, and writes the manifest +
screenshots + recording to `examples/demo-app/.democraft/runs/`.

### Studio-only (reuse existing capture, no app needed)

Once a capture exists at `.democraft/runs/<demoId>/`, the studio opens and
works fully (preview, edit, render) without the target app running:

```bash
pnpm exec democraft studio examples/demo-app/src/demo.ts --no-capture
```

## Studio data layout

```
.democraft/
  runs/<demoId>/              raw Playwright capture (manifest, screenshots, recording, trace)
  studio-data/                materialized data the studio reads at runtime
    manifest.json             captured steps, URLs, bounding boxes
    timeline.json             resolved render timeline (camera/cursor/overlays)
    meta.json                 demo path, capture dir, staleness info
    screenshots/              PNGs served to the preview player
    recording.webm            screen recording served to the preview player
```

The studio's data dir is overridable via `DEMOCRAFT_STUDIO_DATA` env var.

## In-studio features

| Feature              | How                                                                          |
| -------------------- | ---------------------------------------------------------------------------- |
| **Re-capture**       | Header button (camera icon) — re-runs Playwright against the running app     |
| **Re-resolve**       | Automatic on `demo.ts` save, or `POST /api/resolve`                          |
| **Layer visibility** | Eye icon next to Camera/Cursor/Overlays in the timeline (shift-click = solo) |
| **Caption editor**   | Inspector panel (right side) — edits are live in the preview                 |
| **Audio tracks**     | Audio panel (right side) — add/edit/remove background music, narration, SFX  |
| **Audio mute**       | Volume icon in the transport — silences the preview only                     |
| **Render queue**     | Render panel (right side) — "Add to queue" with progress + ETA + cancel      |
| **Render range**     | "Range" button in the timeline → drag In/Out handles on the ruler            |
| **Command palette**  | `Cmd+K`                                                                      |
| **Shortcuts**        | `?`                                                                          |

## Keyboard shortcuts

| Key                   | Action                       |
| --------------------- | ---------------------------- |
| `Space`               | Play / pause                 |
| `←` / `→`             | Previous / next frame        |
| `Shift+←` / `Shift+→` | Jump 10 frames               |
| `Home` / `End`        | Go to start / end            |
| `+` / `−` / `0`       | Zoom timeline in / out / fit |
| `⌘+scroll`            | Zoom timeline                |
| `⌘K`                  | Command palette              |
| `?`                   | Shortcuts overlay            |

## CLI reference

```bash
pnpm exec democraft <command> [demo.ts] [flags]
```

| Command                                  | Description                                       |
| ---------------------------------------- | ------------------------------------------------- |
| `inspect <demo.ts>`                      | Compile + print the IR (targets, scenes, steps)   |
| `validate [demo.ts]`                     | Compile and report validation diagnostics         |
| `targets <demo.ts> --json`               | List resolved targets                             |
| `capture [demo.ts]`                      | Capture the demo with Playwright                  |
| `timeline [demo.ts] --manifest <m.json>` | Resolve a timeline from a capture manifest        |
| `preview --manifest <m> --timeline <t>`  | Generate a standalone HTML preview from artifacts |
| `render [demo.ts] -o <video.mp4>`        | Capture, resolve, and render in one command       |
| `studio [demo.ts]`                       | Capture or reuse data and launch the Studio       |

Run `pnpm exec democraft help` or `pnpm exec democraft <command> --help` for
the complete option list. Artifact flags remain available for CI and debugging.

## Architecture overview

```
demo.ts ─compile─> DemoIR ─runDemo (Playwright)─> manifest + screenshots + recording
                      │                                     │
                      │   resolveTimeline (pure fn)         │
                      └──── materialize ────────────────> studio-data/
                                                            │
                                                  Next.js studio (preview + render)
```

- **Authoring** stays in TypeScript (`demo.ts` + `targets.ts`). The studio is
  for preview/render, not authoring.
- **Capture** (Playwright) is separated from **preview** (pure disk). The
  studio works fully from cached files; the app is only needed for capture.
- **Packages**: `core` (authoring API), `compiler` (IR), `schema` (shared
  types), `playwright` (capture runtime), `timeline` (resolver), `remotion`
  (renderer), `studio` (Next.js UI), `cli` (commands), `preview` (HTML).

## Code intelligence (codegraph)

The repo is indexed with [codegraph](https://github.com/colbymchenry/codegraph).
Use it for symbol lookups and call-graph traversal:

```bash
codegraph node <symbol>      # source + caller/callee trail
codegraph callers <symbol>   # who calls this
codegraph query "<search>"   # fuzzy symbol search
codegraph sync               # re-index after structural changes
```
