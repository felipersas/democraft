# DESIGN.md

Normative visual and interaction system for Democraft Studio. It adapts the
identity defined by `apps/landing-page/DESIGN.md` to a dense local product
surface while keeping both experiences visibly part of one product.

> **Register: product.** Design serves preview, inspection, adjustment, and
> rendering. Consistency and task clarity outrank novelty. See `PRODUCT.md` for
> the product contract and scope.

> **Implementation location.** The current runtime and this document live in
> `packages/studio/`. This file describes the target system for this package and
> future Studio surfaces. Existing implementation values that conflict with
> this document are migration gaps, not alternate brand decisions.

---

## Design Inheritance

The Landing Page is the upstream brand source. The Studio does not reinterpret
the logo, typeface, base neutrals, brand accent, radii, icon family, voice, or
accessibility bar.

### Inherited unchanged

- near-black neutral canvas with ascending neutral surfaces;
- near-white primary foreground and carefully contrasted secondary foreground;
- one saturated indigo accent for primary action, selection, focus, and
  progress;
- Schibsted Grotesk as the sole interface family;
- Lucide icons, compact radii, hairline separators, restrained shadows;
- solid text (never gradient text), full borders (never accent side-stripes),
  and stateful rather than decorative motion;
- WCAG 2.1 AA, visible focus, colorblind-safe encoding, and complete
  `prefers-reduced-motion` behavior.

### Adapted for product use

- fixed, compact type sizes replace fluid display scales;
- spacing uses a 4px base and denser control rhythm instead of landing-page
  section pacing;
- panels and toolbars use additional neutral elevation layers;
- responsive behavior restructures panes rather than scaling typography;
- semantic state colors are allowed for warning, error, and success, but are
  sparse and always paired with icon/text;
- motion shortens to 90–200ms and communicates state only;
- the real Remotion preview replaces brand imagery as the visual focal point.

The Studio must look visually indistinguishable from the Landing Page at the
identity level: same black, indigo, typeface, mark, edge language, and restraint.
It should differ only in density and functional structure.

---

## Color

Use Studio-prefixed semantic custom properties. Values intentionally inherit
the Landing Page palette; aliases may point to shared brand tokens when a
cross-app token package exists.

### Surfaces

| Token | Value | Role |
| --- | --- | --- |
| `--studio-bg` | `#08090a` | App canvas, preview surround |
| `--studio-surface-1` | `#131416` | Header, transport, timeline canvas |
| `--studio-surface-2` | `#18191c` | Inspector sections, inputs, recessed controls |
| `--studio-surface-3` | `#1d1e21` | Raised menus, popovers, selected neutral surfaces |
| `--studio-hover` | `#222327` | Hovered row/control |
| `--studio-active` | `#28292e` | Pressed or strongly selected neutral state |
| `--studio-scrim` | `rgba(0,0,0,0.58)` | Modal/popover backdrop |

Do not introduce a blue-tinted parallel neutral system. The current
`packages/studio/app/globals.css` values (`#0a0d14`, `#10131a`, `#161b26`, and
mint accent) are legacy implementation values to consolidate toward this
inherited system during a future code refactor.

### Foreground

| Token | Value | Role |
| --- | --- | --- |
| `--studio-fg` | `#f4f5f8` | Primary labels, selected values, headings |
| `--studio-fg-secondary` | `#c6c8ce` | Body, controls, important metadata |
| `--studio-muted` | `#8a8d96` | Secondary labels and inactive navigation |
| `--studio-subtle` | `#62656d` | Decorative ticks/dividers only |
| `--studio-on-accent` | `#f8f8ff` | Text/icons on indigo controls |

`--studio-muted` is the floor for meaningful text. `--studio-subtle` may be
used for ruler ticks, inactive decorative marks, and nonessential separators,
never instructions, input values, placeholders, errors, or required metadata.

### Brand accent

| Token | Value | Role |
| --- | --- | --- |
| `--studio-accent` | `#5e6ad2` | Primary action, focus, playhead, selection |
| `--studio-accent-hover` | `#6b76da` | Hover on primary action |
| `--studio-accent-active` | `#515dbc` | Pressed primary action |
| `--studio-accent-soft` | `rgba(94,106,210,0.14)` | Range fill, selected row, progress track |
| `--studio-accent-border` | `rgba(94,106,210,0.48)` | Selected/focused edge where outline is unsuitable |

