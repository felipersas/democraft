# Remotion integration

This doc describes how `packages/remotion/` turns a `RenderTimeline` into an MP4. For the original design intent see `../spec/08-remotion-renderer.md`; here we walk the code that actually exists.

The package was recently split from a single 700-line `composition.ts` into focused modules (`camera.ts`, `cursor.ts`, `overlays.ts`, `stage.ts`, `utils.ts`). `composition.ts` is now a thin orchestration layer; the meat lives in the split files.

## Where Remotion fits in the pipeline

Democraft has six stages. **Remotion is only involved in the last two** — it is purely a frame renderer. Authoring, capture, and timeline resolution are all Democraft's own code.

```
1. Authoring        demo.ts                                              ← Democraft core API
2. Compile          DemoIR                                               ← Democraft compiler
3. Capture          manifest.json + screenshots + recording.webm         ← Playwright
4. Timeline         timeline.json                                        ← Democraft timeline
5. Composition      ProductDemoVideo (React component, given a frame)    ← Remotion (preview + render)
6. Render           MP4                                                  ← Remotion (bundler + renderer)
```

Remotion's mental model: you write a React component that takes a `frame` number and returns JSX. Remotion calls that component once per frame, captures the resulting DOM as an image, and concatenates the images into a video. Remotion does NOT know anything about Playwright, manifests, or your demo. It only knows about the `frame` and the React tree you produce.

**The file Remotion "catches":** `packages/remotion/src/entry.ts` (built to `packages/remotion/dist/entry.js`). It calls `registerRoot(Root)`, where `Root` registers a single `<Composition>` pointing at our `ProductDemoVideo` component. When `renderDemoVideo` runs, it passes that entry to `@remotion/bundler`, which webpack-bundles it into a servable URL; then `@remotion/renderer` opens that URL in a headless Chrome, feeds it `inputProps`, and renders each frame.

**The data Remotion receives:** the `inputProps` object — `{ manifest, timeline, recordingSrc?, screenshotSrcByStepId, width, height }`. This is the only contract between Democraft's pipeline and Remotion's composition. Everything the composition needs to render (cursor positions, camera focus, overlay text) must be in the timeline or manifest; Remotion never reaches back into Playwright or the demo.ts.

**Why `@remotion/player` for the studio:** the Player is a React component that runs the same composition in the browser, frame-accurate, without a headless Chrome. It uses the same `ProductDemoVideo` and the same `inputProps`. So what you see in the studio IS what the MP4 will contain — no preview/render divergence. (See `studio.md` for the studio architecture.)



## Entry point and composition registration

`packages/remotion/src/entry.ts` is the Remotion entry. It calls `registerRoot(Root)` at line 34. `Root` (line 10) registers a single `Composition`:

```ts
React.createElement(Composition, {
  id: compositionId,                 // "MotionDemo"
  component: ProductDemoVideo,
  width: 1920,
  height: 1080,
  fps: 60,
  durationInFrames: 1,
  defaultProps: defaultProductDemoProps,
  calculateMetadata: ({ props }) => ({ ...metadataFromProps(props) }),
});
```

The `width`/`height`/`durationInFrames` literals here are placeholders. `calculateMetadata` (line 19) overrides them per render with values pulled from the input props — so the actual output dimensions and duration come from the timeline, not the entry file. `compositionId` is exported from `composition.ts:22` as the literal `"MotionDemo"`; `renderDemoVideo` passes it to `selectComposition` (`packages/remotion/src/index.ts:42`).

## The render entry: `renderDemoVideo`

`packages/remotion/src/index.ts:21-50` is the server-side entry. The flow:

1. `createRenderPublicDir` (line 56) makes a temp dir and copies the `.webm` recording into it as `recording.webm`. This is required because Remotion's `staticFile` only serves files under the bundle's `publicDir`.
2. `bundle({ entryPoint: "./entry.js", publicDir })` compiles the React tree with webpack via `@remotion/bundler` (line 38).
3. `selectComposition({ serveUrl, id: compositionId, inputProps })` evaluates `calculateMetadata` and returns the resolved composition (line 42).
4. `renderMedia` writes the MP4 with `codec: "h264"`, `crf: options.crf ?? 15`, `scale: options.scale ?? 1`, `jpegQuality: 100`, and `outputLocation` (line 49).
5. The temp `publicDir` is removed in a `finally`.

The input props accepted by `ProductDemoVideo` are defined at `composition.ts:24-31`: `manifest`, `recordingSrc?`, `timeline`, `screenshotSrcByStepId`, `width`, `height`. The CLI builds the screenshot map from disk as base64 data URLs (`packages/cli/src/index.ts:326-343`).

## Component tree

`ProductDemoVideo` (`composition.ts:67`) lays out four full-bleed layers stacked in z-order:

