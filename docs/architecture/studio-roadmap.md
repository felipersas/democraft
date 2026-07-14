# Studio roadmap

Ideas for evolving `packages/studio/` past the Phase 1 MVP. Each item is sized roughly — `S` (≤half day), `M` (1–2 days), `L` (week+). Items marked 🅿️ are from the original plan's Phase 2/3 scope; the rest are new.

## Timeline

The current timeline (`components/TimelineTrack.tsx`) shows three rows — camera, cursor, overlays — as colored bars with click-to-seek. It works but reads as a list, not as an editor.

- **Frame ruler with timecode ticks** at the top of the timeline panel. Tick density adapts to zoom. 🅿️ `S`
- **Zoom in/out** on the timeline (cmd+scroll, +/- keys). At zoomed-out levels, aggregate tracks; at zoomed-in levels, show per-step bars. 🅿️ `M`
- **Per-step rows instead of per-kind.** Today the rows are `camera / cursor / overlays`. Editor-style would be one row per step in the timeline (goto, click, focus, caption, …), grouped by scene. Click a step to seek to its first frame; hover shows metadata (target id, caption text, bounding box). `M`
- **Visual track content**, not just bars:
  - Camera row shows the focus point moving across a mini-map of the stage between keyframes
  - Cursor row shows a dot at the click position with a ripple
  - Overlay rows render a tiny preview of the caption/callout text
  `L`
- **In/out markers** for render range. Drag the handles to restrict the render to a sub-range. `M`
- **Hover preview tooltip** with frame number + timecode + a thumbnail of the frame (rendered on demand via `<Player seekTo>`). `M`
- **Layer visibility toggles** — mute the camera, hide the cursor, etc. — per layer. Useful for inspecting one layer at a time. 🅿️ `S`
- **Solo layer** — shift-click a layer's visibility to hide everything else. `S`

## Player pane

- **Zoom and pan the preview** independently of the timeline. Useful for inspecting cursor/camera alignment at high zoom. 🅿️ `M`
- **Checkerboard background toggle** to see transparency in the stage chrome. `S`
- **Safe-area overlay** (90% / title-safe) for broadcasts. `S`
- **Guides/rulers** — toggleable crosshair at the playhead that overlays the preview. `S`
- **Frame thumbnail strip** below the player — sample frames at intervals, click to seek. Powerful but expensive; do last. `L`
- **Mute / volume** if/when we add audio support. `S`
- **Playback rate** dropdown (0.25×, 0.5×, 1×, 2×). `S`
- **Full-screen preview** (press `F`). `S`

## Inspector / editing

This is Phase 2 territory. Today the right pane has just the render panel.

- **Props inspector** 🅿️ `M` — show the current caption text, callout titles, camera padding, etc. Edit them and have the player update instantly. Edits are ephemeral (a "Reset" button restores the captured values). Stretch: write the edited values back to `demo.ts` (would require AST manipulation — flag as `L`).
- **Layer panel** 🅿️ — list of every layer (backdrop, stage, cursor, each overlay) with visibility, solo, lock toggles. Like Figma's layers panel. `M`
- **Inline caption editor** — click a caption in the preview, edit its text in place. `L`
- **Visual UV drag controls** 🅿️ — drag the camera focus point on the preview; Remotion Studio-style. Maps cursor/focus positions back to the timeline. `L`

## Render

- **Render queue** 🅿️ — queue multiple renders with status (pending, rendering, done, failed). Each entry shows scale, CRF, duration, and links to the output file. `M`
- **Render presets** — save combinations of (scale, CRF, dimensions) as named presets like "Quick preview" (1×, CRF 20) and "Final" (2×, CRF 12). `S`
- **Live render progress with ETA** — currently we send two SSE events (start + done). Hook Remotion's `onProgress` to push frame count + percent + ETA. `M`
- **Cancel render** button — kills the in-flight `renderMedia` call. `S`
- **Multi-format output** — GIF, WebM, PNG sequence, WebP. Remotion already supports these via `codec` and `imageFormat`. `M`
- **Render range** — combine with in/out markers from the timeline to render only a sub-range. `M`
- **Preview thumbnail** in the render queue — first frame of the output as a tiny image. `S`

## Workflow / DX

- **Auto-reload on `demo.ts` change** — watch the demo file, re-compile + re-capture automatically when it changes. Risky (capture is slow); maybe just re-resolve the timeline without re-capture. `L`
- **Live edits without re-capture** — when only the timeline resolution changes (caption text, pacing), the studio can re-resolve in place without Playwright. The CLI's `studio` command should expose a "skip capture if manifest exists" flag (we have `--no-capture`; make it the default after first capture). `S`
- **Command palette (Cmd+K)** — fuzzy search across commands: play, pause, render, seek to scene, etc. `M`
- **Keyboard shortcuts overlay** (`?` to open) showing all bindings. `S`
- **Settings panel** — default render options, theme, playback rate, loop default. Persisted to localStorage. `S`
- **Theme toggle** — light/dark, matching the composition's existing dark theme by default. `S`
- **Open output folder** button in the render-done toast. `S`

## Architecture / engineering

- **WebSocket instead of SSE** — two-way comms enables cancel-render, live edits from server, etc. SSE is fine for one-way. `M`
- **Server-side frame rendering for scrubbing** — at high zoom, scrubbing can lag. Server can pre-render frames via `@remotion/renderer`'s `renderFrame` and stream them as thumbnails. Big perf win, complex. `L`
- **Caching of rendered frames** — once rendered, cache frames on disk so the next render with the same input is instant. Hash inputProps + composition to key. `M`
- **Hot reload composition changes** — when `composition.ts` is edited, the studio's Player should reflect changes without manual browser refresh. Tricky because Remotion Player expects the component to be stable; doable with React keys. `M`
- **Playwright tests for the studio UI** — capture a known demo, click Render, assert MP4 exists. Smoke tests for now. `M`
- **Visual regression tests** for the player pane (Percy, Chromatic, or Playwright traces). `L`
- **Performance budget** — track player pane frame rate during scrub; warn if it drops below 30 fps. `S`

## Out of scope (intentionally)

These show up in similar tools (Remotion Studio, video editors) but don't fit the framework's code-first philosophy:

- **Visual editor for `demo.ts` source.** Authoring stays in TypeScript. The studio is for preview/render, not authoring.
- **Timeline retiming / reordering by drag.** Would imply writing changes back to `demo.ts` — high effort, drift risk. Re-capture instead.
- **Multi-user collab** (CRDT, presence). Out of scope for a local dev tool.
- **Hosted studio as a service.** Could be a future business, not now.

## Suggested next phase

After Phase 1 ship, the highest-leverage improvements are probably:

1. **Frame ruler + zoom** (timeline) — makes the timeline feel like an editor instead of a list.
2. **Render progress with `onProgress`** — the current two-event SSE feels broken.
3. **Layer visibility + solo** — cheap to build, huge for debugging individual tracks.
4. **Render queue** — lets the user kick off multiple jobs without blocking the studio.
5. **Inspector for caption text** — most-edited property; immediate value for tweaking copy.

Together that's roughly 5–7 days of focused work, and it would transform the studio from "preview" to "editor-lite".
