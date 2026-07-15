# Visual Components API

## Current behavior

The current API exposes `defineVisualRegistry()`, `remocnAdapter()`, custom
Remotion entry points, and `renderer` strings, but these pieces do not form one
automatic pipeline.

1. `defineVisualRegistry()` maps caption and callout IDs to React components.
2. `remocnAdapter({ registry })` stores that registry in `config.adapters`.
3. The compiler only carries the serializable FPS projection; adapters and
   component functions cannot enter `DemoIR`.
4. The built-in Remotion entry always uses `defaultVisualRegistry`.
5. A custom registry works only when a separate entry imports it, passes it to
   `ProductDemoVideo`, and the caller supplies `--entry` or `entryPath`.
6. The Studio Player uses the built-in registry, so a custom render and the
   interactive preview can disagree.

An explicit unknown renderer now fails with the registered IDs. It no longer
silently falls back to `motion.caption` or `motion.callout`.

## What is actually supported

The current registry accepts only two component contracts:

- caption components receiving `{ overlay, opacity }`;
- callout components receiving `{ overlay, opacity, box }`.

A copied remocn component such as `BlurOutUp` is not directly compatible. It
receives its own props (`text`, `speed`, color, and similar values), so the user
must currently write a wrapper implementing `CaptionProps` or `CalloutProps`.
The adapter name suggests broader support than the runtime provides.

## Target experience

Developers and coding agents should register and use components in the same
`demo.ts`. The demo module is the source of both the authoring definition and
the Remotion client bundle.

```ts
import { defineDemo } from "@democraft/core";
import { defineVisual } from "@democraft/remotion";
import { BlurOutUp } from "./components/remocn/blur-out-up";

export default defineDemo({
  id: "launch",
  title: "Launch",
  source: { baseUrl: "http://localhost:3000" },
  visuals: {
    "local.launch-title": defineVisual({
      component: BlurOutUp,
      props: {
        text: "New analytics",
        speed: 1.2,
      },
    }),
  },
  async run({ demo }) {
    await demo.scene("intro", async (scene) => {
      await scene.visual("local.launch-title");
    });
  },
});
```

`defineVisual` must preserve the component prop type for autocomplete. A future
optional runtime schema can make arbitrary props inspectable and repairable by
LLMs, but it must not be required merely to render a copied component.

## Required pipeline changes

1. Add typed `visuals` and `scene.visual()` to the shared authoring API.
2. Store only visual IDs and serializable props in `DemoIR`; never serialize
   React component functions.
3. Generate a temporary Remotion entry that imports the original `demo.ts` and
   builds its registry during bundling.
4. Make `render demo.ts` use that generated entry automatically.
5. Make the Studio preview load the same bundled registry, so preview and final
   render cannot diverge.
6. Validate duplicate IDs, missing components, unknown visual IDs, and
   non-serializable props with `DCxxxx` diagnostics.

Until those steps are complete, `config.adapters` must not be documented as an
automatic way to activate local components.
