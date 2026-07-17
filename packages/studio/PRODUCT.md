# Product

Product definition for Democraft Studio. This document is the source of truth
for the Studio's purpose, users, scope, information architecture, product
principles, and experience requirements. Visual decisions are defined in
`DESIGN.md`.

> **Implementation location.** The packaged Studio and these documents live in
> `packages/studio/`. They govern this implementation and any future Studio
> surface. They are normative, not a description of every style currently
> shipping.

## Register

product

The Landing Page uses the `brand` register because communication is its task.
The Studio uses the `product` register because design serves an active editing,
inspection, and rendering workflow. This changes density, scale, and motion —
not the Democraft identity.

## Inheritance Contract

`apps/landing-page/PRODUCT.md` and `apps/landing-page/DESIGN.md` remain the
canonical source for Democraft's brand identity. The Studio inherits, unless a
functional constraint below requires an adaptation:

- the precise, credible, quietly confident personality;
- the near-black neutral canvas and single indigo brand accent;
- Schibsted Grotesk as the interface family;
- restrained color, tight hierarchy, compact radii, hairline dividers, and
  lucid technical language;
- engineering credibility over ornament or hype;
- WCAG 2.1 AA, colorblind-safe state communication, visible focus, semantic
  controls, and complete reduced-motion alternatives;
- the prohibition on generic AI-SaaS styling, gradient text, decorative
  glassmorphism, side-stripe accents, ghost cards, excessive rounding, and
  decorative animation.

When this document does not define a Studio-specific exception, inherit the
Landing Page rule. When two interpretations remain plausible, choose the one
that makes the Studio feel like the same product immediately after leaving the
Landing Page.

## Users

The Studio serves the same technical audience at a later and more committed
stage of the journey:

- **Developers and platform engineers** authoring a typed `defineDemo` file.
  They need to verify that a real browser capture resolves into the intended
  camera, cursor, overlay, audio, and pacing behavior without repeatedly
  rendering a final video.
- **Developer-advocates and product teams** reviewing the resulting story.
  They need frame-accurate playback, legible captions, controllable audio, and
  dependable output without turning the Studio into a traditional nonlinear
  video editor.
- **AI agents and their human reviewers** producing or changing demo code.
  They need deterministic states, explicit labels, inspectable errors, and a
  UI whose behavior maps cleanly back to typed source and generated artifacts.

Context of use: one person at a desktop workstation, usually after invoking
`democraft studio demo.ts`. The user is concentrating on a concrete demo and
expects keyboard-speed navigation, high information density, and immediate
feedback. The interface should disappear into the work.

## Product Purpose

Democraft Studio is the local preview, inspection, adjustment, and rendering
surface for a code-authored demo.

The CLI compiles `demo.ts`, captures the real workflow with Playwright,
resolves its frame-accurate timeline, materializes Studio data, and launches the
packaged interface. The Studio then makes that result understandable and
actionable:

1. preview the resolved composition at the correct aspect ratio;
2. inspect time, camera, cursor, overlay, and audio behavior;
3. isolate layers and move precisely through frames;
4. make bounded presentation edits where supported;
5. recognize stale capture data and deliberately recapture;
6. configure, queue, monitor, and retrieve reproducible renders.

The Studio closes the feedback loop between typed source and rendered artifact.
It does not replace either one.

## Product Promise

**See exactly what the code will render, understand why, and produce the output
without losing the source-of-truth model.**

Every interaction should reinforce three properties:

- **Directness:** the preview and playhead respond immediately to inspection and
  supported edits.
- **Traceability:** the user can distinguish captured data, temporary edits,
  persisted overrides, stale state, render settings, and generated output.
- **Reproducibility:** the Studio never implies that an opaque UI state is more
  authoritative than `demo.ts` and its materialized capture.

## Success Criteria

A successful Studio session lets a technical user:

- confirm the resolved demo visually before committing to a final render;
- locate a moment by playback, timecode, frame stepping, ruler, track, or
  command palette without fighting the interface;
- understand which layers and overrides affect the current preview;
- recognize whether a change is ephemeral, persisted as a Studio override, or
  requires editing/recapturing the source;
- recover from missing data, invalid fields, stale captures, and render failure
  with an explicit next action;
- render the intended full timeline or selected range and find the output;
- operate all critical workflows by keyboard and perceive every state without
  depending on color alone.

The product should feel trustworthy within seconds: no ambiguous save model, no
surprise mutation of source, no unexplained waiting, and no decorative friction.

## Core Mental Model

The user works through a stable chain:

`demo.ts → capture → resolved timeline → Studio preview/overrides → render`

The UI must preserve that directionality.

- `demo.ts` is the authored source of truth.
- Capture represents interaction with the real target application.
- The resolved timeline is the frame-accurate presentation plan.
- Studio visibility, caption, range, and audio controls are inspection or
  presentation layers; their persistence must be stated at the point of use.
