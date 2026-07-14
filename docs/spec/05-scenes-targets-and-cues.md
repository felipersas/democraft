# Scenes, Targets, and Cues

## Scenes

Scenes are semantic groups, not merely frame ranges.

A scene has:

- an ID;
- a purpose;
- a pacing intent;
- a set of ordered steps;
- optional output overrides;
- optional narrative metadata.

```ts
await demo.scene(
  "configure-project",
  {
    purpose: "Show the minimum information required to create a project",
    pacing: "normal",
    importance: "primary",
  },
  async (scene) => {
    // steps
  },
);
```

## Why scenes matter

Scenes allow the compiler to:

- calculate pacing;
- create transitions;
- render partial previews;
- invalidate only affected artifacts;
- generate storyboard summaries;
- apply per-scene themes;
- adapt vertical output;
- make LLM edits more localized.

## Targets

Targets are stable semantic contracts between the demo and the application.

Do not use raw selectors throughout demo files.

Bad:

```ts
await scene.click(
  "main > div:nth-child(2) button.bg-primary",
);
```

Good:

```ts
await scene.click("new-project-button");
```

## Target definitions

```ts
import {
  byLabel,
  byRole,
  byTestId,
  defineTargets,
} from "@democraft/core";

export const targets = defineTargets({
  dashboard: byTestId("dashboard"),

  "new-project-button": byRole("button", {
    name: "New project",
  }),

  "create-project-dialog": byRole("dialog", {
    name: "Create project",
  }),

  "project-name-input": byLabel("Project name"),

  "create-project-button": byRole("button", {
    name: "Create",
  }),

  "project-card": byTestId("project-card"),
});
```

## Locator fallbacks

```ts
defineTarget({
  id: "new-project-button",

  locators: [
    byRole("button", {name: "New project"}),
    byTestId("new-project"),
    byText("New project"),
  ],
});
```

The runtime records which locator succeeded.

## Target metadata

```ts
defineTarget({
  id: "analytics-chart",
  description: "Main revenue chart on the analytics page",
  locators: [byTestId("revenue-chart")],
  framing: {
    preferredPadding: 72,
    safeArea: "center",
  },
});
```

Metadata helps camera resolution and LLM understanding.

## Cues

Cues are semantic timeline anchors.

```ts
await scene.cue("dialog-opened");
await scene.cue("project-submitted");
await scene.cue("project-visible");
```

Cues resolve to frames after browser execution.

## Why cues are better than frames

Authored code should not depend on fragile frame numbers.

Bad:

```tsx
<Sequence from={284} durationInFrames={72}>
```

Better:

```ts
await scene.callout("project-card", {
  from: "project-visible",
  until: "scene:end",
});
```

## Automatic cues

The compiler may generate cues for:

- scene start;
- scene end;
- action start;
- action end;
- assertion success;
- route change;
- target visible;
- click release.

Generated cues remain inspectable.

## Cue naming rules

Use concise semantic names:

- `dialog-opened`;
- `project-created`;
- `export-started`;
- `payment-confirmed`.

Avoid visual implementation names:

- `zoom-start`;
- `frame-320`;
- `overlay-visible`.
