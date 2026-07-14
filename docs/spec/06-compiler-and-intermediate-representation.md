# Compiler and Intermediate Representation

## Why a compiler is necessary

The framework should not execute authoring code directly as the final runtime model.

It should compile authored TypeScript into a normalized representation.

```text
Authored TypeScript
        ↓
Definition capture
        ↓
Normalized IR
        ↓
Static validation
        ↓
Browser execution plan
        ↓
Recorded manifest
        ↓
Resolved render timeline
```

## Compilation phases

### Phase 1: definition capture

Convert `defineDemo()` calls into a normalized authored graph.

### Phase 2: normalization

- generate missing step IDs;
- expand defaults;
- normalize duration strings;
- resolve target references;
- normalize output overrides;
- validate component registry references.

### Phase 3: static validation

Check:

- duplicate IDs;
- missing targets;
- invalid scene references;
- invalid cue references;
- unsupported step combinations;
- invalid durations;
- unsupported output presets.

### Phase 4: execution planning

Create an ordered browser plan.

### Phase 5: browser resolution

Attach:

- timestamps;
- locator results;
- bounding boxes;
- screenshots;
- video offsets;
- route changes;
- assertion results.

### Phase 6: render resolution

Convert time-based events into:

- frames;
- camera transforms;
- cursor paths;
- overlay windows;
- transitions;
- output-specific framing.

## Authored IR

```ts
type DemoIR = {
  schemaVersion: "1";
  id: string;
  title: string;
  source: DemoSource;
  environment: DemoEnvironment;
  targets: Record<string, TargetDefinition>;
  scenes: DemoSceneIR[];
  outputs: Record<string, DemoOutput>;
  theme: ThemeReference;
};
```

## Scene IR

```ts
type DemoSceneIR = {
  id: string;
  purpose?: string;
  pacing: "slow" | "normal" | "fast";
  importance: "primary" | "secondary" | "supporting";
  steps: DemoStepIR[];
};
```

## Step IR

```ts
type DemoStepIR = {
  id: string;
  kind: DemoStepKind;
  target?: string;
  options: Record<string, unknown>;
  sourceLocation?: {
    file: string;
    line: number;
    column: number;
  };
};
```

## Recorded manifest

```ts
type RecordedDemoManifest = {
  demoId: string;
  recording: {
    path: string;
    width: number;
    height: number;
    durationMs: number;
  };
  steps: RecordedStep[];
  cues: ResolvedCue[];
  targets: TargetSnapshot[];
  assets: DemoAsset[];
};
```

## Resolved render timeline

```ts
type RenderTimeline = {
  fps: number;
  durationInFrames: number;
  scenes: ResolvedScene[];
  cursor: CursorTrack[];
  camera: CameraTrack[];
  overlays: OverlayTrack[];
  audio: AudioIntentTrack[];
};
```

## Generated JSON

Generated JSON should be written to:

```text
.democraft/
  ir/
  manifests/
  timelines/
```

It should not be committed by default unless the project explicitly wants reproducible build artifacts.

## Schema versioning

Every generated representation needs a schema version.

Migration tooling should eventually support:

```bash
democraft migrate
```

## Source maps

Diagnostics should point back to the authored TypeScript line whenever possible.

```text
MD102 Target "project-card" was not found.
demos/create-project/demo.ts:42:13
```