- Render is an explicit output action with visible options and job state.
- Recapture is deliberate because it is slower and interacts with the target
  application; it must never masquerade as a lightweight refresh.

## Scope and Boundaries

### In scope

- responsive preview of the actual Remotion composition;
- play/pause, frame stepping, seek, loop, mute, timecode, and FPS context;
- a zoomable frame ruler and timeline tracks for camera, cursor, overlays, and
  audio;
- layer visibility, solo, reset, and render-range inspection;
- supported caption and audio overrides with explicit reset behavior;
- capture staleness status and user-confirmed recapture with progress;
- render presets/settings, ranges, queue states, cancellation, clearing, and
  output-folder access;
- keyboard shortcuts, command palette, loading, empty, validation, failure, and
  success states.

### Explicitly out of scope

- replacing TypeScript authoring with a visual editor;
- arbitrary drag-to-retime or reorder operations that silently rewrite
  `demo.ts`;
- hidden AST mutation or an ambiguous autosave model;
- multi-user presence, hosted collaboration, or cloud project management;
- decorative dashboards, engagement metrics, or marketing content inside the
  work surface;
- inventing familiar editor controls before the underlying capability exists.

Future capabilities may expand the Studio, but must preserve the code-first
contract and be added to these documents before they become a new interaction
standard.

## Information Architecture

The Studio is one persistent workspace, not a collection of marketing-style
pages.

1. **Workspace header** — Democraft identity, active demo ID, source freshness,
   recapture, commands/shortcuts discovery, and narrowly relevant help.
2. **Preview workspace** — the dominant visual region containing the real
   composition at its native aspect ratio.
3. **Transport** — playback, frame navigation, loop/mute, current frame,
   timecode, and FPS.
4. **Inspector rail** — context and bounded edits: layers/captions, audio, and
   render controls. Sections follow the user's path from inspection to output.
5. **Timeline dock** — full-width temporal navigation, ruler, playhead, tracks,
   visibility/solo controls, zoom, and in/out range.
6. **Transient layers** — command palette, shortcut reference, confirmations,
   alerts, and job feedback. They never obscure state without a clear exit.

The preview and timeline are the spatial anchors. Panels support them rather
than competing with them.

## Primary Workflows

### 1. Open and validate

- Launch through the CLI with an explicit demo source.
- Show a structural loading state while Studio data is read.
- On success, place the real preview, timeline, and demo identity immediately.
- If data is unavailable, explain what failed and give a recovery action; do
  not leave an empty editor shell that looks usable.
- If the capture is stale, show the status near the demo identity without
  blocking inspection of the existing result.

### 2. Inspect playback and timing

- Play/pause from transport, preview, command palette, or `Space` with the same
  resulting state.
- Step one frame with arrow keys and ten with `Shift`; support start/end jumps.
- Keep frame number, timecode, ruler, playhead, preview, and selected track
  position synchronized.
- Click a ruler or track segment to seek; zoom without changing the current
  time or losing the user's location.
- Use monospaced/tabular numerals only for time and frame data, never as a lazy
  substitute for the interface typeface.

### 3. Isolate and review layers

- Camera, cursor, overlay, and audio tracks use consistent rows and controls.
- Visibility controls always expose their label or accessible name.
- Shift-modified solo behavior is discoverable in tooltip and shortcut help.
- Hidden and solo states change iconography and text/state treatment as well as
  color.
- Reset returns the complete layer set to its captured default.

### 4. Adjust presentation safely

- Caption edits update preview immediately and state whether they will affect
  the next render.
- Audio changes identify overrides as edited, validate at field level, persist
  through the defined override mechanism, and offer a clear reset to
  `demo.ts`.
- Destructive removal and reset actions have explicit labels and proportionate
  confirmation or undo behavior.
- Empty panels teach the next action (for example, how to add an audio track)
  instead of merely reporting absence.

### 5. Select output range

- Full timeline is the safe default.
- Enabling a range introduces visible in/out handles, a labeled range value,
  and a highlighted interval.
- Dragging never allows inverted or zero-length ranges.
- Render controls repeat whether the range will be applied, so the consequence
  is visible at the point of commitment.

### 6. Recapture deliberately

- Explain that recapture runs Playwright against the target application.
- Require confirmation before starting.
- Report meaningful phases: compiling, capturing, resolving, materializing,
  complete, and failed.
- Disable duplicate invocation while running and preserve a readable failure
  long enough to diagnose it.
- Reload the resulting data without erasing unrelated user context when safe.

### 7. Render and retrieve

- Present presets before advanced fields; defaults must be valid and legible.
- Summarize consequential options before enqueueing.
- Each job exposes pending, rendering/progress, completed, failed, and canceled
  states with text/icon treatment.
- Allow cancellation only while meaningful, clearing only for finished jobs,
  and direct opening of successful output.
- A failed job keeps its diagnostic message and a clear retry path.

## Product Principles

1. **The artifact is primary.** The real composition, not a mock thumbnail or
   decorative dashboard, owns the workspace.