The accent occupies less than 10% of the product chrome. It marks action or
state, never decoration. There is no Studio-specific mint brand accent.

### Borders

| Token | Value | Role |
| --- | --- | --- |
| `--studio-border-subtle` | `rgba(255,255,255,0.06)` | Pane and row dividers |
| `--studio-border` | `rgba(255,255,255,0.09)` | Inputs, secondary buttons, panels |
| `--studio-border-strong` | `rgba(255,255,255,0.14)` | Popovers, focused groups, resize boundaries |

Prefer dividers and shared edges over cards. A bordered element does not also
receive a wide decorative shadow.

### Semantic states

Semantic colors are functional exceptions to the single-accent chrome rule.
They appear only with a label/icon and on the smallest useful surface.

| Token | Value | Usage |
| --- | --- | --- |
| `--studio-success` | `#63c69b` | Completed render/recapture + check + label |
| `--studio-warning` | `#d9a85c` | Stale capture + warning icon + “Stale” |
| `--studio-error` | `#e06c75` | Validation/render failure + icon/message |
| `--studio-info` | `#7e9bd8` | Neutral operational information |

Tinted fills use 12–16% opacity. Do not make whole panels red, green, or yellow.
Do not use track colors as semantic status colors.

### Timeline track palette

Track colors identify categories, not health or importance. Each row also has
an icon and visible name.

| Track | Color | Companion encoding |
| --- | --- | --- |
| Camera | `#5e6ad2` | Camera icon + “Camera” |
| Cursor | `#d9a85c` | Pointer icon + “Cursor” |
| Overlays | `#7e9bd8` | Layers icon + “Overlays” |
| Audio | `#63a98f` | Music icon + “Audio” |

Selected segments add a foreground outline or handle; hidden segments reduce
opacity and change the eye icon. Never require hue discrimination alone.

---

## Typography

**Typeface: Schibsted Grotesk**, variable, exposed as `--font-sans`. Use the
same loading strategy and files as the Landing Page. System fallback is
`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
sans-serif`.

One family carries the entire product UI. Monospace is restricted to code,
paths where character distinction matters, frame counters, and timecodes.

| Role | Size / line-height | Weight | Notes |
| --- | --- | --- | --- |
| Workspace title | `14px / 20px` | 600 | “Democraft Studio” |
| Panel title | `12px / 16px` | 550 | Sentence case; no tracked uppercase reflex |
| Control / body | `13px / 20px` | 400–500 | Default UI text |
| Compact control | `12px / 16px` | 450–500 | Dense rows and buttons |
| Metadata | `11px / 16px` | 400 | Secondary but meaningful |
| Micro label | `10px / 14px` | 500 | Rare; short ruler/technical labels only |
| Time/frame data | `12px / 16px` | 450 | Mono + `tabular-nums` |
| Empty/error title | `14px / 20px` | 550 | Paired with 12–13px explanation |

### Rules

- No fluid `clamp()` type in the Studio shell.
- No display type, gradient text, or oversized empty-state headline.
- Default meaningful text is at least 11px; 9–10px is limited to ruler ticks,
  short noncritical badges, and compact metadata that has an accessible name.
- Use sentence case for panels and actions. Uppercase tracked text is reserved
  for genuinely conventional micro metadata such as FPS, never every heading.
- Use `text-wrap: pretty` for help/error prose; keep instructional copy within
  65–75ch.
- Use `font-variant-numeric: tabular-nums` for counters, timecodes, percentages,
  dimensions, CRF, and progress to prevent layout jitter.
- Preserve Landing Page display tracking only on brand surfaces. Studio labels
  use normal tracking or at most `-0.01em` for the workspace title.

---

## Spacing and Density

