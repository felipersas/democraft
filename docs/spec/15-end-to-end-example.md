# End-to-End Example

## Project structure

```text
democraft.config.ts

demos/
  create-project/
    demo.ts
    targets.ts
```

## Configuration

```ts
import {defineConfig} from "@democraft/core";
import {remocnAdapter} from "@democraft/remocn";

export default defineConfig({
  fps: 60,

  environment: {
    viewport: {
      width: 1440,
      height: 900,
    },

    locale: "en-US",
    timezone: "UTC",

    authentication: {
      storageState: "./fixtures/auth.json",
    },
  },

  direction: {
    preset: "saas-clean",
  },

  adapters: [
    remocnAdapter(),
  ],

  outputs: {
    landscape: {
      width: 1920,
      height: 1080,
    },

    vertical: {
      width: 1080,
      height: 1920,
      framing: "active-target",
    },
  },
});
```

## Targets

```ts
import {
  byLabel,
  byRole,
  byTestId,
  defineTargets,
} from "@democraft/core";

export default defineTargets({
  dashboard: byTestId("dashboard"),

  "new-project-button": byRole("button", {
    name: "New project",
  }),

  "create-project-dialog": byRole("dialog", {
    name: "Create project",
  }),

  "project-name-input": byLabel("Project name"),

  "project-template": byLabel("Template"),

  "create-project-button": byRole("button", {
    name: "Create",
  }),

  "project-card": byTestId("project-card"),
});
```

## Demo

```ts
import {defineDemo} from "@democraft/core";
import targets from "./targets";

export default defineDemo({
  id: "create-project",
  title: "Create your first project",

  source: {
    baseUrl: "http://localhost:3000",
    initialPath: "/dashboard",
  },

  targets,

  async run({demo}) {
    await demo.scene(
      "introduction",
      {
        purpose: "Establish the product and primary action",
      },
      async (scene) => {
        await scene.goto("/dashboard");
        await scene.expectVisible("dashboard");

        await scene.establish("dashboard");

        await scene.title({
          text: "Create projects in seconds",
          renderer: "remocn.kinetic-title",
        });

        await scene.hold("1s");
      },
    );

    await demo.scene(
      "configure-project",
      {
        purpose: "Show the complete project creation workflow",
        importance: "primary",
      },
      async (scene) => {
        await scene.click("new-project-button");
        await scene.expectVisible("create-project-dialog");

        await scene.focus("create-project-dialog", {
          padding: 72,
        });

        await scene.fill(
          "project-name-input",
          "Oddworks",
        );

        await scene.select(
          "project-template",
          "Blank project",
        );

        await scene.click("create-project-button");
      },
    );

    await demo.scene(
      "project-created",
      {
        purpose: "Confirm the result and explain the next step",
      },
      async (scene) => {
        await scene.expectVisible("project-card");
        await scene.cue("project-visible");

        await scene.focus("project-card");

        await scene.callout("project-card", {
          title: "Your project is ready",
          description:
            "Invite your team or start building immediately.",
        });

        await scene.hold("1.8s");
      },
    );
  },
});
```

## Commands

```bash
democraft validate create-project --static
democraft validate create-project --journey
democraft capture create-project
democraft preview create-project
democraft render create-project --output landscape
democraft render create-project --output vertical
```

## Expected generated artifacts

```text
.democraft/
  ir/
    create-project.json

  runs/
    create-project/
      recording.webm
      manifest.json
      trace.zip
      screenshots/

  timelines/
    create-project.landscape.json
    create-project.vertical.json

  renders/
    create-project.landscape.mp4
    create-project.vertical.mp4
```

## Example edit without re-recording

Change:

```ts
await scene.callout("project-card", {
  title: "Share your new workspace",
});
```

And:

```ts
await scene.focus("share-button");
```

Only the render timeline and output video should be invalidated.
