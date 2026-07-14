# Patterns

This doc catalogs the recurring code patterns the codebase uses, with file:line citations so you can see each one in place. It is a companion to `../spec/02-design-principles.md`, which describes the design intent; here we look at what the code actually does.

## 1. Discriminated unions keyed on `kind`

Every polymorphic shape in the codebase is a TypeScript discriminated union keyed on a string literal `kind`. This is the central organizing idea across all packages.

### `DemoStep`

`packages/schema/src/steps.ts:84-98` — the 14-arm union that every step type implements:

```ts
export type DemoStep =
  | BrowserGotoStep        // kind: "browser.goto"
  | BrowserClickStep       // kind: "browser.click"
  | BrowserFillStep        // kind: "browser.fill"
  | BrowserSelectStep      // kind: "browser.select"
  | ExpectVisibleStep      // kind: "assert.visible"
  | ExpectTextStep         // kind: "assert.text"
  | ExpectUrlStep          // kind: "assert.url"
  | CameraEstablishStep    // kind: "camera.establish"
  | CameraFocusStep        // kind: "camera.focus"
  | TimelineHoldStep       // kind: "timeline.hold"
  | TimelineTransitionStep // kind: "timeline.transition"
  | OverlayCaptionStep     // kind: "overlay.caption"
  | OverlayCalloutStep     // kind: "overlay.callout"
  | CueStep;               // kind: "cue"
```

The kind string is dotted (`browser.click`, `camera.focus`) so it doubles as a human-readable category. Because every arm has a unique kind, downstream switch statements get exhaustiveness checking for free. Examples:

- `executeStep` in `packages/playwright/src/execute.ts:28` switches on `args.step.kind`.
- `collectTracks` in `packages/timeline/src/resolve.ts:75` switches on `step.kind`.
- `describeStep` in `packages/compiler/src/inspect.ts:18` switches on `step.kind` and the TypeScript compiler errors if a new arm is added without a case.

`Locator` (`packages/schema/src/geometry.ts:8-12`) uses the same pattern with `kind: "role" | "label" | "testId" | "text"`, and `OverlayTrack` (`packages/schema/src/timeline.ts:47-70`) is itself a 2-arm union.

### Zod mirror

The Zod schema at `packages/schema/src/schemas.ts:5` uses `z.discriminatedUnion("kind", [...])` so the same union is enforced at the schema level.

## 2. Dependency injection via `runDemoWithBindings`

The Playwright runner needs to launch a real browser in production but must be unit-testable without one. The pattern is a thin public entry that delegates to a bindings-injectable core, with the real import isolated to a third file.

`packages/playwright/src/bindings.ts:4` — the only file that imports the real `playwright` package:

```ts
import { chromium } from "playwright";
import type { PlaywrightBindings } from "./types";
export const defaultBindings: PlaywrightBindings = { chromium };
```

`packages/playwright/src/runner.ts:14-19` — the production entry:

```ts
export async function runDemo(ir, options = {}) {
  return runDemoWithBindings(ir, defaultBindings, options);
}
```

`packages/playwright/src/runner.ts:21` — the testable core:

```ts
export async function runDemoWithBindings(
  ir: DemoIR,
  bindings: PlaywrightBindings,
  options: RunDemoOptions = {},
): Promise<RecordedDemoManifest> { ... }
```

`PlaywrightBindings` (`packages/playwright/src/types.ts:55`) is a structural type that names only the slice of the Playwright API the package touches (`chromium.launch`). The runner then talks to `BrowserLike` / `BrowserContextLike` / `PageLike` / `LocatorLike` (lines 18-53) instead of the real Playwright types. Tests in `packages/playwright/src/index.test.ts` pass a fake `PlaywrightBindings` whose `chromium.launch` returns stub objects implementing just enough of the protocol.

This is also why `resolveTarget` (`packages/playwright/src/locator.ts:4`) is exported separately: it's a pure function over the injected `PageLike`, so tests can call it directly with a hand-crafted page.

## 3. Result-style diagnostics with stable codes

Instead of throwing exceptions, every stage returns an `ir`/`manifest`/`timeline` plus a `diagnostics: Diagnostic[]` array. Each diagnostic carries a stable code from the `diagnosticCodes` table at `packages/schema/src/diagnostics.ts:1-9`:

```ts
export const diagnosticCodes = {
  invalidConfig: "MD001",
  duplicateId: "MD002",
  unknownTarget: "MD101",
  invalidDuration: "MD102",
  invalidScene: "MD103",
  invalidStep: "MD104",
  unknownRenderer: "MD105",
} as const;
```

Codes are grouped by prefix:

- `MD0xx` — authoring/structural errors (caught at compile time).
- `MD1xx` — referential errors (caught at compile time after the IR is built).
- `MD2xx` — runtime errors (caught by Playwright during capture; e.g. `MD201` for an unresolved target, emitted by `targetDiagnostic` at `packages/playwright/src/diagnostics.ts:3`).

Each `Diagnostic` (`packages/schema/src/diagnostics.ts:13-22`) carries optional `demoId`/`sceneId`/`stepId`/`targetId` so the caller can route the error back to the offending node. The CLI surfaces them via `formatDiagnostics` at `packages/cli/src/index.ts:284` and exits with code 1 when any diagnostic has severity `error` (line 166).

