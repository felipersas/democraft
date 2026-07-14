# Remocn Integration

## Role of Remocn

Remocn should provide optional cinematic building blocks for:

- scene titles;
- text transitions;
- backgrounds;
- browser frames;
- callouts;
- feature labels;
- animated UI explanations;
- intros and outros.

It should not be required by the core runtime.

## Package structure

```text
@democraft/core
@democraft/playwright
@democraft/remotion
@democraft/remocn
```

## Adapter model

```ts
import {remocnAdapter} from "@democraft/remocn";

export default defineConfig({
  adapters: [
    remocnAdapter(),
  ],
});
```

## Semantic renderer IDs

The authored source should reference portable renderer IDs.

```ts
await scene.title({
  text: "Create projects in seconds",
  renderer: "remocn.kinetic-title",
});
```

The compiled IR stores:

```json
{
  "kind": "overlay.title",
  "renderer": "remocn.kinetic-title",
  "props": {
    "text": "Create projects in seconds"
  }
}
```

## Visual registry

```ts
registerVisual({
  id: "remocn.kinetic-title",

  props: z.object({
    text: z.string(),
    emphasis: z.enum([
      "subtle",
      "normal",
      "strong",
    ]),
  }),

  component: KineticTitle,
});
```

## Why a registry matters

A registry allows:

- validation;
- documentation generation;
- LLM discovery;
- autocomplete;
- safe prop generation;
- theme packaging;
- component substitution.

## Copy-paste compatibility

Because Remocn components may be copied into the project, the adapter should allow local registration:

```ts
defineVisualRegistry({
  "local.launch-title": LaunchTitle,
});
```

## Theme presets

```ts
theme: {
  preset: "remocn-cinematic",
}
```

A theme can define:

- background;
- typography;
- transitions;
- title renderer;
- callout renderer;
- cursor style;
- browser frame;
- spacing;
- safe areas.

## Rule

The framework should integrate with Remocn without forcing authored demos to import Remocn components directly.