```text
AbsoluteFill (#10131a background)
├── Backdrop                                    (stage.ts:128)
│     soft gradient wash
├── StageMedia                                  (stage.ts:139)
│     the 1440x900 "browser" with the screenshot/recording
│     + camera matrix applied to an inner 1440x900 div
├── TargetAndCursorLayer                        (cursor.ts:10)
│     same 1440x900 + camera matrix
│     └── ClickRipple per active cursor track   (cursor.ts:44)
└── OverlayLayer                                (overlays.ts:64)
      React.Fragment of captions and callouts
```

Two things to notice:

- The browser chrome (rounded corners, drop shadow, fixed 1440x900 aspect) is rendered by the **outer** `StageMedia` div at stage scale. The camera transform is applied to an **inner** 1440x900 div (`stage.ts:177`), so zooming in never reveals the area outside the browser window.
- The `TargetAndCursorLayer` renders into its own 1440x900 div with the same camera matrix (`cursor.ts:23-31`). This keeps the cursor locked to the captured content even when the camera is zoomed.

## Stage layout

`stageLayout(width, height)` (`packages/remotion/src/stage.ts:13`) computes the largest 1440x900 rectangle that fits inside the output frame and centers it. The 1920x1080 default gives `scale = 1.2` with `x = 96, y = 0`. The result is a `{ scale, x, y }` triple used by every layer that needs to position stage-space content into output-space pixels. The type is exported as `StageLayout` at line 7.

## The camera system

This is the most interesting part of the renderer and the subject of a recent refactor. The shape of a camera is defined at `packages/remotion/src/camera.ts:5-11`:

```ts
export type CameraState = {
  scale: number;
  focusX: number;
  focusY: number;
  translateX: number;
  translateY: number;
};
```

### `makeCamera` (`camera.ts:13`)

```ts
export function makeCamera(scale, focusX, focusY): CameraState {
  return {
    scale, focusX, focusY,
    translateX: 720 / scale - focusX,
    translateY: 450 / scale - focusY,
  };
}
```

`720`/`450` are the half-extents of the 1440x900 stage. Given a focus point and a scale, this computes the translate that places the focus at the stage center after scaling. Why store both the inputs and the derived translate? Because interpolation should happen in focus-point space (the inputs), and rendering should happen in matrix space (the derived translate). The next two functions split those concerns.

### `cameraTarget` (`camera.ts:60`)

Given a `CameraTrack`, returns the `CameraState` the camera should reach by the end of the track. For `establish` tracks or any track without a bounding box it returns `identityCamera()` (line 27) — focus on stage center at scale 1. For `focus` tracks it computes the scale that fits the target bounding box (padded by 88px on each side, clamped to `[1.0, 1.32]`) and focuses on the box center.

### `cameraStateAt` (`camera.ts:31`)

The per-frame entry point:

1. Sort tracks by `fromFrame` (line 35).
2. Find the last track whose `fromFrame <= frame` — that is the active track.
3. Compute `previous` = `cameraTarget(tracks[index-1])` and `next` = `cameraTarget(track)`.
4. Compute progress `(frame - track.fromFrame) / track.durationInFrames`, clamped to `[0, 1]`.
5. Pass through `smoothstep` (`utils.ts:14`) for ease-in/ease-out.
6. `lerp` `scale`, `focusX`, `focusY` independently (lines 53-57) and reconstruct the camera with `makeCamera`.

### Why the refactor

Earlier versions interpolated `{ x, y, scale }` directly, computing the translate separately for the previous and next cameras and lerping that too. For diagonal motion (e.g. a focus from the top-left card to the bottom-right dialog) the camera traced a curve because the translate was being lerped independently of scale. The fix was to lift the interpolation into focus-point space: `scale`, `focusX`, and `focusY` are now the only quantities lerped, and `makeCamera` recomputes the translate from the interpolated inputs. The camera now travels in a straight line for any pair of focus targets.

### `cameraTransform` (`camera.ts:81`)

Flattens `camera + stage` into a CSS `matrix(...)`:

```ts
const scale = stage.scale * camera.scale;
return `matrix(${scale}, 0, 0, ${scale}, ${stage.x + camera.translateX * scale}, ${stage.y + camera.translateY * scale})`;
```

Both `StageMedia` (`stage.ts:177`) and `TargetAndCursorLayer` (`cursor.ts:28`) apply this matrix to their inner 1440x900 div.

## Cursor layer and `ClickRipple`

`TargetAndCursorLayer` (`cursor.ts:10`) filters cursor tracks to those whose `point` is set and whose `fromFrame <= frame`, then renders a `ClickRipple` per active track.

`ClickRipple` (`cursor.ts:44`) is a 28-frame pulse (`CLICK_PULSE_FRAMES = 28` at line 8) split into two visuals:

- A `#79e3c7` dot whose opacity rises through `[0, 0.2, 0.7, 1]` and falls back to 0 by frame 28 (line 55).
- A ring scaled from 0.4 to 2.2 (line 59) with its own opacity curve peaking around progress 0.3 (line 62).

Both layers are absolutely positioned at `track.point.x`/`track.point.y` (the recorded click center), so the ripple lines up with the actual DOM that was clicked.

## Overlay layer

