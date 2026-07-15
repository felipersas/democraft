# Philosophy

The codebase embodies three tenets. This doc quotes the real exports that prove each one. For the original rationale see `../spec/02-design-principles.md` and `../spec/03-single-api-and-code-vs-json.md`.

## 1. One authoring API

> Authors — humans and LLMs alike — write TypeScript. JSON is internal.

Proof:

- `packages/core/src/index.ts` re-exports exactly four authoring helpers: `defineDemo` (from `define.ts:7`), `defineConfig` (`define.ts:3`), `defineTargets` (`targets.ts:8`), and the locator builders `byRole`/`byLabel`/`byTestId`/`byText` (`locators.ts:3, 7, 11, 15`). There is no `defineDemoFromJson`, no `loadIR`, no public surface for hand-authoring IR.
- The `DemoDefinition.run` callback (`packages/core/src/types.ts:110-119`) receives a `DemoCapture` whose only method is `scene(id, run)`. Inside the scene, the author calls imperative methods on `DemoScene` (`packages/core/src/types.ts:69-96`: `goto`, `click`, `fill`, `caption`, `focus`, ...). There is no declarative AST that the author assembles by hand.
- The compiler's `compileDemo` (`packages/compiler/src/compile.ts:8`) is the only producer of `DemoIR`. It runs the author's `run({ demo })` against a stub `demo` object that records each call. The author cannot construct a `DemoIR` literal and hand it to the framework.

The IR exists, but it is a compiler product — see the next tenet.

## 2. Code-first, IR-serializable

> The authoring API is TypeScript; everything that crosses a process or disk boundary is JSON.

Proof:

- `packages/schema/src/` declares `DemoIR` (`scenes.ts:27`), `RecordedDemoManifest` (`recorded.ts:31`), and `RenderTimeline` (`timeline.ts:72`). Each is a plain JSON object type with `schemaVersion: "1"`. There are no class instances, no functions, no Symbols — the shapes are `JSON.stringify`-safe by construction.
- `packages/compiler/src/compile.ts:54-63` literally builds the IR as a plain object literal. The compiler is a one-way function from `DemoDefinition` (typed, may contain a closure) to `DemoIR` (JSON-safe).
- `packages/schema/src/schemas.ts` exports Zod schemas for the input side — `locatorSchema` (line 5), `targetDefinitionSchema` (line 16), `diagnosticSchema` (line 28). The schema package is the canonical contract for what the IR looks like — `../spec/13-system-architecture.md` calls this the "portable contract."
- The CLI persists IR-adjacent artifacts at three points: `manifest.json` is written by `runDemoWithBindings` (`packages/playwright/src/runner.ts:100`), the timeline JSON is written by the CLI's `timeline` command (`packages/cli/src/run.ts:195`), and the rendered MP4 is written by `renderMedia` inside `renderDemoVideo` (`packages/remotion/src/index.ts:56`). The compiler's IR itself is not persisted today, but the JSON shape is what makes that a trivial future addition.

Concretely: humans and LLMs author the same small TypeScript API. The compiler turns it into portable JSON-compatible internal artifacts for capture, timeline resolution, Studio, and rendering. A public `demo.ir.json` authoring entry point does not exist today.

## 3. Capture is the truth, render is the staging

> Playwright records what actually happened; Remotion stages it. The manifest is the handoff.

Proof:

- The Playwright runner produces one `RecordedStep` per IR step (`packages/playwright/src/execute.ts:23`). Each carries `startedAtMs`/`endedAtMs`, the resolved `TargetSnapshot` (including `boundingBox`), and the final URL. The bounding box is **measured in the real DOM**, not derived from the author's declared framing — see `resolveTarget` at `packages/playwright/src/locator.ts:4`.
- `resolveTimeline` (`packages/timeline/src/resolve.ts:13`) is the handoff. It takes the IR (the plan) and the manifest (the truth) and folds them together. `stepDurationMs` (line 135) takes `max(plannedMs, actualMs)`: the planned duration is the floor; the recorded duration is honored when the page took longer. A click that took 200ms in real life still gets the planned 650ms; a navigation that took 2s extends the timeline.
- Camera tracks (`packages/schema/src/timeline.ts:22-31`) carry the recorded `boundingBox` so the renderer can frame what was actually on screen, not what the author intended to be on screen. `cameraTarget` (`packages/remotion/src/camera.ts:60`) reads `track.boundingBox` to compute focus; if the bounding box is missing the camera falls back to identity.
- Cursor tracks (`packages/schema/src/timeline.ts:33-45`) carry the recorded `point` — the center of the actual clicked element (`packages/timeline/src/resolve.ts:186`). If the click target was off-screen or unresolved, no cursor is rendered.

This split is also why artifact-mode `democraft preview` and `democraft render` only need `manifest.json` + `timeline.json`. Once the truth is captured, the renderer never needs to ask the browser another question. The high-level `democraft render demo.ts -o demo.mp4` command orchestrates capture, resolution, and rendering for convenience; passing both artifacts reuses the existing capture.
