import { byRole, byText, defineTargets } from "@democraft/core";

/**
 * Locators for the Democraft Studio UI.
 *
 * The Studio exposes no `data-testid` attributes, so every target is resolved
 * from semantic role or visible text. The accessible names below are copied
 * verbatim from `packages/studio/components/**` (see file:line notes) and are
 * the strings Playwright matches via `getByRole`/`getByText`.
 *
 * The capture runs against a Studio launched by the CLI
 * (`democraft studio examples/talento-saas/src/demo.ts`) on 127.0.0.1:3000,
 * with a Talento demo already loaded in its preview pane.
 */
export default defineTargets({
  // --- framing regions (used by establish / focus) ---------------------------
  // StudioShell.tsx:102  <section aria-label="Preview workspace">
  "preview-workspace": byRole("region", { name: "Preview workspace" }),
  // StudioShell.tsx:131  <section aria-label="Timeline">
  "timeline-region": byRole("region", { name: "Timeline" }),
  // StudioShell.tsx:114  <aside aria-label="Inspector">
  "inspector-region": byRole("complementary", { name: "Inspector" }),

  // --- workspace header -----------------------------------------------------
  // StudioShell.tsx:61  <button aria-label="Open inspector">  (open-only)
  "open-inspector": byRole("button", { name: "Open inspector" }),
  // StudioShell.tsx:107  scrim button  <button aria-label="Close inspector">
  // (also matched by the mobile-header X at StudioShell.tsx:120; the scrim is
  // the first match in DOM order and the one we click to dismiss the panel)
  "close-inspector": byRole("button", { name: "Close inspector" }),
  // StudioShell.tsx:70  <button aria-label="Open command palette">
  "open-command-palette": byRole("button", { name: "Open command palette" }),

  // --- inspector rail tabs (InspectorRail.tsx) ------------------------------
  // tab labels: "Captions" · "Audio" · "Auth" · "Render" (note: "Auth", not
  // "Authentication")
  "tab-captions": byRole("tab", { name: "Captions" }),
  "tab-audio": byRole("tab", { name: "Audio" }),
  "tab-auth": byRole("tab", { name: "Auth" }),
  "tab-render": byRole("tab", { name: "Render" }),

  // --- timeline toolbar (TimelineBody.tsx) ----------------------------------
  // TimelineBody.tsx:197  <button aria-label="Zoom timeline in">
  "zoom-in": byRole("button", { name: "Zoom timeline in" }),
  // TimelineBody.tsx:188  <button aria-label="Zoom timeline out">
  "zoom-out": byRole("button", { name: "Zoom timeline out" }),
  // TimelineBody.tsx:228  <button aria-label="Reset layer visibility">
  "reset-layers": byRole("button", { name: "Reset layer visibility" }),
  // TimelineBody.tsx:222  range toggle reads as "Range" while inactive
  "range-toggle": byText("Range"),
  // TrackRow.tsx:54  eye toggle reads "Hide Overlays track. Shift-click to
  // solo." while the lane is visible (the default on load).
  "toggle-overlays": byRole("button", {
    name: "Hide Overlays track. Shift-click to solo.",
  }),

  // --- inspector · captions (InspectorPanel.tsx) ----------------------------
  // The captions panel renders one <textarea> per caption active at the
  // playhead (or all captions when none are active). We expect exactly one
  // caption to be active at the seeked frame so the textbox is unique.
  // InspectorPanel.tsx:103  <textarea placeholder="Caption text…">
  "caption-text": byRole("textbox", { name: "" }),

  // --- inspector · render (RenderPanel.tsx) ---------------------------------
  // RenderPanel.tsx:86  <button> containing <Film/> + "Render video"
  "render-video-button": byRole("button", { name: "Render video" }),

  // --- command palette (CommandPalette.tsx, opened via the header trigger) --
  // CommandPalette.tsx:107  <input placeholder="Type a command…">
  "palette-search": byRole("textbox", { name: "" }),
  // useStudioCommands.tsx:89  label "Go to end"  (Playback group)
  "palette-go-to-end": byText("Go to end"),
  // useStudioCommands.tsx:184  label `Seek to scene: ${scene.id}`
  // scene.id comes from the loaded Talento timeline. With talento-short the
  // scenes are `abertura` and `sinais`; we seek to `sinais` (fromFrame 617) so
  // the playhead visibly jumps forward.
  "palette-seek-scene": byText("Seek to scene: sinais"),
});
