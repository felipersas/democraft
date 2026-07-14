# System Architecture

## Monorepo structure

```text
apps/
  docs/
  playground/
  demo-app/

packages/
  schema/
  core/
  compiler/
  playwright/
  remotion/
  remocn/
  cli/
  presets/
  testing/

examples/
  nextjs-dashboard/
  ecommerce-checkout/
  developer-tool/
```

## Package responsibilities

### `@democraft/schema`

- Zod schemas;
- portable types;
- JSON schema generation;
- migrations;
- diagnostics contracts.

### `@democraft/core`

- `defineDemo`;
- `defineTargets`;
- `defineConfig`;
- public TypeScript API;
- duration helpers;
- asset references.

### `@democraft/compiler`

- definition capture;
- normalization;
- ID generation;
- static validation;
- execution planning;
- timeline preparation.

### `@democraft/playwright`

- target resolution;
- browser execution;
- assertions;
- environment setup;
- recording;
- geometry;
- screenshots;
- traces;
- runtime diagnostics.

### `@democraft/remotion`

- composition primitives;
- camera renderer;
- cursor renderer;
- recording playback;
- overlays;
- browser frame;
- output adaptation.

### `@democraft/remocn`

- optional adapter;
- registry integration;
- presets;
- component schemas.

### `@democraft/cli`

- commands;
- logs;
- JSON output;
- caching;
- process orchestration.

### `@democraft/presets`

- direction presets;
- camera presets;
- cursor presets;
- output presets;
- layout presets.

### `@democraft/testing`

- compiler fixtures;
- golden IR assertions;
- runtime test utilities;
- example demo tests.

## Technology choices

- TypeScript;
- React;
- Remotion;
- Playwright;
- Zod;
- pnpm workspaces;
- Turborepo;
- tsup or Rollup;
- Vitest;
- Commander or citty;
- ESLint;
- Prettier.

## Data flow

```text
demo.ts
  ↓
core definition capture
  ↓
compiler IR
  ↓
playwright execution
  ↓
recorded manifest
  ↓
render timeline
  ↓
Remotion composition
  ↓
MP4 / WebM / GIF
```

## Caching boundaries

Cache independently:

- source compilation;
- normalized IR;
- Playwright capture;
- geometry;
- render timeline;
- Remotion bundle;
- output render.

## Invalidation rules

### Capture remains valid when changing:

- text overlays;
- camera direction;
- cursor style;
- transitions;
- theme;
- output resolution.

### Capture becomes invalid when changing:

- browser steps;
- targets;
- fixtures;
- authentication;
- viewport;
- source application state;
- recording settings.

## Extensibility

Future adapters may include:

- Puppeteer;
- deterministic frame capture;
- external audio providers;
- cloud renderers;
- visual editors;
- MCP servers;
- product analytics-driven storyboards.
