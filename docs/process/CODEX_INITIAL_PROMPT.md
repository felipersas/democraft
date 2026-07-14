# Initial Codex Prompt

You are starting the implementation of a new open-source TypeScript framework for building deterministic product-demo videos from real web applications.

The project combines:

- Playwright for executing real browser workflows;
- Remotion for video composition, preview, and rendering;
- Remocn as an optional source of cinematic components;
- a semantic TypeScript API that is equally suitable for developers and coding agents;
- a compiler that converts authored TypeScript definitions into a serializable JSON intermediate representation.

Read every Markdown document in this repository before changing code. Treat them as the product and architecture specification.

## Core product decision

There is only one public authoring API.

Developers and LLMs write the same TypeScript API. TypeScript is the source of truth.

JSON is generated internally as a normalized intermediate representation for validation, execution, inspection, caching, and rendering. Do not create a separate JSON-first public API in the MVP. Do not require users to synchronize TypeScript and JSON manually.

## Core positioning

> Product demos as code.  
> Playwright performs. Remotion directs. Agents orchestrate.

## First implementation objective

Build the semantic foundation before implementing browser capture or video rendering.

Create a pnpm monorepo with Turborepo and these initial packages:

```text
packages/
  schema/
  core/
  compiler/
  testing/
```

Do not implement `playwright`, `remotion`, or `remocn` packages yet beyond empty placeholders if needed for workspace planning.

## Required technologies

- TypeScript with strict mode;
- pnpm workspaces;
- Turborepo;
- Zod;
- Vitest;
- tsup or another appropriate library bundler;
- ESLint;
- Prettier.

## First milestone

Implement an end-to-end compilation flow:

```text
TypeScript demo definition
        ↓
captured semantic definition
        ↓
normalized JSON-compatible IR
        ↓
static validation
        ↓
human-readable inspection output
```

The first milestone is complete when the repository can define this demo:

```ts
export default defineDemo({
  id: "create-project",
  title: "Create a project",
  source: {
    baseUrl: "http://localhost:3000",
    initialPath: "/dashboard",
  },
  targets,
  async run({demo}) {
    await demo.scene("introduction", async (scene) => {
      await scene.goto("/dashboard");
      await scene.expectVisible("dashboard");
      await scene.establish("dashboard");
      await scene.caption("Create a workspace in seconds.");
      await scene.hold("1s");
    });

    await demo.scene("configure-project", async (scene) => {
      await scene.click("new-project-button");
      await scene.expectVisible("create-project-dialog");
      await scene.focus("create-project-dialog");
      await scene.fill("project-name-input", "Oddworks");
      await scene.click("create-project-button");
    });

    await demo.scene("project-created", async (scene) => {
      await scene.expectVisible("project-card");
      await scene.focus("project-card");
      await scene.callout("project-card", {
        title: "Your project is ready",
      });
      await scene.hold("1.5s");
    });
  },
});
```

And compile it into a normalized JSON-compatible representation with:

- stable demo ID;
- stable scene IDs;
- generated stable step IDs;
- typed step kinds;
- target references;
- normalized duration values;
- source metadata where practical;
- schema version;
- deterministic output.

## Public API requirements

Implement these initial functions:

```ts
defineConfig()
defineTargets()
defineDemo()
```

Implement these initial scene methods:

```ts
scene.goto()
scene.click()
scene.fill()
scene.select()
scene.expectVisible()
scene.expectText()
scene.expectUrl()
scene.establish()
scene.focus()
scene.hold()
scene.transition()
scene.caption()
scene.callout()
scene.cue()
```

Every method must compile into a serializable step.

Avoid arbitrary callbacks inside individual steps. The `run` callback is acceptable because it is the ergonomic authoring mechanism, but all operations called through the scene object must be captured rather than executed against a browser.

## Target API requirements

Implement target builders:

```ts
byRole()
byLabel()
byTestId()
byText()
defineTarget()
defineTargets()
```

Targets must support ordered locator fallbacks.

The compiler must reject references to unknown targets.

## Step design

Use explicit discriminated unions.

Examples:

```ts
type DemoStep =
  | BrowserGotoStep
  | BrowserClickStep
  | BrowserFillStep
  | BrowserSelectStep
  | ExpectVisibleStep
  | ExpectTextStep
  | ExpectUrlStep
  | CameraEstablishStep
  | CameraFocusStep
  | TimelineHoldStep
  | TimelineTransitionStep
  | OverlayCaptionStep
  | OverlayCalloutStep
  | CueStep;
```

Do not use an untyped structure such as:

```ts
{
  type: string;
  payload: any;
}
```

## Duration handling

Support duration strings such as:

```text
250ms
1s
1.5s
```

Normalize them into milliseconds in the compiled IR.

Reject invalid or negative durations with stable diagnostics.

## Diagnostics

Create a structured diagnostic type:

```ts
type Diagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  demoId?: string;
  sceneId?: string;
  stepId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
};
```

Implement stable error codes for at least:

```text
MD001 INVALID_CONFIG
MD002 DUPLICATE_ID
MD101 UNKNOWN_TARGET
MD102 INVALID_DURATION
MD103 INVALID_SCENE
MD104 INVALID_STEP
MD105 UNKNOWN_RENDERER
```

Validation must return diagnostics rather than throwing opaque errors whenever possible.

## Inspection output

Implement a function that converts compiled IR into readable text.

Example:

```text
CREATE A PROJECT

Scene: configure-project

1. Click target "new-project-button"
2. Expect target "create-project-dialog" to be visible
3. Focus camera on "create-project-dialog"
4. Fill target "project-name-input" with "Oddworks"
5. Click target "create-project-button"
```

## Testing requirements

Add tests for:

- target definition;
- target fallback ordering;
- scene capture;
- deterministic step ID generation;
- duration normalization;
- unknown target diagnostics;
- duplicate scene diagnostics;
- JSON serialization;
- human-readable inspection;
- stable compilation output.

Use golden snapshots only where they improve clarity. Prefer direct assertions for semantic behavior.

## Example application

Create an example under:

```text
examples/basic-demo/
```

It should compile a realistic `create-project` demo and print:

- normalized IR;
- validation diagnostics;
- readable inspection output.

No browser needs to open in this milestone.

## Documentation requirements

Add:

- package READMEs;
- root development instructions;
- one architecture decision record explaining why TypeScript is the source of truth and JSON is generated IR;
- one example showing how an LLM should safely add a new scene.

## Implementation rules

- Keep packages small and cohesive.
- Avoid premature abstractions.
- Do not build the visual editor.
- Do not build an MCP server.
- Do not implement AI generation.
- Do not implement Playwright execution yet.
- Do not implement Remotion rendering yet.
- Do not couple the IR to React components.
- Do not store imported component references in the IR.
- Use stable string renderer IDs for future visual integrations.
- Ensure all public types are exported intentionally.
- Run type checking and tests before finishing.

## Expected final response

When the milestone is complete, report:

1. files and packages created;
2. key API decisions;
3. test results;
4. known limitations;
5. the exact next milestone for implementing the Playwright runtime.

Begin by reading the design documents, then create the monorepo and implement the first milestone without asking for confirmation unless an actual blocking ambiguity appears.
