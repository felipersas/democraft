# @democraft/studio

Packaged Next.js runtime that previews and renders Democraft compositions. It
is an implementation dependency of `@democraft/cli`; applications normally do
not install or launch this package directly.

## Run via CLI

```bash
npx democraft studio demo.ts
```

The CLI:

1. Compiles the demo (`compileDemo`)
2. Captures via Playwright (`runDemo`)
3. Resolves the timeline (`resolveTimeline`)
4. Writes `manifest.json`, `timeline.json`, screenshots, and any recording to `.democraft/studio-data/`
5. Resolves this package and its Next.js binary through Node module resolution
6. Launches the packaged production server with `DEMOCRAFT_STUDIO_DATA` pointing at the data directory

No workspace filter or package-manager subprocess is used at runtime.

## Contributor development

```bash
pnpm --filter @democraft/studio dev
```

This source-only command is for contributors. Normal users should launch the
Studio through `democraft studio`, which supplies the authenticated session and
authorized workspace paths.

## Keyboard shortcuts

| Key            | Action                               |
| -------------- | ------------------------------------ |
| `space`        | Play / pause                         |
| `←` / `→`      | Step one frame (hold `shift` for 10) |
| `home` / `end` | Jump to start / end                  |

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