2. **Code remains authoritative.** Make overrides useful without implying that
   the Studio has silently replaced `demo.ts`.

3. **Frame accuracy without ceremony.** Keyboard and pointer paths converge on
   the same playhead state. Frequent operations are immediate and reversible.

4. **State must explain itself.** Captured, stale, edited, hidden, soloed,
   muted, ranged, queued, rendering, completed, and failed states are named and
   never communicated by color alone.

5. **Density with hierarchy.** This is a professional tool used at a desktop.
   Compact controls are appropriate; cramped hit areas, tiny meaningful text,
   and weak contrast are not.

6. **Familiarity is a feature.** Use established player, timeline, inspector,
   command-palette, and render-queue conventions. Brand character comes from
   the Democraft system, not invented affordances.

7. **Motion reports change.** Movement is reserved for playhead progression,
   panel/state transitions, progress, and feedback. The Studio never performs
   a marketing-style entrance sequence.

8. **Local by design.** The UI should communicate that it is a focused local
   development tool. Security boundaries, source paths, and output operations
   remain explicit and trustworthy.

## Brand Personality in Product Context

**Precise. Credible. Quietly confident.** In the Studio this becomes calm,
compact, and operational.

- Use short labels and concrete verbs: “Render”, “Re-capture”, “Reset to
  demo.ts”, “Open output folder”.
- Describe actual phases and errors rather than saying “Working magic” or
  “Something went wrong”.
- Avoid superlatives, celebratory confetti, mascots, growth language, and
  conversational filler.
- Do not abbreviate critical consequences to save space. Compactness comes from
  hierarchy and progressive disclosure, not ambiguity.
- English is the current product language. Future localization must preserve
  technical terms and allow labels to expand without clipping.

## Interaction Priorities

1. Keep playback, seeking, and inspection responsive.
2. Prevent source or output surprises.
3. Preserve orientation across preview, timeline, and inspector.
4. Make errors diagnosable and recovery explicit.
5. Optimize expert speed without hiding a discoverable pointer path.

Keyboard shortcuts accelerate visible controls; they are never the only way to
perform a critical action. Commands that mutate data or start expensive work
retain confirmation and disabled/loading states when invoked from the palette.

## Accessibility and Inclusion

Target: **WCAG 2.1 AA**, including keyboard-only use and colorblind-safe states.

- Body and control text reaches at least 4.5:1 contrast; large text reaches
  3:1; meaningful dim text cannot use a decorative-only token.
- Every interactive element has an accessible name, visible `:focus-visible`
  treatment, and a practical minimum target of 32 × 32px in the dense desktop
  shell; primary and destructive actions target 40 × 40px where space allows.
- Focus order follows the visual workflow: header → preview/transport →
  inspector → timeline → transient layer.
- Dialog-like surfaces trap focus, close with `Escape`, restore focus to the
  invoker, and expose a programmatic title. Background click is an additional
  exit, never the only exit.
- Playback and animation never create unavoidable flashing; continuous motion
  can be paused. Reduced motion removes nonessential transitions and replaces
  spatial animations with instant state changes or crossfades.
- Status, selection, visibility, progress, validation, and error never depend
  on hue alone: pair color with icon, label, pattern/shape, position, or text.
- Errors connect to fields programmatically and remain available until
  corrected or dismissed; time-limited feedback is also announced through an
  appropriate live region.
- Timeline operations need keyboard equivalents. Draggable in/out handles must
  expose values and support incremental keyboard adjustment.
- Tooltips supplement visible or accessible labels; they do not contain
  indispensable instructions.

## Responsive Product Strategy

Studio is desktop-first because frame-accurate video work requires space, but
“desktop-first” is not permission to break on smaller windows.

- **Wide (≥1280px):** persistent inspector, dominant preview, full timeline.
- **Compact desktop (960–1279px):** narrower or resizable inspector, condensed
  header copy, preserved preview/timeline relationship.
- **Narrow (720–959px):** inspector becomes a labeled drawer or tabs; timeline
  remains horizontally scrollable; transport keeps primary actions visible.
- **Small (<720px):** supported as review mode: preview, transport, basic seek,
  status, and render-job visibility remain available. Dense editing fields may
  move into full-height sheets, but no content may overflow or become
  unreachable.

Typography remains a fixed product scale. Responsiveness changes structure and
priority, not headline size theatrics.

## Product Governance

- New Studio behavior must map to the core mental model and declare whether it
  reads source, changes ephemeral preview state, persists an override, triggers
  capture, or creates output.
- New UI states require default, hover, focus, active/selected, disabled,
  loading, success, warning, error, and empty treatment where applicable.
- Any proposed visual divergence from the Landing Page identity must document a
  functional reason in `DESIGN.md`. “Editors usually look this way” is not a
  sufficient reason.
- Roadmap ideas are not product truth until implemented and promoted into this
  document. Documentation must never imply an unavailable control.