`OverlayLayer` (`overlays.ts:64`) is parameterized by a `registry: VisualRegistry` prop (`overlays.ts:73`). It filters overlays to active ones via `active(overlay, frame)` (`utils.ts:1`), computes a per-overlay fade `opacity` via `overlayOpacity` (line 28 — a 12-frame fade in/out at the boundaries), then branches on `overlay.kind`:

- **Caption** (line 84): looks up `registry.captions[overlay.renderer ?? "motion.caption"]` and falls back to `Caption`. The component receives `{ overlay, opacity }`.
- **Callout** (line 94): computes a default `{ x:40, y:40, width:0, height:0 }` box if the manifest didn't capture one, runs it through `transformedBox` (`stage.ts:22`) to apply the current camera + stage matrix, then looks up `registry.callouts[overlay.renderer ?? "motion.callout"]` and falls back to `Callout`. The component receives `{ overlay, opacity, box }`.

The four built-in components are `Caption` (line 113), `KineticCaption` (line 135), `Callout` (line 168), and `GlassCallout` (line 189). `KineticCaption` wraps its text in `<SoftBlurIn>` — see `remocn-integration.md`. The single instance of `VisualRegistry` lives in `composition.ts:56-65` and is passed into `OverlayLayer` from `ProductDemoVideo` (`composition.ts:92-98`).

## Media transitions: `stageMediaState`

When a `timeline.transition` step appears in the timeline, `StageMedia` (`stage.ts:139`) cross-fades between the previous and next step's screenshot. `stageMediaState` (`stage.ts:87`) returns `{ currentSrc, currentOpacity, previousSrc, previousOpacity }`:

- For non-transition steps it picks the current step's screenshot at full opacity.
- For transitions longer than one frame it lerps `currentOpacity` from 0 to 1 across the transition and `previousOpacity` from 1 to 0, with `currentSrc` drawn from the **next** step and `previousSrc` from the **previous** step.

When `recordingSrc` is set (the captured `.webm`), `StageMedia` instead renders a single `<OffthreadVideo>` and the screenshot logic is bypassed (`stage.ts:181-201`).

## Audio layer

Audio is **presentation-only** — like captions and overlays, it never affects Playwright capture (no `captureHash` contribution). It flows through the same three representations as the rest of the pipeline:

```
demo.ts audioTracks  (Duration strings)  →  AudioTrackIR (ms)  →  AudioTrack (frames)
   @democraft/core         compiler             timeline resolver
```

`AudioLayer` (`packages/remotion/src/audio.ts`) is a fifth, non-visual child of the `AbsoluteFill` in `ProductDemoVideo`. It renders one `<Sequence><Audio/></Sequence>` per timeline audio track:

- **Timing**: `<Sequence from={track.fromFrame} durationInFrames={track.durationInFrames}>` clips each track to its span on the composition timeline. Tracks overshooting the composition end are silenced past `durationInFrames` by the Sequence.
- **Fades**: the inner `<Audio volume={(frame) => number}>` callback computes a per-frame multiplier via `audioVolumeAtFrame` (a pure function in the same module). The curve ramps `0 → track.volume` across `fadeInFrames`, holds, then ramps `track.volume → 0` across the last `fadeOutFrames`. Both fades are clamped to the span.
- **`muted` / `loop`**: forwarded verbatim to `<Audio>`.
- **Source resolution**: `audioSrcById` (an optional `ProductDemoVideoProps` field) maps each track id to a Remotion-loadable source. Absolute URLs (`http(s)://`, `data:`, `blob:`) are used as-is; publicDir-relative paths (e.g. `"audio/music.mp3"`) are wrapped in `staticFile()`. Tracks missing from the map are skipped (the Studio flags them as validation errors).

`renderDemoVideo` (`packages/remotion/src/server.ts`) builds `audioSrcById` at render time: it copies each path-based source into a temp publicDir under `audio/` and maps the id to the publicDir-relative path; URL sources pass through. Callers can supply a pre-resolved `audioSrcById` (the Studio does, since it serves files from `studio-data/audio/` rather than workspace paths).

The Studio `<Player>` runs the same composition, so audio plays in the preview identically to the rendered MP4. A master mute toggle in the Transport silences the preview (the Player has no built-in audio controls).

### Known limitations

- Source files are not opened at compile time (compilation is environment-agnostic); missing files surface at render/preview.
- There is no audio duration probe, so a non-looping track without `endAt` fills to the composition end and goes silent when the source finishes. Use `endAt` or `loop` for deterministic behavior.

## Render knobs

`renderDemoVideo` accepts `width`, `height`, `scale`, and `crf` (`packages/remotion/src/index.ts:14-24`). Defaults: 1920x1080, `scale: 1`, `crf: 15`. `jpegQuality: 100` is hard-coded. Lower `crf` = better quality and bigger files; `--scale 2` doubles the output resolution (3840x2160 from a 1920x1080 composition). The CLI exposes both as `--crf` and `--scale` flags (`packages/cli/src/index.ts:273-278`).
