# @democraft/studio

Local Next.js app that previews and renders Democraft compositions. The CLI's `studio` command launches this server with demo data already prepared.

## Run via CLI

```bash
pnpm --filter @democraft/cli exec tsx src/index.ts studio ../../examples/basic-demo/src/demo.ts
```

The CLI:
1. Compiles the demo (`compileDemo`)
2. Captures via Playwright (`runDemo`)
3. Resolves the timeline (`resolveTimeline`)
4. Writes `manifest.json`, `timeline.json`, screenshots, and any recording to `.democraft/studio-data/`
5. Launches `pnpm --filter @democraft/studio dev` with `DEMOCRAFT_STUDIO_DATA` pointing at the data dir

## Run standalone

```bash
pnpm --filter @democraft/studio dev
```

The server reads from `../.democraft/studio-data/` by default. Override with the `DEMOCRAFT_STUDIO_DATA` env var.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `space` | Play / pause |
| `←` / `→` | Step one frame (hold `shift` for 10) |
| `home` / `end` | Jump to start / end |

## Architecture

- `app/page.tsx` + `components/StudioShell.tsx` — three-pane UI (tracks · player · render)
- `components/PlayerPane.tsx` — wraps `@remotion/player` around `ProductDemoVideo` from `@democraft/remotion`
- `app/api/data/route.ts` — serves manifest + timeline JSON
- `app/api/render/route.ts` — invokes `renderDemoVideo` from `@democraft/remotion`
- `app/api/events/route.ts` — SSE stream for live reload and render progress
- `lib/event-bus.ts` — in-memory pub/sub that connects API routes and the file watcher
- `lib/file-watcher.ts` — watches the data dir for changes, triggers live reload

## License

MIT — uses only MIT-licensed Remotion packages (`remotion`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`). No dependency on Remotion Studio.
