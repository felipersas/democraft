# Remotion Renderer

## Responsibilities

The Remotion renderer should consume a resolved manifest and produce:

- preview compositions;
- final video;
- multiple aspect ratios;
- synthetic cursor;
- click effects;
- camera motion;
- browser frames;
- callouts;
- captions;
- transitions;
- optional Remocn components.

## Main composition

```tsx
export const ProductDemoComposition = ({
  manifest,
  timeline,
}: ProductDemoProps) => {
  return (
    <ProductDemo manifest={manifest} timeline={timeline}>
      <DemoBackground />
      <DemoStage>
        <BrowserFrame>
          <DemoRecording />
        </BrowserFrame>
      </DemoStage>

      <DemoCamera />
      <DemoCursor />
      <DemoOverlays />
    </ProductDemo>
  );
};
```

## Synthetic cursor

The cursor should be rendered separately from the recording.

This enables:

- smooth paths;
- configurable style;
- click ripple;
- hover pauses;
- output-specific scaling;
- path correction;
- hidden idle movement;
- consistent rendering.

## Cursor presets

```ts
type CursorPreset =
  | "direct"
  | "natural"
  | "cinematic"
  | "precise";
```

The normal API should not expose raw Bézier points.

## Target-aware camera

Primary API:

```ts
await scene.focus("analytics-chart");
```

Resolved output:

```ts
{
  target: "analytics-chart",
  fromFrame: 180,
  toFrame: 224,
  transform: {
    scale: 1.42,
    translateX: -214,
    translateY: -96
  }
}
```

## Camera operations

- establish;
- focus;
- fit;
- follow target;
- follow cursor;
- reset;
- cut;
- pan;
- output-specific framing.

## Output adaptation

```ts
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

  square: {
    width: 1080,
    height: 1080,
  },
}
```

The recording can remain the same while the camera and layout adapt.

## Reading duration

Text overlays should use automatic duration constraints based on:

- text length;
- target pacing;
- narration intent;
- scene importance;
- output duration limits.

## Snapshot mode

The runtime may capture high-resolution screenshots at important cues.

The renderer can temporarily display a screenshot instead of video during strong zooms or long holds.

## Remotion Studio

The first preview experience should use Remotion Studio.

A custom editor can be built later using the same timeline and manifest.

## Partial previews

The CLI should render:

- one scene;
- a cue range;
- representative frames;
- low-quality drafts.

This is important for LLM iteration and developer review.
