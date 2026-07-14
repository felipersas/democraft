# Playwright Runtime

## Responsibilities

The Playwright runtime should:

- open the application;
- establish deterministic browser context;
- resolve semantic targets;
- execute browser steps;
- run assertions;
- record video;
- collect action timestamps;
- collect target geometry;
- capture screenshots;
- capture trace artifacts;
- produce structured diagnostics.

## Runtime lifecycle

```text
Load compiled IR
      ↓
Create browser context
      ↓
Apply environment controls
      ↓
Load authentication state
      ↓
Execute scenes
      ↓
Record actions and geometry
      ↓
Finalize video
      ↓
Write manifest
```

## Deterministic environment

```ts
export default defineEnvironment({
  viewport: {
    width: 1440,
    height: 900,
  },

  locale: "en-US",
  timezone: "UTC",

  clock: {
    mode: "fixed",
    now: "2026-01-15T10:00:00Z",
  },

  random: {
    seed: 42,
  },

  authentication: {
    storageState: "./fixtures/auth.json",
  },

  motion: {
    reducedMotion: true,
  },
});
```

## Target resolution

The runtime resolves targets using ordered locator strategies.

It must record:

- target ID;
- attempted locators;
- successful locator;
- confidence;
- bounding box;
- visibility state;
- resolution duration.

## Browser action timing

A browser action should emit semantic events.

Example click:

```text
cursor-move-start
cursor-arrive
hover-start
pointer-down
pointer-up
click-complete
```

The browser may execute quickly, while the renderer later gives the movement cinematic timing.

## Recording strategy for MVP

Use Playwright video recording for the application layer.

The synthetic cursor should not be baked into the browser recording.

The Remotion layer adds:

- cursor;
- click effect;
- camera;
- browser chrome;
- callouts;
- titles;
- transitions.

## Geometry collection

Bounding boxes should be captured:

- before action;
- after action;
- at cue boundaries;
- while tracking dynamic targets;
- when camera focus depends on the target.

## Application state boundaries

Assertions act as deterministic checkpoints.

```ts
await scene.click("create-project-button");
await scene.expectVisible("project-card");
```

The second step guarantees the final visual state exists before the next camera instruction.

## Network and fixture support

The runtime should support:

- route mocking;
- fixture files;
- request waiting;
- strict network-idle rules;
- endpoint stability warnings.

## Authentication

Support:

- Playwright storage state;
- setup scripts;
- cookie injection;
- local storage initialization.

## Artifact output

```text
.democraft/runs/create-project/
  recording.webm
  manifest.json
  trace.zip
  screenshots/
  console.json
  network.json
```

## Reuse and invalidation

Changing only:

- captions;
- camera behavior;
- callout text;
- output format;
- Remocn components;

should not require re-recording the browser journey.

Changing:

- browser actions;
- fixtures;
- targets;
- application state;
- viewport;

usually invalidates the capture.
