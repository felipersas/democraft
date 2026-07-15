# Single-file visual components implementation plan

**Goal:** Let a demo declare arbitrary local or copied remocn components in `demo.ts` and use them through the same typed API as every other demo step.

**API:** `defineVisual(Component)` infers component props; `defineDemo({visuals})` carries those types into `scene.visual(id, props, {duration})`. Only the visual ID, JSON props, and duration enter serializable artifacts. The React component remains in the author module and is attached by the Remotion entry.

## Phase 1: Typed authoring and serializable artifacts

- Extend `packages/core/src/types.ts` and `packages/core/src/define.ts` with generic visual definitions and `scene.visual`.
- Capture and normalize `overlay.visual` in `packages/compiler/src/capture.ts` and `packages/compiler/src/normalize.ts`.
- Add the step and track contracts to `packages/schema/src/steps.ts`, `packages/schema/src/scenes.ts`, `packages/schema/src/timeline.ts`, and `packages/schema/src/artifact-schemas.ts`.
- Validate undeclared visual IDs and non-JSON props with actionable diagnostics.
- Resolve generic visual tracks and explicit/default duration in `packages/timeline/src/resolve.ts`.
- Add type-level and runtime tests in the existing package test suites.

## Phase 2: Generic Remotion registry

- Add `defineVisual(Component)` and generic registry entries in `packages/remotion/src/registry.ts`.
- Extend `VisualRegistry` and `OverlayLayer` in `packages/remotion/src/overlays.ts`.
- Render each component in a Remotion `Sequence` beginning at its step so `useCurrentFrame()` is local to the visual.
- Preserve existing caption/callout renderers for compatibility and cover generic resolution with tests.

## Phase 3: Automatic author-module entry

- Generate a Remotion entry that imports the same demo module and derives its generic visual registry.
- Use that entry automatically when `democraft render demo.ts ...` is given; retain `--entry` as an explicit override.
- Reuse the same entry path in Studio rendering, then document any remaining Player-preview limitation explicitly.
- Verify lint, typecheck, unit tests, and builds before committing each completed vertical slice.
