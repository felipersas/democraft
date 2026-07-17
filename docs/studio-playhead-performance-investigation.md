# Studio playhead performance investigation

## Problem

During Studio playback, the timeline playhead does not move smoothly. It
occasionally freezes and then jumps forward, which makes the preview feel as if
it is not running at 60 FPS.

## Verified facts

- The resolved Talento timeline is configured at **60 FPS**.
- `examples/talento-saas/.democraft/studio-data/timeline.json` contained:
  - `fps: 60`
  - `durationInFrames: 1350`
  - duration: 22.5 seconds
- `PlayerPane` passes `timeline.fps` directly to the Remotion `<Player>`.
- A rendered Talento MP4 was inspected with `ffprobe` and reported:
  - `r_frame_rate: 60/1`
  - `avg_frame_rate: 60/1`
  - 4797 frames over 79.95 seconds
- No `fps` entry is required in `demo.ts`: `resolveTimeline()` defaults to 60
  FPS. Adding `config: { fps: 60 }` would only make the existing value explicit.

The final render is therefore genuinely 60 FPS. The visible problem is the
Studio timeline UI, not the video configuration or encoded output.

## Runtime measurement

The playhead DOM position was sampled for three seconds while the Remotion
Player was playing:

- 163 visible playhead updates
- approximately 54.3 updates per second
- mean interval: approximately 18.5 ms
- longest observed interval: approximately 149.5 ms
- after the long pause, the playhead jumped forward to catch up

The Player frame counter continued advancing at approximately 60 frames per
second. This confirms that the playhead drops UI updates while playback time
continues normally.

## Relevant implementation

### Frame subscription

`packages/studio/lib/hooks/use-player-frame.ts`

`usePlayerFrame()` subscribes to Remotion's `frameupdate` event and calls React
`setState` for every emitted frame.

### Timeline render tree

`packages/studio/components/TimelineTrack.tsx`

The frame state is passed to the complete `TimelineBody` component.

`packages/studio/components/timeline/TimelineBody.tsx`

Every frame update can render the ruler and every track row again. The component
also maps timeline ticks and all camera, cursor, overlay, and audio entries.

`packages/studio/components/timeline/TrackRow.tsx`

Each of the four rows renders its own playhead element:

```tsx
<div
  className="absolute top-0 bottom-0 w-px ..."
  style={{ left: props.frame * props.pxPerFrame }}
/>
```

The playhead position uses the layout property `left`. Updating it can trigger
layout and paint work. This happens in four rows while React also reconciles the
rest of the timeline tree.

## Likely root cause

The high-frequency playback signal is coupled to the full React timeline render
tree:

1. Remotion emits `frameupdate`.
2. `usePlayerFrame()` calls `setFrame()`.
3. `TimelineTrack` and `TimelineBody` render again.
4. All track arrays and ruler ticks are revisited.
5. Four playhead nodes receive new `left` values.
6. Under main-thread pressure, browser paints are skipped.
7. The next rendered update uses the latest frame, producing a visible jump.

## Recommended implementation

Keep timeline content declarative and mostly static, but move the playhead onto
a lightweight animation path.

1. Render one playhead overlay spanning all timeline rows instead of one
   playhead per `TrackRow`.
2. Update its position with `requestAnimationFrame`.
3. Use `transform: translate3d(x, 0, 0)` instead of `left`.
4. Avoid passing the current playback frame through every track row.
5. Keep frame-dependent active-track highlighting separate or update it at a
   lower frequency if it remains expensive.
6. Keep seeking behavior frame-accurate.
7. Respect reduced-motion preferences, but do not add a CSS transition between
   frames; interpolation should follow the Player clock.

Possible structure:

- A `TimelinePlayhead` component receives the Player reference and zoom data.
- It subscribes directly to `frameupdate` or reads the Player frame inside one
  `requestAnimationFrame` loop while playing.
- It mutates only its own `transform` style through a ref.
- React state is still updated for semantic frame/time labels, potentially
  throttled to a lower rate if necessary.

Do not create an independent time clock that can drift from Remotion. Remotion's
current frame must remain the source of truth.

## Required tests

- Unit test that the playhead position calculation maps frames to pixels.
- Subscription lifecycle test: play, pause, seek, loop, unmount.
- Verify only one visual playhead is rendered.
- Verify seeking updates the playhead immediately while paused.
- Verify timeline zoom changes reposition the playhead correctly.
- Verify no animation loop remains after unmount.
- Preserve existing keyboard transport and frame-stepping behavior.

## Acceptance criteria

- Timeline and Player remain synchronized during play, pause, seek, and loop.
- No visible multi-frame teleporting during normal playback.
- Playhead DOM updates remain close to display refresh cadence on a 60 Hz
  display, with no recurring long stalls caused by timeline rendering.
- The full timeline tree does not render once per playback frame.
- Playhead movement uses compositor-friendly transforms rather than `left`.
- Final rendered video remains 60 FPS.
- Existing Studio tests, typecheck, lint, and production build pass.

## Out of scope

- Changing the demo FPS.
- Changing Remotion render FPS.
- Modifying video encoding settings.
- Adding artificial CSS easing or transitions to hide dropped updates.