Producers today: `compileDemo` emits MD001/MD002/MD101/MD102 (`packages/compiler/src/`); `executeStep` emits MD201 (`packages/playwright/src/execute.ts:177`). MD103/MD104/MD105 are declared but not yet emitted at runtime — see the diagnostics cheat-sheet in `../spec/12-validation-and-diagnostics.md`.

## 4. The visual registry pattern

The Remotion composition doesn't hard-code which component renders a caption or a callout. It looks them up in a plain object.

`packages/remotion/src/composition.ts:56-65`:

```ts
const visualRegistry: VisualRegistry = {
  captions: {
    "motion.caption": Caption,
    "remocn.kinetic-title": KineticCaption,
  },
  callouts: {
    "motion.callout": Callout,
    "remocn.glass-callout": GlassCallout,
  },
};
```

Each `overlay.caption`/`overlay.callout` step optionally carries a `renderer` string. The renderer layer (`packages/remotion/src/overlays.ts:84-108`) looks up the component:

```ts
const Component =
  registry.captions[overlay.renderer ?? "motion.caption"] ?? Caption;
```

…falling back to the default `motion.caption` / `motion.callout` IDs. This is the seam that `../spec/09-remocn-integration.md` calls the "renderer → component" mapping. To add a new visual today you add an entry to the registry; tomorrow the registry may be populated from a plugin entry-point, but the lookup protocol is already stable. See `remocn-integration.md` for a worked example.

The registry is passed into `OverlayLayer` as an ordinary prop (`packages/remotion/src/composition.ts:95`), which is what will let a future plugin entry-point supply its own registry without touching the composition.

## 5. `makeCamera` and the focus-point camera

The camera is parameterized by a **focus point** in 1440x900 stage space plus a scale; the translate is derived. This was a recent refactor — earlier versions interpolated an `{ x, y, scale }` triple directly, which produced curved paths for diagonal motion because the translate was being lerped independently of scale.

`packages/remotion/src/camera.ts:13-25`:

```ts
export function makeCamera(scale, focusX, focusY): CameraState {
  return {
    scale,
    focusX,
    focusY,
    translateX: 720 / scale - focusX,
    translateY: 450 / scale - focusY,
  };
}
```

`720` and `450` are the stage center (1440x900 / 2). The translate is whatever puts the focus point at the stage center after scaling. `CameraState` therefore stores both the inputs (`scale`, `focusX`, `focusY`) and the derived translate, so consumers can either interpolate the focus (for diagonal motion) or read the matrix (for actual rendering).

`cameraStateAt` (`packages/remotion/src/camera.ts:31-58`) consumes that abstraction:

1. It picks the active camera track (the last track whose `fromFrame <= frame`).
2. It computes the previous and next `CameraState` via `cameraTarget` (line 60), which reads the track's `boundingBox` and is a no-op for `establish` tracks.
3. It interpolates `scale`, `focusX`, `focusY` independently through a `smoothstep` progress and reconstructs the camera via `makeCamera`.

Because interpolation happens in focus-point space, the camera now moves in a straight line between any two targets regardless of whether they share an axis. `cameraTransform` (line 81) flattens the camera + stage into a single CSS `matrix(...)` that the `StageMedia` and `TargetAndCursorLayer` use.

## 6. Duration as a string, parsed at the boundary

The authoring API accepts durations as human strings (`"250ms"`, `"1s"`, `"1.5s"`). See `packages/core/src/types.ts:51` — `timeline.hold` accepts `duration: string`. The compiler parses it into `durationMs: number` via `parseDurationMs` at `packages/compiler/src/duration.ts:1` and emits `MD102` if parsing fails (`packages/compiler/src/normalize.ts:35`). The rest of the pipeline (timeline, remotion) only ever sees numbers.

This keeps the authoring API ergonomic and the IR portable: `DemoIR.timeline.transition.durationMs` is always an integer number of milliseconds.

## 7. Identity helpers for type inference

`defineDemo`, `defineConfig`, `defineTarget` are identity functions. They exist so the author writes `export default defineDemo({ ... })` and gets the right contextual type on the literal — TypeScript widens less aggressively when a value flows through a generic identity function. See `packages/core/src/define.ts:3, 7` and `packages/core/src/targets.ts:4`. There is no runtime work; the value returned is the value passed in.

## 8. Sortable JSON keys via schema-versioning

Every persisted JSON shape begins with `schemaVersion: "1"`:

- `DemoIR.schemaVersion` (`packages/schema/src/scenes.ts:29`)
- `RecordedDemoManifest.schemaVersion` (`packages/schema/src/recorded.ts:32`)
- `RenderTimeline.schemaVersion` (`packages/schema/src/timeline.ts:73`)

The constant is exported as `schemaVersion = "1" as const` from `packages/schema/src/version.ts:1`. Downstream consumers can short-circuit on the version before attempting a structural read. There is no migration code yet — when the schema changes the plan is to bump this string and write a migration step; today it is a forward-compatibility marker.

## 9. Cacheable, command-decoupled CLI

The `democraft` CLI deliberately lets `preview` and `render` skip `compileDemo`. They read `manifest.json` + `timeline.json` from disk instead (`packages/cli/src/index.ts:72-139`). This means re-rendering after a caption copy change is a single command, no browser involved. The data flow documented in `pipeline.md` relies on this seam.
