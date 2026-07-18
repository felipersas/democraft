# Democraft Studio showcase

A demo **of** the Democraft Studio, authored **with** Democraft — the hero video
for the landing page. It captures the Studio UI itself (a Talento demo loaded
in the preview pane) and walks through preview, command palette, timeline,
live caption editing, scene seek, and render.

This is "the tool, demonstrated by the tool": `defineDemo` → Playwright
capture → Remotion render.

## Scenes

| #   | Scene         | What it shows                                           | Overlays                                |
| --- | ------------- | ------------------------------------------------------- | --------------------------------------- |
| 1   | `workspace`   | The editor layout with Talento auto-playing             | `local.lower-third` (hook)              |
| 2   | `positioning` | What the Studio is, in three chips                      | `local.feature-chips` + kinetic caption |
| 3   | `preview`     | Frame-accurate preview + the ⌘K palette (filter + seek) | kinetic caption                         |
| 4   | `timeline`    | Zoom, layer toggle, render-range band                   | kinetic caption + dark callout          |
| 5   | `captions`    | Editing copy without re-capturing (the "Edited" pill)   | kinetic caption + glass callout         |
| 6   | `scenes`      | Per-scene seek via the palette                          | kinetic caption                         |
| 7   | `render`      | Render presets + queue (shown, not clicked)             | kinetic caption + dark callout          |
| 8   | `pipeline`    | The Define → Capture → Direct → Render model            | `local.pipeline-flow`                   |
| 9   | `outro`       | Brand lockup close                                      | `local.outro-lockup`                    |

Scenes crossfade into each other (`transition({ type: "crossfade" })`).

## Custom visual components

`src/components/` holds full-frame visuals layered over the capture. Each is
registered with `defineVisual` and used via `scene.visual("local.<id>", props)`.

| Component           | Role                                                | Beats              |
| ------------------- | --------------------------------------------------- | ------------------ |
| `lower-third.tsx`   | Editorial title card (kicker + headline, slides in) | Hook, scene intros |
| `feature-chips.tsx` | A pill row of capability chips, staggered entrance  | Positioning        |
| `pipeline-flow.tsx` | The 4-stage pipeline lighting up in sequence        | Model beat         |
| `outro-lockup.tsx`  | Centered mark + wordmark + tagline close            | Outro              |

They follow remocn design discipline: one indigo accent (`#5e6ad2`), sentence
case, no glow, inline `interpolate()` with `Easing` (Studio-Visual-Mode
editable), individual `translate`/`scale` properties (not `transform`
strings).

Built-in remocn renderers are used for overlays on the capture:
`remocn.kinetic-title` (captions), `remocn.glass-callout` and
`remocn.callout-dark` (callouts), `remocn.soft-blur-in` (registered, available).

## Prerequisites

```bash
pnpm install
pnpm build
```

This demo captures a **running Studio**. Launch one with the Talento demo
loaded so there is real content in the preview pane:

```bash
pnpm exec democraft studio ../talento-saas/src/demo.ts
# → http://127.0.0.1:3000
```

The Studio materializes its data into `.democraft/studio-data/`. Scene 6 seeks
to the `sinais` scene, which exists in the `talento-saas-short` dataset (the
default for that demo). If you launch with a different Talento dataset, update
`palette-seek-scene` in `src/targets.ts` to a scene id that exists.

## Capture + render

In a separate shell (keep the Studio running):

```bash
pnpm --filter @democraft/example-studio-showcase exec democraft validate src/demo.ts
pnpm --filter @democraft/example-studio-showcase exec democraft capture src/demo.ts
pnpm --filter @democraft/example-studio-showcase exec democraft render  src/demo.ts
```

Output lands under `.democraft/renders/`. Override the Studio URL with
`DEMOCRAFT_STUDIO_URL=http://127.0.0.1:<port>` if you launched on another port.

## Drop into the landing page

```bash
cp .democraft/renders/studio-showcase.mp4 ../../apps/landing-page/public/demos/studio-showcase.mp4
# poster frame, e.g.:
# ffmpeg -i studio-showcase.mp4 -ss 0 -frames:v 1 \
#   ../../apps/landing-page/public/demos/studio-showcase-poster.webp
```

Then repoint the hero `<video>` in `apps/landing-page/components/landing.tsx`:

```diff
- poster="/demos/talento-pipeline-poster.webp"
+ poster="/demos/studio-showcase-poster.webp"
  ...
- <source src="/demos/talento-pipeline.mp4" type="video/mp4" />
+ <source src="/demos/studio-showcase.mp4" type="video/mp4" />
```

## Notes

- **No audio this round.** Layer ElevenLabs narration + music in post, or wire
  them in via `audioTracks` once the assets exist.
- **Locator strategy.** The Studio ships no `data-testid`s, so `targets.ts`
  resolves every element by semantic role or visible text. The accessible
  names are copied verbatim from `packages/studio/components/**` (see the
  inline `file:line` notes in `targets.ts`).
- **Why we don't click "Render video".** That enqueues a real headless-Chrome
  render that runs for tens of seconds and would stall the capture. The render
  feature is presented via its panel + presets instead.
- **Palette auto-closes on command run.** Clicking a palette item runs the
  command and closes the palette (`CommandPalette.tsx`), so each palette beat
  opens fresh, filters, runs one command, and is done — never left open.
