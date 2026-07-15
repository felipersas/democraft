<div align="center">

# Democraft

**Turn real product workflows into polished, reproducible videos.**

Write one TypeScript demo. Let Playwright perform it, Remotion direct it, and
developers or AI agents maintain it through the same API.

[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/status-experimental-orange.svg)](#project-status)

[Quickstart](./apps/docs/content/quickstart.mdx) ·
[Documentation](./apps/docs/content/introduction.mdx) ·
[CLI](./apps/docs/content/cli/overview.mdx) ·
[Architecture](./docs/architecture/overview.md) ·
[LLM reference](./llms.txt)

</div>

> [!NOTE]
> Democraft is currently source-first and pre-release. The public packages are
> prepared as `0.1.0-beta.0`; follow [Develop from source](#develop-from-source)
> until the first npm release.

## Why Democraft?

Traditional screen recordings become stale as soon as the product changes.
Fixing a caption, changing the pacing, or updating one interaction often means
recording and editing the entire video again.

Democraft makes the demo itself the source of truth:

- **Code instead of takes.** Review product demos in pull requests and regenerate them on demand.
- **A real browser instead of mock screens.** Playwright performs the workflow against your application.
- **Capture once, edit repeatedly.** Reuse captured screenshots and recordings while changing captions, camera, pacing, and overlays.
- **One API for humans and LLMs.** Agents generate the same typed TypeScript that developers write and review.
- **A deterministic render pipeline.** Remotion turns the resolved timeline into a repeatable MP4.

## A complete demo in one file

```ts
// demo.ts
import { byRole, byTestId, defineDemo, defineTargets } from "@democraft/core";

const targets = defineTargets({
  dashboard: byTestId("dashboard"),
  newProject: byRole("button", { name: "New project" }),
  projectCard: byTestId("project-card"),
});

export default defineDemo({
  id: "create-project",
  title: "Create a project",
  source: {
    baseUrl: "http://localhost:3000",
    initialPath: "/dashboard",
  },
  targets,
  async run({ demo }) {
    await demo.scene("create", async (scene) => {
      await scene.goto("/dashboard");
      await scene.establish("dashboard");
      await scene.caption("Create a workspace in seconds.");
      await scene.click("newProject");
    });

    await demo.scene("result", async (scene) => {
      await scene.expectVisible("projectCard");
      await scene.focus("projectCard");
      await scene.callout("projectCard", {
        title: "Your project is ready",
      });
    });
  },
});
```

With the target application running:

```bash
pnpm exec democraft validate demo.ts
pnpm exec democraft render demo.ts -o demo.mp4
```

Or open the visual workflow:

```bash
pnpm exec democraft studio demo.ts
```

The demo path can be omitted when the current directory contains one
unambiguous `demo.ts`, `demo.tsx`, `src/demo.ts`, or `src/demo.tsx`.

## How it works

```text
demo.ts
   │
   ├── compile + validate ──► JSON-compatible Demo IR
   │
   ├── Playwright capture ──► manifest + screenshots + recording + trace
   │
   ├── timeline resolver ───► frame-accurate camera, cursor, and overlays
   │
   └── Remotion render ─────► MP4
```

Capture and rendering are separate stages. The browser establishes what really
happened; the timeline and renderer decide how to present it. Once captured,
the target application is not needed for presentation-only edits.

## What you can author

| Concern         | API examples                               |
| --------------- | ------------------------------------------ |
| Browser actions | `goto`, `click`, `fill`, `select`          |
| Assertions      | `expectVisible`, `expectText`, `expectUrl` |
| Camera          | `establish`, `focus`                       |
| Timeline        | `hold`, `transition`, `cue`                |
| Overlays        | `caption`, `callout`, `visual`             |
| Targets         | `byRole`, `byLabel`, `byTestId`, `byText`  |

Targets are semantic contracts rather than CSS selectors. They can contain
fallback locators, which makes demos more resilient to markup changes and gives
validation diagnostics enough context to suggest repairs.

## CLI

The common path is intentionally short:

| Command                                  | Purpose                                                       |
| ---------------------------------------- | ------------------------------------------------------------- |
| `democraft studio [demo.ts]`             | Capture or reuse artifacts and open the interactive Studio.   |
| `democraft render [demo.ts] -o demo.mp4` | Run the complete capture-to-MP4 pipeline.                     |
| `democraft validate [demo.ts]`           | Validate without opening a browser.                           |
| `democraft inspect [demo.ts]`            | Print a readable or JSON representation of the compiled demo. |
| `democraft targets [demo.ts]`            | List the target contracts used by the demo.                   |
| `democraft capture [demo.ts]`            | Run only the Playwright capture stage.                        |
| `democraft timeline [demo.ts]`           | Resolve a timeline from a capture manifest.                   |
| `democraft preview`                      | Generate the deprecated standalone HTML preview.              |

Artifact flags remain available for CI and debugging:

```bash
pnpm exec democraft capture demo.ts --output-dir .democraft/runs/create-project
pnpm exec democraft timeline demo.ts \
  --manifest .democraft/runs/create-project/manifest.json \
  -o .democraft/timelines/create-project.json
pnpm exec democraft render demo.ts \
  --manifest .democraft/runs/create-project/manifest.json \
  --timeline .democraft/timelines/create-project.json \
  -o demo.mp4
```

Run `pnpm exec democraft help` or `pnpm exec democraft <command> --help` for the
full reference.

## User-owned visual components

Democraft supports React visual components declared directly in `demo.ts`.
Components may be written locally or copied from a shadcn-style registry such
as remocn; the component source stays in your project.

```ts
import { defineDemo, defineVisual } from "@democraft/core";
import { LaunchTitle } from "./launch-title";

export default defineDemo({
  id: "launch",
  title: "Product launch",
  source: { baseUrl: "http://localhost:3000" },
  visuals: {
    "local.launch-title": defineVisual(LaunchTitle),
  },
  async run({ demo }) {
    await demo.scene("launch", async (scene) => {
      await scene.visual("local.launch-title", {
        title: "Analytics, redesigned",
      });
    });
  },
});
```

TypeScript checks both the visual ID and its props. Democraft generates the
Remotion entry automatically; a custom entry is only needed when replacing the
composition itself or other advanced renderer behavior.

## Studio

The local Studio provides a frame-accurate Remotion preview, timeline tracks,
caption editing, layer visibility, render ranges, a render queue, keyboard
shortcuts, and in-place re-capture. It works from `.democraft/studio-data/`, so
cached captures can be previewed and rendered without the target app running.

```bash
pnpm exec democraft studio demo.ts
```

The Studio binds to the loopback interface and mutation endpoints require an
ephemeral session token created by the CLI.

## Project status

> [!WARNING]
> Democraft is experimental and pre-1.0. The npm packages are prepared as
> `0.1.0-beta.0` but are not ready for public installation until the Studio is
> distributable outside this monorepo. Use the source workflow below for now.

Working today:

- TypeScript authoring and structured `DCxxxx` diagnostics.
- Playwright capture with screenshots, recording, trace, and environment metadata.
- Capture reuse and compatibility-aware staleness detection.
- Timeline resolution for camera, cursor, transitions, captions, callouts, and custom visuals.
- Interactive Studio and headless MP4 rendering.
- Human-readable and JSON CLI output for developers, CI, and coding agents.

Democraft is a good fit for product marketing, onboarding walkthroughs,
release demos, and repeatable product flows. It is not a general-purpose screen
recorder or a replacement for hand-crafted motion design.

## Develop from source

Requirements: Node.js 20+, pnpm 9+, and Chromium for capture.

```bash
git clone https://github.com/felipersas/democraft.git
cd democraft
corepack enable
pnpm install
pnpm build
pnpm exec playwright install chromium
```

Start the bundled target application in one terminal:

```bash
pnpm --filter @democraft/example-demo-app start
```

Then launch the Studio from the repository root:

```bash
pnpm exec democraft studio examples/demo-app/src/demo.ts
```

Run the complete verification suite with:

```bash
make check
```

## Packages

| Package                 | Responsibility                                               |
| ----------------------- | ------------------------------------------------------------ |
| `@democraft/core`       | Public TypeScript authoring API and locator builders.        |
| `@democraft/schema`     | Portable artifacts, schemas, geometry, and diagnostics.      |
| `@democraft/compiler`   | Demo compilation, normalization, inspection, and validation. |
| `@democraft/playwright` | Browser execution and capture artifacts.                     |
| `@democraft/timeline`   | Deterministic frame timeline resolution.                     |
| `@democraft/remotion`   | React composition and MP4 renderer.                          |
| `@democraft/preview`    | Deprecated standalone HTML artifact preview.                 |
| `@democraft/testing`    | Shared fixtures and integration helpers.                     |
| `@democraft/cli`        | The `democraft` command-line interface.                      |
| `@democraft/studio`     | Private local editing and rendering application.             |

The dependency graph and package boundaries are documented in
[Architecture](./docs/architecture/overview.md).

## Release tooling

The repository contains one global Makefile instead of repeating release logic
inside every package:

```bash
make pack
make publish-dry-run
make publish CONFIRM=publish TAG=beta
```

The last command performs a real publication and intentionally requires an
explicit confirmation plus a clean Git worktree. See the
[npm publishing guide](./docs/releasing/npm.md) before using it.

## Documentation for coding agents

[`llms.txt`](./llms.txt) is the compact, machine-oriented entry point. The CLI
also exposes stable JSON output and actionable diagnostics, allowing agents to
inspect and repair demos without parsing human terminal prose.

## Contributing

Read the [development guide](./DEVELOPMENT.md) before opening a change. Keep the
English and pt-BR documentation trees in sync, use the same authoring API for
humans and agents, and run `make check` before submitting.

## License

Democraft is available under the [MIT License](./LICENSE).