The base unit is **4px**.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-1` | `4px` | Icon/label micro gap |
| `--space-2` | `8px` | Control groups, field stack |
| `--space-3` | `12px` | Toolbar padding, compact section gap |
| `--space-4` | `16px` | Panel padding, major group gap |
| `--space-5` | `20px` | Large inspector separation |
| `--space-6` | `24px` | Preview breathing room |
| `--space-8` | `32px` | Empty/error-state grouping |

Group related controls tightly; separate functional regions with a divider plus
12–16px, not arbitrary card padding. A dense shell still preserves 32px minimum
interactive targets and enough separation to avoid accidental activation.

---

## Layout and Grid

### Workspace geometry

The Studio fills `100dvh` and uses a nested product grid:

```text
┌──────────────────── workspace header: 44px ─────────────────────┐
│ preview workspace (minmax(0,1fr)) │ inspector (320px nominal)   │
│                                    │                             │
├────────────── transport: 48px ─────┴─────────────────────────────┤
│ timeline dock: clamp(200px, 26dvh, 320px)                        │
└──────────────────────────────────────────────────────────────────┘
```

- Header spans the full width and stays structurally quiet.
- Preview receives all remaining flexible space and never distorts the video.
- Inspector is 320px nominal, 288px minimum, 400px practical maximum. It may be
  resizable, but its width must persist only when that behavior is implemented.
- Timeline spans the full workspace to maximize temporal precision.
- Transport remains visually attached to the preview but may span beneath the
  inspector when doing so improves compact layouts.
- All pane children use `min-width: 0` / `min-height: 0` so scrolling belongs to
  the intended region rather than the page.

### Preview

- Center the real composition in the available region with 24px desktop and
  12–16px compact padding.
- Fit contain at the composition aspect ratio. Never crop or stretch.
- Canvas surround is `--studio-bg`; the frame uses a 12px radius and one subtle
  edge. Avoid the current ghost-card combination of ring plus broad 24px+
  shadow. If depth is needed, use a border **or** a tight ≤8px shadow.
- The preview is the dominant artifact. Empty controls or decorative graphics
  never compete with it.

### Inspector

- Use one continuous rail with section dividers. Cards are allowed only when a
  section is a truly independent repeated object (for example, one audio track
  among several); do not nest cards inside cards.
- Order follows workflow: inspection/layers → presentation overrides → audio →
  render settings → render jobs.
- Section headers remain sticky only when content length justifies it.
- Field labels align above controls for narrow reliability. Two-column field
  pairs are reserved for values users compare together, such as width/height or
  start/end.

### Timeline

- Fixed label column: 112–136px depending on viewport; scrollable temporal
  canvas occupies the remainder.
- Frame ruler stays aligned with track bars at every zoom.
- Playhead crosses ruler and tracks with a crisp 1px accent line and a larger
  draggable/visible head. It must remain visible over range fills.
- Tracks are 28–32px high with 4px vertical gaps. Row labels, visibility, and
  solo controls never scroll horizontally with temporal content.
- Horizontal scrolling is expected at zoom; vertical page scrolling is not.
- Range fill sits below ticks, segments, handles, and playhead in the z-index
  order.

### Z-index scale

| Layer | Token value |
| --- | --- |
| Sticky labels / ruler | `10` |
| Playhead / range handles | `20` |
| Dropdown / popover | `30` |
| Scrim | `40` |
| Dialog / command palette | `50` |
| Toast / operational alert | `60` |
| Tooltip | `70` |

Never use arbitrary `999`/`9999` values.

---

## Responsive Structure

The Studio is desktop-first and must remain coherent in resized browser windows.

### Wide: ≥1280px

- Persistent inspector and full-height preview.
- Timeline height may grow to 320px.
- Header shows demo ID, freshness, recapture, command hint, and help link.

### Compact desktop: 960–1279px

- Inspector narrows toward 288px.
- Hide redundant shortcut prose before hiding actions or status.
- Paired fields may stack if values or localized labels clip.
- Preview padding reduces to 16px.

### Narrow: 720–959px

- Inspector becomes a right drawer or a labeled tabbed sheet; it is not squeezed
  beside an unusably small preview.
- Preview and transport use the full width.
- Timeline remains docked and horizontally scrollable.
- Header keeps brand mark, demo identity/status, recapture, and an overflow menu.

### Small: <720px

- Review mode prioritizes preview, transport, status, and render-job visibility.
- Inspector groups open as full-height sheets with explicit Back/Close.
- Timeline may collapse to ruler + selected track, with a control to open the
  complete timeline; do not delete access to tracks or range state.
- Icon-only controls retain accessible names and 40px targets where touch is
  plausible.
- No horizontal overflow outside the timeline's intentional scroll region.

Use CSS container queries for panel internals when behavior depends on panel
width; use viewport media queries for workspace restructuring.

---

## Radii and Elevation

| Token | Value | Use |
| --- | --- | --- |
| `--studio-radius-sm` | `4px` | Kbd, range handles, tiny controls |
| `--studio-radius-md` | `6px` | Buttons, inputs, segments |
| `--studio-radius-lg` | `12px` | Preview, popover, dialog |

Panel/card ceiling is 12–16px. Pills are reserved for compact status badges
whose shape communicates bounded metadata. Do not use 24px+ rounding.

Elevation comes primarily from surface contrast and borders. Menus/dialogs may
use a focused shadow such as `0 8px 24px rgba(0,0,0,.32)` because they must
separate from the workspace; ordinary panels and buttons do not.

---

## Component System

Every interactive component defines default, hover, focus-visible, active or
selected, disabled, loading, error, and success states when those states apply.

### Brand and workspace header

- Use the official dark-canvas Democraft mark or compact lockup from the Landing
  Page assets, not a generic clapperboard as the primary brand identity.
- “Studio” may appear as a quiet product suffix, never redrawn into a separate
  logo.
- Demo ID uses secondary text and truncates from the middle when path-like;
  preserve the full value in title/accessible text.
- Freshness is a compact status with icon + label. Warning styling indicates
  stale capture without overpowering the workspace.
- Re-capture is a labeled secondary action. During work, swap the icon/label to
  the current phase and disable duplicate activation.

### Buttons

Base: inline-flex, centered, `min-height: 32px`, 6px radius, 12–13px/500 text,
8px icon gap, 90ms color/background/border transition.

- **Primary:** indigo fill, `--studio-on-accent`, accent-hover/active. One primary
  commitment per local region (normally Render).
- **Secondary:** surface-2 + one border + secondary foreground. Hover uses
  surface-hover and stronger text.
- **Ghost:** transparent, muted foreground; hover adds surface-hover. Use for
  transport and low-risk toolbar actions.
- **Destructive:** neutral by default; error color appears with destructive
  label/icon on hover/focus or in a confirmation surface. Avoid permanent red
  chrome for routine remove actions.
- **Icon-only:** 32 × 32px minimum, 16px icon, accessible name and tooltip.

Disabled controls reduce contrast but keep labels readable; use `not-allowed`
only when it clarifies why. Loading preserves width and pairs a progress glyph
with a verb/phase. Do not rely on an endlessly spinning icon without text for
operations longer than two seconds.

### Fields

- Input/select height: 32px minimum; 6px radius; surface-2 fill; one border.
- Label: 11–12px secondary foreground; optional hint aligns opposite without
  replacing the label.
- Placeholder meets 4.5:1 and describes format, not a hidden requirement.
- Hover strengthens border subtly; focus uses a 2px accent outline or equivalent
  ring with 2px offset.
- Error uses error border + inline message + programmatic association. Preserve
  the user's value.
- Numeric fields state units in label or suffix. Do not encode seconds,
  milliseconds, frames, percent, or CRF only in placeholder text.
- Sliders expose current value in text and support arrow-key adjustment.
- Checkboxes/toggles use native semantics, visible focus, and explicit labels.

### Player and transport

- Player controls are outside the video so they do not cover the artifact.
- Control order: previous frame, play/pause, next frame, loop, mute; current
  frame/timecode follows; FPS aligns at the trailing edge.
- Play/pause is the local primary transport control but uses restrained accent,
  not a large marketing CTA.
- Icons change with state and titles/accessible labels include shortcuts.
- Frame/timecode use tabular numerals. Updates must not shift surrounding layout.
- When data is loading, reserve the preview geometry with a skeleton; do not
  show a lone spinner over empty space.
- Error state replaces the unusable preview with title, diagnostic, and recovery
  action while keeping the global header available.

### Timeline rows and segments

- Each row includes icon, name, visibility button, optional solo state, and
  temporal segments.
- Hovering a segment increases contrast and reveals its label/metadata without
  changing geometry.
- Clicking seeks to its first frame. Selected/current segments gain an outline
  or marker, not color alone.
- Hidden state changes eye icon and segment opacity. Solo adds a visible “Solo”
  indicator or distinct icon state.
- Empty tracks remain named and explain absence if useful; they do not collapse
  unpredictably while inspecting adjacent layers.
- Audio rows follow the same geometry even when audio editing lives in the
  inspector.

### Frame ruler, playhead, and range

- Tick density adapts to zoom; major ticks carry timecode, minor ticks are
  decorative.
- Clicking seeks. `Cmd/Ctrl + scroll`, `+`, `−`, and `0` zoom/fit without
  stealing ordinary scroll behavior.
- Enabling Range exposes text (“Range” or `in–out`), a soft indigo interval,
  and two clearly labeled handles.
- Handles support pointer drag and keyboard increments, expose `aria-valuemin`,
  `aria-valuemax`, and `aria-valuenow`, and cannot cross.
- Do not use a thick colored side border as the range treatment; the interval
  fill and handles communicate the selection.

### Inspector sections

- Prefer one rail divided by hairlines over a stack of identical cards.
- Section title combines a 14–16px Lucide icon with sentence-case text.
- Reset appears only when state differs from its source and says what it resets
  to where ambiguity exists.
- Editing state uses a textual “Edited” indicator in addition to accent.
- Long sections disclose advanced fields progressively but keep consequences
  and validation visible.

### Caption controls

- List only editable overlay types and identify them by type plus stable label.
- Textareas resize vertically within bounds and update preview without losing
  focus.
- Distinguish “preview only” from “apply to next render” adjacent to the edit,
  not in distant help text.
- Reset-one and reset-all are explicit and reversible where feasible.
- Never imply that caption changes rewrite `demo.ts` unless that capability is
  actually implemented and confirmed.

### Audio tracks

- The empty state teaches the add action and supported roles: music, narration,
  and sound effect.
- A repeated audio track may be a compact bordered item because it is an
  independent editable entity. Do not place that item inside another decorated
  card.
- Header exposes label, enabled/muted state, and remove action.
- Core fields: source, kind, volume, start/end, fade in/out, loop, and any
  supported duration behavior. Units are explicit.
- Persisting an audio override shows “Edited” and a clear “Reset to demo.ts”.
- Validation is per field plus a panel-level operational error when persistence
  fails.

### Render settings and queue

- Presets are the first choice; advanced fields follow in a compact grid.
- Render button summarizes range/caption inclusion when either differs from
  default.
- Job rows display status icon + status word, preset/options summary, progress
  where available, and contextual actions.
- Pending: clock + “Queued”; rendering: progress bar + percentage/phase;
  completed: check + “Completed” + Open folder; failed: alert icon + “Failed” +
  diagnostic/retry; canceled: stop icon + “Canceled”.
- Skeletons represent loading history. Empty queue explains that completed and
  active renders will appear here.
- Clearing finished jobs is secondary and never removes active work.

### Command palette

- Open with `Cmd/Ctrl + K`; use a real dialog pattern with labelled search.
- Width ≤560px, top offset around 15dvh, surface-3, 12px radius, strong border,
  and a scrim. A focused shadow is permitted here.
- Results group by task domain. Active row uses soft accent or hover surface,
  foreground text, and a trailing Enter affordance.
- Arrow keys navigate, Enter runs, Escape closes, pointer hover synchronizes
  selection, and focus returns to the invoker.
- Empty search says “No matching commands.” Do not invent suggestions unrelated
  to the current demo.
- Destructive/expensive commands preserve the same confirmation used by their
  visible controls.

### Shortcut reference

- Use a labelled dialog or non-modal help sheet, not an unstructured overlay.
- Group Playback, Timeline, Studio, and Layers.
- `<kbd>` uses surface-1, one border, 4px radius, readable 10–11px text.
- The list is maintained with the actual bindings; stale shortcut docs are an
  accessibility defect.

### Status, feedback, and empty states

- **Loading:** skeleton the pane structure; preserve orientation.
- **Empty:** name what is absent and offer the next valid action.
- **Success:** concise label/icon, no confetti or blocking celebration.
- **Warning:** explain consequence and keep safe work available.
- **Error:** stable title, specific message, recovery/retry, and copyable detail
  when technical diagnostics matter.
- **Progress:** determinate when percent/frames are known; otherwise show named
  phases. Announce significant transitions through a polite live region.
- Toasts are reserved for outcomes that do not need to remain in context.
  Field and job errors stay attached to the affected object.

---

## Motion

Motion is operational. The Studio loads directly into the task and never runs a
page entrance sequence.

| Interaction | Duration | Easing |
| --- | --- | --- |
| Color/background/border hover | `90ms` | `ease-out` |
| Button/row selection | `120ms` | `ease-out` |
| Popover/dialog opacity | `150ms` | `ease-out-quart` |
| Drawer/sheet transform | `180–200ms` | `ease-out-quint` |
| Progress value | `120ms` linear or direct | Must track real progress |

- Animate opacity and transform; do not animate layout dimensions during
  routine interaction.
- Playhead motion follows real playback and seeks immediately when commanded.
- Spinners are allowed for short indeterminate work; long work uses named
  phases and progress when available.
- No bounce, elastic, spring overshoot, decorative glow, or sustained ambient
  animation. The Landing Page aurora is a brand-scene exception and never moves
  into the Studio chrome.
- Hover motion cannot move controls away from the pointer.

### Reduced motion

Under `prefers-reduced-motion: reduce`:

- remove drawer transforms and use an instant state change or brief crossfade;
- remove spinner rotation where a static progress icon plus label suffices;
- zero nonessential hover/selection transitions;
- keep the playhead synchronized when playback is explicitly requested — it is
  content state, not decoration;
- retain all progress and status information in text.

---

## Interaction States

Use the following state grammar consistently:

| State | Visual treatment | Required companion |
| --- | --- | --- |
| Hover | surface lift or foreground promotion | Pointer only; no meaning alone |
| Focus-visible | 2px indigo outline, 2–3px offset | Never removed |
| Active/pressed | active neutral or darker accent | Immediate control feedback |
| Selected | soft accent + foreground + marker/icon | `aria-selected`/checked state |
| Disabled | reduced emphasis, stable readable label | Native disabled semantics + reason when useful |
| Loading | reserved geometry + skeleton/phase | Live status for long work |
| Success | success icon + text | Durable where outcome matters |
| Warning | warning icon + label + explanation | Action if remediation exists |
| Error | error icon/border + message | Programmatic association + recovery |
| Hidden | eye-off icon + reduced segment opacity | Accessible “Show …” label |
| Solo | solo marker/icon + explicit label | Other tracks visibly de-emphasized |

Do not use opacity alone for disabled text below contrast requirements. Do not
use indigo to mean both selection and an unrelated category within the same
component.

---

## Accessibility

Target **WCAG 2.1 AA** as a floor.

### Keyboard and focus

- All actions have keyboard access. Shortcuts accelerate, but never replace,
  visible controls.
- Natural tab order follows header → preview/transport → inspector → timeline.
- Composite widgets implement their expected pattern: arrow-key listbox/menu
  navigation, tabs with selected state, sliders and range handles with arrows.
- Dialogs trap focus, close with Escape, name themselves, and restore focus.
- Global shortcuts ignore input, textarea, select, and contenteditable targets
  unless explicitly scoped.

### Semantics

- Use `header`, `main`, `aside`, and labelled regions for workspace structure.
- Buttons are buttons; navigation is links; disclosure uses native or correctly
  implemented disclosure semantics.
- Icon-only buttons have specific accessible names (“Mute preview audio”, not
  “Volume”). Decorative icons are `aria-hidden`.
- Time-limited feedback uses `aria-live`; errors use `role="alert"` only when
  immediate interruption is justified.
- Player state, current frame, render progress, and selected range expose text
  alternatives without announcing every animation frame.

### Contrast and perception

- Meaningful text ≥4.5:1; large/bold text ≥3:1; component boundaries/focus ≥3:1
  against adjacent colors.
- Placeholders meet 4.5:1.
- Never encode state through color alone. Track color always pairs with icon and
  row name; statuses pair with icon and word; range pairs with handles/value.
- Validate accent and semantic palette under deuteranopia and protanopia.

### Pointer and touch

- Dense desktop targets are at least 32 × 32px; touch-oriented compact layouts
  use 40–44px.
- Drag operations have keyboard alternatives and do not require pixel-perfect
  grabbing.
- Tooltips open on focus as well as hover and do not contain required-only
  information.

---

## Iconography and Brand Assets

- Use `lucide-react`, 16px default, 14px in compact metadata, 18–20px for an
  empty/error-state lead icon.
- Stroke width remains consistent within each density tier.
- Icons support labels; they do not replace meaning except for universally
  familiar transport controls with accessible names and tooltips.
- Use official assets from the Landing Page `/brand/` family. On the dark
  canvas use the corresponding dark-canvas variant already established there.
- Do not create a separate Studio mascot, sketch icon, gradient mark, or
  clapperboard-derived identity.

---

## UX Copy

- Voice is technical, brief, and literal.
- Actions begin with verbs: “Render video”, “Re-capture”, “Open output folder”,
  “Reset to demo.ts”.
- Name phases and scope: “Capturing with Playwright…”, “Rendering 42%”, “Apply
  captions to next render”.
- Error copy states what failed, the relevant object/path when safe, and what to
  do next.
- Avoid “Oops”, “magic”, “awesome”, “successfully!” and vague “Something went
  wrong”.
- Use “Re-capture” consistently if that is the product term; do not alternate
  between rerun, refresh, regenerate, and recapture for the same operation.
- Keep source-of-truth wording explicit: “Reset to demo.ts”, “Studio override”,
  “Preview only”, “Apply to render”.

---

## Product Anti-patterns

In addition to all Landing Page anti-references:

- mint/cyan as an independent Studio brand accent;
- blue-tinted editor chrome that makes the Studio feel like another product;
- panels expressed as endless bordered cards or nested cards;
- 9–10px meaningful labels used to achieve artificial “pro tool” density;
- broad shadows plus borders on ordinary panels, previews, or buttons;
- icon-only destructive or expensive actions without label/tooltip/confirmation;
- custom editor affordances where a native button, field, disclosure, dialog,
  popover, or slider is clearer;
- modal-first settings and editing flows; prefer inline panels and progressive
  disclosure;
- motion that celebrates, decorates, or delays entry into the task;
- status communicated only through a track color, badge fill, spinner, or
  transient toast;
- controls for roadmap features that do not yet exist;
- any interaction that implies it wrote back to `demo.ts` when it did not.

---

## Implementation Context

The current implementation uses Next.js App Router, React, Tailwind CSS v4,
Remotion Player, Lucide icons, and CSS custom properties. These are contextual
facts, not permission to duplicate tokens or bypass this system.

When the Studio is refactored to follow this document:

1. reuse or share the Landing Page's Schibsted Grotesk loading strategy;
2. alias Studio semantic tokens to the canonical brand palette;
3. replace the legacy mint accent and blue-tinted neutrals;
4. consolidate repeated control states into accessible primitives;
5. preserve all existing product behavior while migrating visual treatment;
6. verify with keyboard, reduced-motion, contrast, narrow-window, and
   color-vision checks.

This documentation step does not authorize those code changes.

---

## Governance Checklist

Before a future Studio implementation or refactor is accepted, verify:

- Does the surface visibly share the Landing Page's black/indigo/Schibsted
  identity?
- Is every divergence justified by product function rather than editor cliché?
- Is the real preview still the dominant artifact?
- Can the user tell source, capture, preview override, persisted override, and
  output apart?
- Are all applicable component states designed and accessible?
- Does keyboard behavior match visible controls and the shortcut reference?
- Are errors specific, persistent enough to diagnose, and recoverable?
- Does the layout remain usable at wide, compact, narrow, and small widths?
- Does reduced motion preserve information and operation?
- Are semantic colors paired with icon/text and safe for common color-vision
  deficiencies?
- Were only implemented capabilities documented as available?

If any answer is no, the Studio is not yet consistent with this source of truth.
