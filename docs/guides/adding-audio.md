# Adding audio tracks

Democraft supports any number of audio tracks per demo — background music,
narration, sound effects, and ambient audio. Audio is **presentation-only**:
it never triggers a re-capture (it doesn't affect the `captureHash`), and it is
composited into the final MP4 by Remotion alongside the captured visuals.

Audio is authored in TypeScript (like everything else), edited live in the
Studio, and flows through the same pipeline as captions and overlays.

## Authoring

Add an `audioTracks` array to your demo definition. Each track uses the
project's `Duration` string convention for times (`"250ms"`, `"1s"`, `"1.5s"`)
so authoring stays fps-independent.

```ts
import { defineDemo } from "@democraft/core";

export default defineDemo({
  id: "create-project",
  title: "Create a project",
  source: { baseUrl: "http://localhost:3000" },
  audioTracks: [
    {
      id: "background-music",
      src: "./assets/music.mp3",
      kind: "music",
      startAt: "0s",
      volume: 0.25,
      loop: true,
      fadeIn: "1s",
      fadeOut: "1s",
    },
    {
      id: "narration",
      src: "./assets/narration.mp3",
      kind: "narration",
      startAt: "2s",
      volume: 1,
    },
    {
      id: "success-chime",
      src: "https://example.com/chime.mp3",
      kind: "sfx",
      startAt: "12.5s",
      volume: 0.6,
    },
  ],
  // ...targets, run
});
```

### Track properties

| Property   | Type                                  | Default  | Notes                                                                    |
| ---------- | ------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `id`       | `string`                              | required | Stable, demo-unique. Used by the Studio and diagnostics.                 |
| `src`      | `string`                              | required | Path (workspace-relative/absolute), URL, or `staticFile("…")`.          |
| `label`    | `string`                              | `id`     | Display label in the Studio.                                             |
| `kind`     | `"music"\|"narration"\|"sfx"\|"ambient"` | `"sfx"`  | Classification; drives the Studio icon/color.                           |
| `startAt`  | `Duration`                            | `"0ms"`  | Start offset on the composition timeline.                                |
| `endAt`    | `Duration`                            | (end)    | Inclusive end. Omit to play to composition end (or source end).          |
| `volume`   | `number`                              | `1`      | `0`–`1`.                                                                 |
| `muted`    | `boolean`                             | `false`  | Silences the track.                                                      |
| `loop`     | `boolean`                             | `false`  | Loops the source across the track's span.                                |
| `fadeIn`   | `Duration`                            | `"0ms"`  | Ramp `0 → volume` at the start.                                          |
| `fadeOut`  | `Duration`                            | `"0ms"`  | Ramp `volume → 0` at the end.                                            |

> **Source trim** (`trimStart`/`trimEnd`) is intentionally deferred — see
> "Limitations" below.

## Sources

- **Workspace paths** (`./assets/music.mp3`): resolved against the workspace
  root. The CLI copies them into the render's public dir; the Studio
  materializes them into `studio-data/audio/`.
- **URLs** (`https://…`, `data:`, `blob:`): fetched directly by Remotion at
  render/preview time.
- **File existence** is not checked at compile time (compilation is
  environment-agnostic); a missing file surfaces as a validation error at
  render or preview.

## Validation

The compiler validates audio tracks and reports clear, per-track diagnostics
under the `DC30x` codes — for example:

- `DC300` duplicate audio id
- `DC301` missing `src`
- `DC302` volume out of range (must be `0`–`1`)
- `DC303` `endAt` not greater than `startAt`
- `DC304` fade longer than the track span (or overlapping fades)
- `DC305` unsupported file extension
- `DC306` unparseable duration string

Run `democraft validate <demo.ts>` to see them.

## Studio editing

The **Audio** panel (right sidebar) lets you add, edit, remove, enable/disable,
mute, and loop tracks with live preview. Edits persist to
`studio-data/audio-overrides.json` — a full track set that **replaces** the
demo.ts `audioTracks` for preview and render (the Studio never writes demo.ts).

- **Reset** reverts to demo.ts (deletes the override file).
- **Master mute** (volume icon in the transport) silences the preview only.
- An **Audio** row in the timeline visualizes each track as a bar.

Because the override file is JSON in the IR shape, re-captures and re-resolves
preserve your Studio edits.

## How it renders

Each track becomes a `<Sequence><Audio/></Sequence>` in the Remotion
composition (see `docs/architecture/remotion-integration.md` "Audio layer").
Fades use a per-frame `volume` callback; `muted` and `loop` are forwarded
verbatim. The composition duration stays scene-driven, and audio is clipped to
it.

## Limitations (v1)

- No source trimming (`startFrom`/`endAt` on the source file).
- No audio duration probe: a non-looping track without `endAt` fills to the
  composition end and goes silent when the source finishes. Use `endAt` or
  `loop` for deterministic behavior.
- No audio upload UI in the Studio (reference on-disk paths or URLs).
- The standalone HTML preview (`democraft preview`) does not play audio; use
  the Studio for audio preview.
