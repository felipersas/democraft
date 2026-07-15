# Pipeline

This document walks the end-to-end pipeline from an authored `demo.ts` to a rendered MP4. The recommended interface is one command:

```bash
democraft render demo.ts -o demo.mp4
```

The individual stages below remain public for CI, debugging, and artifact reuse. For the original design narrative see `../spec/15-end-to-end-example.md`; this doc describes what the code does today.

## Stages at a glance

```text
demo.ts
  │  (authored with @democraft/core)
  ▼
compileDemo  ─────────────────────►  DemoIR (in-memory)
  │  packages/compiler/src/compile.ts:8
  ▼
runDemo  ─────────────────────────►  .democraft/runs/<id>/manifest.json
  │  packages/playwright/src/runner.ts:14      + screenshots/, trace.zip, video
  ▼
resolveTimeline  ─────────────────►  .democraft/timelines/<id>.json
  │  packages/timeline/src/resolve.ts:13
  ▼
renderDemoVideo  ─────────────────►  .democraft/renders/<id>.mp4
  │  packages/remotion/src/index.ts:26
  ▼
MP4
```

Two side outputs exist alongside this main flow:

- `democraft inspect` prints the `DemoIR` human-readable form via `inspectIR` (`packages/compiler/src/inspect.ts:3`).
- `democraft preview` writes a standalone HTML preview via `renderPreviewHtml` (`packages/preview/src/template.ts:4`) — a fast browser-based approximation of the rendered MP4.

## Stage 1 — Author

You write a TypeScript module whose default export is a `DemoDefinition`. The only authoring API is `@democraft/core`:

```ts
import { byTestId, defineDemo, defineTargets } from "@democraft/core";

export default defineDemo({
  id: "create-project",
  title: "Create a project",
  source: { baseUrl: "http://localhost:3000", initialPath: "/dashboard" },
  targets: defineTargets({
    dashboard: byTestId("dashboard"),
  }),
  async run({ demo }) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
      await scene.expectVisible("dashboard");
    });
  },
});
```

`defineDemo` (`packages/core/src/define.ts:7`) and `defineTargets` (`packages/core/src/targets.ts:8`) are identity helpers — they exist for type inference. The `scene()` method on `demo` accepts an optional metadata object (`purpose`, `pacing`, `importance`) as its second argument.

## Stage 2 — Compile (`compileDemo`)

`compileDemo(definition)` in `packages/compiler/src/compile.ts:8` does three things in sequence:

1. **Capture.** It builds a stub `demo` object (line 14) whose `scene()` method invokes the author's run callback with a `DemoScene` proxy from `createSceneCapture` (`packages/compiler/src/capture.ts:3`). Each proxy method pushes a `CapturedStep` onto an array — no browser is touched.
2. **Normalize.** `normalizeScene`/`normalizeStep` slug-generate step ids when the author didn't supply one, parse durations like `"1.5s"` via `parseDurationMs`, and emit `DC102` diagnostics for unparseable durations.
3. **Validate.** `validateIR(ir)` runs the static checks — required fields (`DC001`), duplicate scene/step ids (`DC002`), references to undeclared targets (`DC101`), and invalid target/visual data (`DC106`–`DC108`).

The result is a `{ ir, diagnostics }` tuple (typed as `CompilationResult` from `packages/compiler/src/types.ts`). The IR is JSON-serializable but is not written to disk by the compiler; downstream stages either hold it in memory or re-derive it.

### CLI: `inspect` and `validate`

```bash
democraft inspect ./demos/create-project/demo.ts
democraft inspect ./demos/create-project/demo.ts --json
democraft validate ./demos/create-project/demo.ts --json
```

`validate` exits with code 1 if any diagnostic has severity `error`. Validation compiles the TypeScript demo; the legacy `--static` flag is accepted but no longer required.

## Stage 3 — Capture (`runDemo`)

```bash
democraft capture ./demos/create-project/demo.ts \
  --output-dir .democraft/runs/create-project
```

The CLI re-runs `compileDemo` (`packages/cli/src/run.ts:134`), refuses to proceed if any error-severity diagnostic is present (`packages/cli/src/run.ts:202`), then calls `runDemo(ir, { outputDir, headless })` from `packages/playwright/src/runner.ts:14`.

`runDemo` delegates to `runDemoWithBindings(ir, defaultBindings, options)` (line 21). `defaultBindings` lives in `packages/playwright/src/bindings.ts:4` and is the single place the real `playwright` import lives. `runDemoWithBindings`:

1. Launches Chromium (headless by default) with the configured viewport (1440x900 default), locale, timezone, and optional storage state.
2. Starts a Playwright trace (`context.tracing.start`, line 49) so failures can be replayed.
3. Walks every scene and step in order, calling `executeStep` (`packages/playwright/src/execute.ts:23`) which dispatches on `step.kind`. For `browser.click`/`fill`/`select`, `assert.*`, `camera.*`, and `overlay.callout` it first calls `resolveTarget` (`packages/playwright/src/locator.ts:4`) — which tries each declared `Locator` in order and records every attempt on the snapshot.
4. After each step, `captureStepHoldMs` (line 208) makes Playwright wait the planned duration so the screenshot matches the timeline window the renderer will assume.
5. Takes a `fullPage` screenshot per step into `screenshots/<sceneId>-<stepId>.png` (line 190).
6. Stops the trace into `trace.zip`, closes the context, and writes `manifest.json` containing the `RecordedDemoManifest` (line 84).

