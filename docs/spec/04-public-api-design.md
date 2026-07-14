# Public API Design

## API goals

The public API should be:

- fluent;
- semantic;
- easy to scan;
- highly typed;
- deterministic;
- serializable after compilation;
- friendly to incremental editing;
- difficult for LLMs to hallucinate.

## Core entry point

```ts
import {defineDemo} from "@democraft/core";

export default defineDemo({
  id: "create-project",
  title: "Create a project",

  source: {
    baseUrl: "http://localhost:3000",
    initialPath: "/dashboard",
  },

  targets,

  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
      await scene.establish("dashboard");
      await scene.caption("Create a workspace in seconds.");
    });

    await demo.scene("create", async (scene) => {
      await scene.click("new-project-button");
      await scene.expectVisible("create-project-dialog");
      await scene.focus("create-project-dialog");
      await scene.fill("project-name-input", "Oddworks");
      await scene.click("create-project-button");
    });

    await demo.scene("result", async (scene) => {
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

## Why one `scene` object?

A single scene API is easier for both developers and LLMs than multiple namespaces that must be coordinated.

Instead of:

```ts
await act.click(...);
await assert.visible(...);
await direct.focus(...);
await annotate.callout(...);
```

Use:

```ts
await scene.click(...);
await scene.expectVisible(...);
await scene.focus(...);
await scene.callout(...);
```

The method names already communicate the operation category.

Internally, each method still compiles to a typed step kind:

- `browser.click`;
- `assert.visible`;
- `camera.focus`;
- `overlay.callout`.

This preserves architecture without fragmenting authoring.

## Browser methods

```ts
scene.goto(path);
scene.click(target, options?);
scene.doubleClick(target, options?);
scene.hover(target, options?);
scene.fill(target, value, options?);
scene.type(target, value, options?);
scene.select(target, value, options?);
scene.press(target, key, options?);
scene.scrollTo(target, options?);
scene.drag(fromTarget, toTarget, options?);
scene.waitFor(target, options?);
```

## Assertion methods

```ts
scene.expectVisible(target);
scene.expectHidden(target);
scene.expectText(target, text);
scene.expectUrl(path);
scene.expectEnabled(target);
scene.expectCount(target, count);
```

Assertions are part of the authored flow because they define deterministic state boundaries.

## Direction methods

```ts
scene.establish(target?);
scene.focus(target, options?);
scene.fit(targets, options?);
scene.follow(target, options?);
scene.followCursor(options?);
scene.resetCamera(options?);
scene.cutTo(target, options?);
scene.hold(duration);
scene.transition(options);
```

## Annotation methods

```ts
scene.caption(text, options?);
scene.callout(target, options);
scene.spotlight(target, options?);
scene.outline(target, options?);
scene.badge(target, options);
scene.title(options);
```

## Cue methods

```ts
scene.cue("dialog-opened");
scene.cue("project-created");
```

## Sound intent methods

```ts
scene.narrate(text, options?);
scene.sound("click-soft", options?);
scene.silence(duration);
```

Audio synthesis can remain outside the MVP. The API stores intent.

## Explicit step IDs

IDs should usually be generated automatically, but users can provide them when precise control is needed.

```ts
await scene.click("create-project-button", {
  id: "submit-project",
});
```

## Composition helpers

Reusable functions should remain possible:

```ts
async function fillProjectForm(
  scene: DemoScene,
  input: {
    name: string;
    template: string;
  },
) {
  await scene.fill("project-name-input", input.name);
  await scene.select("project-template", input.template);
}
```

## API rule

Every first-class method must compile into a serializable step.

Methods that cannot be serialized must be explicit escape hatches.
