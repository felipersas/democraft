# Studio UI/UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the complete Democraft Studio work surface to conform to `packages/studio/PRODUCT.md` and `packages/studio/DESIGN.md` without changing business rules.

**Architecture:** Keep the existing Next.js/React state and server contracts intact. Migrate the visual layer to Studio-prefixed semantic tokens, introduce a small set of reusable workspace primitives, and restructure the shell around preview, inspector, transport, and timeline. Preserve existing event handlers and data flow while improving information hierarchy, accessibility, responsive behavior, and explicit source-of-truth language.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, CSS custom properties, Remotion Player, Lucide icons, Vitest, TypeScript.

---

### Task 1: Semantic design foundation

**Files:**
- Modify: `packages/studio/app/globals.css`
- Modify: `packages/studio/app/layout.tsx`
- Modify: `packages/studio/components/ui/button.tsx`
- Modify: `packages/studio/components/ui/Field.tsx`
- Modify: `packages/studio/components/ui/slider.tsx`

- [ ] Replace legacy mint/blue tokens with the normative near-black neutral and indigo Studio palette.
- [ ] Load Schibsted Grotesk through Next font handling and expose the interface/mono roles.
- [ ] Standardize focus, input, button, checkbox, scrollbar, typography, motion, and reduced-motion states.
- [ ] Run `pnpm --filter @democraft/studio typecheck`; expect exit code 0.

### Task 2: Persistent workspace shell

**Files:**
- Modify: `packages/studio/components/StudioShell.tsx`
- Modify: `packages/studio/components/StalenessBadge.tsx`
- Modify: `packages/studio/components/RecaptureButton.tsx`

- [ ] Rebuild the header hierarchy around identity, demo/source state, capture status, and global utilities.
- [ ] Restructure wide, compact, narrow, and review-mode layouts without changing mounted workflows.
- [ ] Make status labels explicit and preserve recapture confirmation/progress behavior.
- [ ] Verify natural focus order: header, preview/transport, inspector, timeline, transient layers.

### Task 3: Preview and transport

**Files:**
- Modify: `packages/studio/components/PlayerPane.tsx`
- Modify: `packages/studio/components/Transport.tsx`

- [ ] Make the real composition the dominant artifact with a quiet stage and restrained frame treatment.
- [ ] Replace generic loading/error copy with structural loading and explicit recovery affordance.
- [ ] Consolidate transport controls into primary playback, timecode/frame data, and secondary toggles.
- [ ] Preserve player synchronization, shortcut behavior, loop, mute, and frame stepping.

### Task 4: Inspector information architecture

**Files:**
- Create: `packages/studio/components/ui/InspectorSection.tsx`
- Modify: `packages/studio/components/InspectorPanel.tsx`
- Modify: `packages/studio/components/AudioPanel.tsx`
- Modify: `packages/studio/components/RenderPanel.tsx`
- Modify: `packages/studio/components/render/JobRow.tsx`
- Modify: `packages/studio/components/render/PresetField.tsx`
- Modify: `packages/studio/components/render/SettingsFields.tsx`

- [ ] Replace stacked decorated panels with one rail divided into semantic sections.
- [ ] Make caption scope, active-at-playhead state, preview-only/render consequence, edited state, and reset actions adjacent and explicit.
- [ ] Turn audio tracks into compact independent entities; show core fields first and timing/fades through native disclosure.
- [ ] Teach empty states, expose per-field errors programmatically, and label persisted Studio overrides.
- [ ] Present render presets before advanced controls and summarize included range/caption overrides at commitment.
- [ ] Keep job status, diagnostics, and contextual actions durable and text-labelled.

### Task 5: Timeline dock

**Files:**
- Modify: `packages/studio/components/timeline/TimelineBody.tsx`
- Modify: `packages/studio/components/timeline/TrackRow.tsx`
- Modify: `packages/studio/components/timeline/FrameRuler.tsx`
- Modify: `packages/studio/components/timeline/RangeHandle.tsx`

- [ ] Establish a compact toolbar, stable label column, shared row geometry, and neutral track field.
- [ ] Encode layer categories with documented semantic track colors while reserving indigo for selection/playhead/range.
- [ ] Add explicit hidden/solo labels and accessible names; keep shift-solo discoverable.
- [ ] Keep empty tracks visible and named.
- [ ] Make range handles keyboard-adjustable sliders that cannot cross.

### Task 6: Transient surfaces and responsive polish

**Files:**
- Modify: `packages/studio/components/CommandPalette.tsx`
- Modify: `packages/studio/components/ShortcutsOverlay.tsx`
- Modify: `packages/studio/app/globals.css`

- [ ] Align dialogs, scrims, keyboard focus, kbd styling, and selection states with the design contract.
- [ ] Verify inspector drawer/tab behavior and review-mode reachability at 1280, 1024, 800, and 640px.
- [ ] Verify reduced motion and no overflow at each breakpoint.

### Task 7: Verification and final polish

**Files:**
- Test: `packages/studio/**/*.test.ts`

- [ ] Run `pnpm --filter @democraft/studio typecheck`; expect exit code 0.
- [ ] Run `pnpm --filter @democraft/studio test`; expect all tests to pass.
- [ ] Run the local Studio and inspect wide, compact, narrow, loading, empty, error, edited, stale, ranged, and queued states.
- [ ] Check keyboard navigation, visible focus, dialogs, range handles, and global shortcut input guards.
- [ ] Review the governance checklist in `DESIGN.md` and close every remaining gap.
