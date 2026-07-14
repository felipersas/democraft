# Design Principles

## One API for humans and LLMs

There should not be a developer API and a separate LLM API.

The LLM will usually produce the first version. The developer will inspect, run, edit, and approve it. Therefore, both should work with the same source representation.

The API must be:

- readable;
- strongly typed;
- explicit;
- deterministic;
- easy to diff;
- easy to validate;
- difficult to misuse;
- friendly to code generation.

## Semantic before low-level

The author should describe intent:

```ts
await direct.focus("analytics-chart");
```

Instead of implementation:

```ts
camera.set({
  x: 341,
  y: 194,
  scale: 1.384,
  durationInFrames: 42,
});
```

The compiler resolves the low-level representation.

## Code as source, JSON as artifact

TypeScript is the source of truth.

JSON is generated as an intermediate representation for:

- validation;
- caching;
- inspection;
- debugging;
- rendering;
- editor integrations;
- future agent protocols;
- build reproducibility.

Users should not need to hand-author JSON for normal workflows.

## Deterministic before intelligent

AI should assist with:

- planning;
- generation;
- repair;
- rewriting;
- target discovery;
- pacing suggestions;
- annotation suggestions.

AI should not replace deterministic execution.

The browser flow should remain reproducible through:

- stable targets;
- fixtures;
- fixed viewport;
- fixed clock;
- seeded randomness;
- explicit assertions;
- controlled authentication state.

## Defaults before configuration

A simple flow should look good without manually configuring every cursor path and transition.

Good defaults should cover:

- cursor movement;
- click effects;
- camera easing;
- reading duration;
- browser framing;
- scene transitions;
- output-safe areas.

## Inspectable automation

Automatic decisions must be explainable.

The framework should be able to report:

- why a scene lasts a certain duration;
- which locator resolved a target;
- why a camera scale was selected;
- which cue anchors an overlay;
- which step caused a re-record;
- which artifacts can be reused.

## Stable IDs everywhere

Scenes, targets, steps, cues, annotations, and outputs require stable IDs.

Stable IDs enable:

- precise diagnostics;
- agent edits;
- patch operations;
- code review;
- incremental rebuilds;
- artifact reuse.

## Escape hatches without corrupting the model

Advanced users may need custom Playwright or Remotion logic.

Escape hatches should exist, but be clearly marked as less portable or less inspectable.

```ts
await scene.custom({
  id: "initialize-editor",
  portability: "typescript-only",
  run: async ({page}) => {
    await page.evaluate(() => window.editor.initialize());
  },
});
```

## Real application first

The framework should automate and record the actual application whenever possible.

Synthetic UI should be reserved for:

- intros;
- outros;
- annotations;
- explanatory overlays;
- visual transitions;
- intentionally recreated interface fragments.