The manifest's `steps` array is the ground truth for everything that follows. Each `RecordedStep` carries `startedAtMs`/`endedAtMs`, the resolved `TargetSnapshot` (including `boundingBox`), and the final URL. The manifest also embeds runtime diagnostics such as `DC201` for an unresolved target.

## Stage 4 — Resolve timeline (`resolveTimeline`)

```bash
democraft timeline ./demos/create-project/demo.ts \
  --manifest .democraft/runs/create-project/manifest.json \
  --output .democraft/timelines/create-project.landscape.json \
  --fps 60
```

`resolveTimeline(ir, manifest, { fps })` in `packages/timeline/src/resolve.ts:13` walks the IR scenes in order, maintaining a `cursorFrame` counter. For each step:

- It computes `durationInFrames = msToFrames(stepDurationMs(step, recordedStep), fps)`.
- `stepDurationMs` (line 135) takes `max(plannedMs, actualMs)`, so a slow page load extends the timeline but a fast click still respects the minimum animation window (e.g. 1100ms for `camera.focus`, 650ms for `browser.click`). The full planned-duration table lives in `plannedStepDurationMs` (line 141).
- It pushes a `RenderStep` onto the current scene, then `collectTracks` (line 69) appends additional tracks to `timeline.camera`, `timeline.cursor`, or `timeline.overlays` depending on `step.kind`. The cursor track's `point` is the center of the recorded bounding box (line 186). Camera tracks carry the recorded `boundingBox` so the renderer can compute focus.
- `cursorFrame += durationInFrames` advances the timeline.

Output: a single `RenderTimeline` JSON object with `durationInFrames`, `scenes`, `camera`, `cursor`, `overlays`. `inspectTimeline` (`packages/timeline/src/inspect.ts:3`) is the pretty-printer for `--json`-less invocations.

## Stage 5a — Preview (HTML)

```bash
democraft preview \
  --manifest .democraft/runs/create-project/manifest.json \
  --timeline .democraft/timelines/create-project.landscape.json \
  --output .democraft/previews/create-project.html
```

This skips compilation entirely (`packages/cli/src/run.ts:59`) — it just reads the two JSON files and calls `renderPreviewHtml`. The output is a self-contained HTML document that plays back frames on `requestAnimationFrame`, swapping `<img>` sources per step and overlaying target boxes, the cursor, captions, and callouts scaled to the recording dimensions. Use this for fast iteration without spinning up Remotion.

## Stage 5b — Render (MP4)

```bash
democraft render \
  --manifest .democraft/runs/create-project/manifest.json \
  --timeline .democraft/timelines/create-project.landscape.json \
  --output .democraft/renders/create-project.mp4 \
  --scale 1 --crf 15
```

The CLI calls `renderDemoVideo` (`packages/cli/src/run.ts:110`) with the manifest, timeline, screenshot data URLs (read from disk and base64-encoded by `buildScreenshotDataUrls` at `packages/cli/src/loaders.ts:37`), and the optional recording file. `renderDemoVideo` (`packages/remotion/src/index.ts:26`):

1. Builds a temporary `publicDir` and copies the `.webm` recording into it as `recording.webm` (line 56) so Remotion's `staticFile` can serve it.
2. Bundles `entry.ts` via `@remotion/bundler` (line 38).
3. Calls `selectComposition` with `id: compositionId` (`"MotionDemo"`) and the input props (line 42).
4. Calls `renderMedia` with `codec: "h264"`, `crf: options.crf ?? 15`, `jpegQuality: 100`, and `scale: options.scale ?? 1` (line 49).
5. Cleans up the temp dir in a `finally`.

See `remotion-integration.md` for what happens inside the composition.

## Putting it all together

A normal end-to-end run looks like:

```bash
# Have the target app running first.
democraft validate ./demos/create-project/demo.ts
democraft render ./demos/create-project/demo.ts -o demo.mp4
```

The equivalent artifact-oriented flow is:

```bash
# 0. Have your app running on http://localhost:3000
democraft validate ./demos/create-project/demo.ts
democraft capture  ./demos/create-project/demo.ts \
  --output-dir .democraft/runs/create-project
democraft timeline ./demos/create-project/demo.ts \
  --manifest .democraft/runs/create-project/manifest.json \
  --output .democraft/timelines/create-project.landscape.json
democraft preview \
  --manifest .democraft/runs/create-project/manifest.json \
  --timeline .democraft/timelines/create-project.landscape.json
democraft render \
  --manifest .democraft/runs/create-project/manifest.json \
  --timeline .democraft/timelines/create-project.landscape.json \
  --output .democraft/renders/create-project.mp4
```

When `preview` or `render` receives both `--manifest` and `--timeline`, it only reads those artifacts and never touches the browser. Without artifact flags, `render demo.ts` performs capture and timeline resolution automatically.
