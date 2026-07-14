# Democraft Documentation

A design bible for an LLM-native framework that turns real product workflows into polished Remotion videos.

## Core idea

The framework combines:

- Playwright for controlling the real application;
- Remotion for timeline, composition, preview, and rendering;
- Remocn for reusable cinematic components;
- a semantic TypeScript API for scenes, actions, targets, camera direction, annotations, and outputs;
- a compiler that converts authored code into a serializable intermediate representation.

The core positioning is:

> Product demos as code.  
> Playwright performs. Remotion directs. Agents orchestrate.

## Primary design decision

There is **one public authoring API**.

Both developers and LLMs write the same TypeScript API. Developers review and refine the generated code. The framework compiles that code into a JSON intermediate representation, but JSON is not the main authoring format.

This creates a practical balance:

- TypeScript is ergonomic, composable, typed, and versionable;
- the generated JSON IR remains inspectable, portable, cacheable, and suitable for tooling;
- LLMs do not need a separate API;
- developers do not need to maintain two representations;
- visual editors and future agent protocols can operate on the IR without changing the source API.

## How this folder is organized

| Folder | Purpose |
|---|---|
| [`spec/`](./spec) | The product and architecture specification. Numbered design-bible documents describing the intended design. |
| [`architecture/`](./architecture) | How the code works today. Companion docs that cite real exports by `file:line`, kept in sync with the implementation. |
| [`adr/`](./adr) | Architecture Decision Records. |
| [`guides/`](./guides) | Hands-on guides (e.g. adding a scene safely as an agent). |
| [`process/`](./process) | Internal notes produced during the build (analysis, original prompts). |

### Specification (`spec/`)

1. [`01-product-vision.md`](./spec/01-product-vision.md)
2. [`02-design-principles.md`](./spec/02-design-principles.md)
3. [`03-single-api-and-code-vs-json.md`](./spec/03-single-api-and-code-vs-json.md)
4. [`04-public-api-design.md`](./spec/04-public-api-design.md)
5. [`05-scenes-targets-and-cues.md`](./spec/05-scenes-targets-and-cues.md)
6. [`06-compiler-and-intermediate-representation.md`](./spec/06-compiler-and-intermediate-representation.md)
7. [`07-playwright-runtime.md`](./spec/07-playwright-runtime.md)
8. [`08-remotion-renderer.md`](./spec/08-remotion-renderer.md)
9. [`09-remocn-integration.md`](./spec/09-remocn-integration.md)
10. [`10-llm-first-developer-experience.md`](./spec/10-llm-first-developer-experience.md)
11. [`11-cli-and-workflows.md`](./spec/11-cli-and-workflows.md)
12. [`12-validation-and-diagnostics.md`](./spec/12-validation-and-diagnostics.md)
13. [`13-system-architecture.md`](./spec/13-system-architecture.md)
14. [`14-mvp-and-roadmap.md`](./spec/14-mvp-and-roadmap.md)
15. [`15-end-to-end-example.md`](./spec/15-end-to-end-example.md)

### Architecture (`architecture/`)

- [`overview.md`](./architecture/overview.md) — how the monorepo is wired together today, package by package.
- [`pipeline.md`](./architecture/pipeline.md) — the end-to-end pipeline from `demo.ts` to a rendered MP4.
- [`patterns.md`](./architecture/patterns.md) — recurring code patterns with `file:line` citations.
- [`philosophy.md`](./architecture/philosophy.md) — the three design tenets, proven from real exports.
- [`remotion-integration.md`](./architecture/remotion-integration.md) — how the Remotion renderer turns a timeline into an MP4.
- [`remocn-integration.md`](./architecture/remocn-integration.md) — the Remocn component registry seam.
- [`studio.md`](./architecture/studio.md) — the Next.js preview and render studio.
- [`studio-roadmap.md`](./architecture/studio-roadmap.md) — ideas for evolving the studio past the Phase 1 MVP.

### Architecture Decision Records (`adr/`)

- [`0001-typescript-source-json-ir.md`](./adr/0001-typescript-source-json-ir.md)

### Guides (`guides/`)

- [`llm-add-scene-example.md`](./guides/llm-add-scene-example.md) — how an LLM should safely add a new scene.

## Recommended implementation order

1. Schema and core types
2. TypeScript authoring API
3. Compiler to normalized JSON IR
4. Static validation
5. Playwright runner
6. Recording manifest
7. Remotion renderer
8. Cursor and camera system
9. Remocn adapter
10. CLI and agent-oriented inspection commands
