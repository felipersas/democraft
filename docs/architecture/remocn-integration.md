# Remocn integration

"Remocn" is the project's name for a library of cinematic, copy-pasteable React components in the spirit of shadcn — you bring the component into your repo, you own the source. This doc describes the one Remocn component currently checked in, the registry seam that lets authors select it from demo code, and how you would add another.

For the original design narrative see `../spec/09-remocn-integration.md`. For the registry mechanics in the renderer see `patterns.md` and `remotion-integration.md`.

## The component

`packages/remotion/src/components/remocn/soft-blur-in.tsx` is the canonical example. It is a self-contained React component that animates a string character-by-character: each char rises 16px, blurs from `N` px down to 0, and fades in, with a per-char stagger of 1 frame and a duration of 27 frames. The easing is `Easing.bezier(0.22, 1, 0.36, 1)`.

Public surface (`packages/remotion/src/components/remocn/soft-blur-in.tsx:5-23`):

```ts
export interface SoftBlurInProps {
  text: string;
  blur?: number;        // default 12
  fontSize?: number;    // default 72
  color?: string;       // default "#171717"
  fontWeight?: number;  // default 600
  speed?: number;       // default 1 — multiplies useCurrentFrame()
  className?: string;
}
export function SoftBlurIn(props: SoftBlurInProps) { ... }
```

Note the `"use client"` directive at the top of the file (line 1) — Remocn components are written as Next.js-client-compatible modules so the same source can be used outside Remotion. The component reads `useCurrentFrame()` from `remotion` (line 3) so it only animates inside a Remotion composition.

## The registry seam

The composition does not import `SoftBlurIn` directly. It is wrapped in a higher-level component that the registry maps to a stable string ID. The wrapping is what turns a free-floating React component into a "renderer."

### The wrapping: `KineticCaption`

`packages/remotion/src/overlays.ts:135-166` defines `KineticCaption`, a `CaptionProps`-shaped component that shells out to `SoftBlurIn`:

```ts
export function KineticCaption({ opacity, overlay }: CaptionProps) {
  return React.createElement(
    "div",
    { style: { /* dark panel, bottom-of-screen caption box */ } },
    React.createElement(SoftBlurIn, {
      blur: 10,
      color: "white",
      fontSize: 38,
      fontWeight: 800,
      speed: 1.2,
      text: overlay.text,
    }),
  );
}
```

`KineticCaption` is the adapter between the framework's `CaptionProps` contract (defined at `overlays.ts:12-15`) and the Remocn component's free-form props. The framework only knows about `KineticCaption`; `SoftBlurIn` is an implementation detail.

### The registry

`packages/remotion/src/composition.ts:56-65` is the registry itself:

```ts
const visualRegistry: VisualRegistry = {
  captions: {
    "motion.caption": Caption,
    "remocn.kinetic-title": KineticCaption,
  },
  callouts: {
    "motion.callout": Callout,
    "remocn.glass-callout": GlassCallout,
  },
};
```

The keys are the **renderer IDs** that demo authors write. The convention is `<namespace>.<component>`:

- `motion.*` — the framework's default styling.
- `remocn.*` — Remocn adapters.

The `VisualRegistry` type is defined at `packages/remotion/src/overlays.ts:23-26` as `{ captions: Record<string, VisualComponent<CaptionProps>>; callouts: Record<string, VisualComponent<CalloutProps>> }`. The two maps are independent, so a renderer ID only needs to be unique within its overlay kind.

### Registry injection

`OverlayLayer` accepts the registry as a prop (`packages/remotion/src/overlays.ts:64-75`). `ProductDemoVideo` passes the singleton `visualRegistry` into `OverlayLayer` (`packages/remotion/src/composition.ts:92-98`). This indirection is deliberate: it is the seam that will let a future plugin entry-point supply its own registry without touching `composition.ts`.

## The author → component path

Here is the full path for an authored overlay callout with `renderer: "remocn.glass-callout"`:

1. **Author.** In `demo.ts`, the author writes:
   ```ts
   await scene.callout("project-card", {
     title: "Your project is ready",
     renderer: "remocn.glass-callout",
   });
   ```
   The `renderer` field is part of `CalloutOptions` (`packages/core/src/types.ts:31-35`).

2. **Capture.** The compiler's `createSceneCapture` records the renderer onto the `CapturedStep` (`packages/compiler/src/capture.ts:49-57`) and the resulting `OverlayCalloutStep` carries it through into the IR (`packages/schema/src/steps.ts:71-77`).

3. **Timeline.** `collectTracks` copies `step.renderer` onto the callout track (`packages/timeline/src/resolve.ts:127`).

4. **Render.** `OverlayLayer` (`packages/remotion/src/overlays.ts:101-108`) looks up the component:
   ```ts
   const Component =
     registry.callouts[overlay.renderer ?? "motion.callout"] ?? Callout;
   return React.createElement(Component, { box, key, opacity, overlay });
   ```
   With `renderer: "remocn.glass-callout"`, `Component` resolves to `GlassCallout` (`overlays.ts:189`) — a white-background, dark-text callout panel styled like frosted glass.

The caption path is identical, just through `registry.captions` (`overlays.ts:84-91`) and with `motion.caption` as the default.

## Adding a new Remocn component

To add a hypothetical `remocn.pulse-callout` today, you would:

1. **Drop in the component.** Create `packages/remotion/src/components/remocn/pulse-callout.tsx`. Match the `SoftBlurIn` shape: a `"use client"` file, named export, props interface, and a `useCurrentFrame()`-driven animation.

2. **Wrap it as a `CalloutProps` component.** In `overlays.ts`, add a top-level function `PulseCallout({ overlay, opacity, box }: CalloutProps)` that translates the framework's `overlay.title`/`overlay.description` into the new component's props and positions itself using `box` (which has already been through `transformedBox` — see `remotion-integration.md`).

3. **Register it.** Add one line to `visualRegistry.callouts` in `composition.ts:61-64`:
   ```ts
   callouts: {
     "motion.callout": Callout,
     "remocn.glass-callout": GlassCallout,
     "remocn.pulse-callout": PulseCallout,
   },
   ```

4. **Author against it.** In `demo.ts`:
   ```ts
   await scene.callout("project-card", {
     title: "Your project is ready",
     renderer: "remocn.pulse-callout",
   });
   ```

No other package needs to change. The `renderer` string flows from authoring → IR → timeline → composition untouched; only the registry knows which string maps to which component. That is the whole contract.

## Future direction

`../spec/09-remocn-integration.md` describes a future where Remocn components are installed via shadcn into the user's project and the registry is populated from a user-side entry point rather than from a hardcoded object literal. The hardcoded registry in `composition.ts:56-65` and the prop-based injection into `OverlayLayer` together form the MVP that proves out the contract; the lookup protocol (`overlay.renderer ?? "motion.<kind>"` with `?? DefaultComponent` fallback, in `overlays.ts:85-86, 101-102`) is already stable enough that swapping the registry source later is a local change.
