import { defineDemo, defineVisual } from "@democraft/core";
import { SoftBlurIn } from "@democraft/remotion/client";
import { FeatureChips } from "./components/feature-chips";
import { LowerThird } from "./components/lower-third";
import { OutroLockup } from "./components/outro-lockup";
import { PipelineFlow } from "./components/pipeline-flow";
import targets from "./targets";

/**
 * Studio showcase — the Democraft Studio, demonstrated with Democraft.
 *
 * Captures the Studio UI itself (a Talento demo loaded in the preview pane)
 * and walks through preview, command palette, timeline, live caption editing,
 * scene seek, and render. Intended as the hero video on the landing page.
 *
 * Run against a Studio launched by the CLI with the Talento demo loaded:
 *
 *   pnpm exec democraft studio ../talento-saas/src/demo.ts   # 127.0.0.1:3000
 *
 * then in another shell:
 *
 *   pnpm exec democraft capture src/demo.ts
 *   pnpm exec democraft render  src/demo.ts
 *
 * No audio this round — narration is layered on afterwards.
 *
 * Composition notes
 * -----------------
 * The capture is the hero (the real Studio, big and legible). Overlays layer
 * on top: kinetic captions, glass/dark callouts, and custom full-frame
 * visuals (lower-thirds, capability chips, the pipeline model, the outro
 * lockup). One indigo accent (#5e6ad2), sentence case, no glow — remocn
 * design discipline.
 */

const STUDIO_URL = process.env.DEMOCRAFT_STUDIO_URL ?? "http://127.0.0.1:3000";

export default defineDemo({
  id: "studio-showcase",
  title: "Democraft Studio — your demo, directed",
  source: {
    baseUrl: STUDIO_URL,
    initialPath: "/",
  },
  visuals: {
    "remocn.soft-blur-in": defineVisual(SoftBlurIn),
    "local.lower-third": defineVisual(LowerThird),
    "local.feature-chips": defineVisual(FeatureChips),
    "local.pipeline-flow": defineVisual(PipelineFlow),
    "local.outro-lockup": defineVisual(OutroLockup),
  },
  targets,
  async run({ demo }) {
    // ─────────────────────────────────────────────────────────────────────
    // 1 · Hook + positioning
    // The workspace, alive: Talento auto-plays in the preview. Establish the
    // full frame, then land the positioning line over it.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("workspace", async (scene) => {
      await scene.goto("/");
      await scene.expectVisible("preview-workspace");
      await scene.establish("preview-workspace");
      await scene.visual(
        "local.lower-third",
        {
          kicker: "Open-source demos as code",
          headline: "Your demo, directed.",
          headlineSize: 76,
          kickerSize: 22,
          speed: 1,
        },
        { duration: "2400ms" },
      );
      await scene.hold("700ms");
    });

    await demo.scene("positioning", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "500ms" });
      await scene.visual(
        "local.feature-chips",
        {
          position: "top",
          chips: [
            { label: "Playwright capture" },
            { label: "Remotion render" },
            { label: "Frame-accurate", accent: true },
          ],
          fontSize: 30,
          speed: 1,
        },
        { duration: "2200ms" },
      );
      await scene.caption("One TypeScript file. The whole walkthrough.", {
        renderer: "remocn.kinetic-title",
      });
      await scene.hold("700ms");
    });

    // ─────────────────────────────────────────────────────────────────────
    // 2 · Frame-accurate preview + command palette
    // Open the palette, filter to "end", and jump to the last frame. The
    // palette's command run auto-closes it, so we never leave it open.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("preview", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "400ms" });
      await scene.focus("preview-workspace");
      await scene.caption("Frame-accurate preview of the real captured flow.", {
        renderer: "remocn.kinetic-title",
      });
      await scene.hold("600ms");
      // Open ⌘K, type "end", and run "Go to end" — the palette closes itself.
      await scene.click("open-command-palette");
      await scene.hold("500ms");
      await scene.fill("palette-search", "end");
      await scene.hold("600ms");
      await scene.click("palette-go-to-end");
      await scene.hold("900ms");
    });

    // ─────────────────────────────────────────────────────────────────────
    // 3 · A real editor timeline
    // Zoom in for detail, toggle the overlays lane (the preview updates
    // live), reset visibility, and turn on the render-range band.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("timeline", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "400ms" });
      await scene.focus("timeline-region");
      await scene.caption(
        "A real timeline — camera, cursor, overlays, audio.",
        {
          renderer: "remocn.kinetic-title",
        },
      );
      await scene.hold("700ms");
      await scene.click("zoom-in");
      await scene.hold("600ms");
      await scene.click("toggle-overlays");
      await scene.callout("timeline-region", {
        title: "Toggle any layer",
        description:
          "Hide camera, cursor, or overlays to inspect the raw capture. Preview only — never re-renders.",
        renderer: "remocn.callout-dark",
      });
      await scene.hold("800ms");
      await scene.click("reset-layers");
      await scene.hold("600ms");
      await scene.click("range-toggle");
      await scene.hold("900ms");
    });

    // ─────────────────────────────────────────────────────────────────────
    // 4 · Captions, edited live (the core differentiator)
    // Open the inspector, edit presentation copy at the playhead — the
    // "Edited" pill appears — and emphasize that the capture is never touched.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("captions", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "400ms" });
      await scene.click("open-inspector");
      await scene.hold("600ms");
      await scene.click("tab-captions");
      await scene.caption("Edit captions without re-capturing.", {
        renderer: "remocn.kinetic-title",
      });
      await scene.hold("700ms");
      await scene.fill(
        "caption-text",
        "Every word stays in sync with the captured flow.",
      );
      await scene.callout("inspector-region", {
        title: "Edited, not overwritten",
        description:
          "Overrides live in the Studio and only reach a render when you opt in. demo.ts is never modified.",
        renderer: "remocn.glass-callout",
      });
      await scene.hold("1000ms");
      await scene.click("close-inspector");
      await scene.hold("500ms");
    });

    // ─────────────────────────────────────────────────────────────────────
    // 5 · Scenes, on command
    // The palette generates one seek command per scene. Filter to "scene" and
    // jump — the playhead moves and the preview seeks.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("scenes", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "400ms" });
      await scene.click("open-command-palette");
      await scene.hold("600ms");
      await scene.fill("palette-search", "scene");
      await scene.caption("Jump to any scene, instantly.", {
        renderer: "remocn.kinetic-title",
      });
      await scene.hold("700ms");
      // Running the seek command closes the palette.
      await scene.click("palette-seek-scene");
      await scene.hold("1100ms");
    });

    // ─────────────────────────────────────────────────────────────────────
    // 6 · Render, your way
    // Show the render presets + queue. We deliberately do NOT click "Render
    // video" — a real render spawns a headless Chrome job that would stall
    // the capture.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("render", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "400ms" });
      await scene.click("open-inspector");
      await scene.hold("500ms");
      await scene.click("tab-render");
      await scene.caption("Render to MP4 — Quick, Balanced, or Final.", {
        renderer: "remocn.kinetic-title",
      });
      await scene.hold("800ms");
      await scene.callout("inspector-region", {
        title: "Three presets, one click",
        description:
          "Quick for a draft, Balanced for review, Final for shipping. Queue renders and keep working.",
        renderer: "remocn.callout-dark",
      });
      await scene.expectVisible("render-video-button");
      await scene.hold("1100ms");
      await scene.click("close-inspector");
      await scene.hold("500ms");
    });

    // ─────────────────────────────────────────────────────────────────────
    // 7 · Pipeline model + outro
    // Pull back to the full workspace, surface the Define→Capture→Direct→
    // Render model, then land the closing lockup.
    // ─────────────────────────────────────────────────────────────────────
    await demo.scene("pipeline", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "500ms" });
      await scene.establish("preview-workspace");
      await scene.visual(
        "local.pipeline-flow",
        {
          steps: [
            { label: "Define" },
            { label: "Capture" },
            { label: "Direct" },
            { label: "Render" },
          ],
          stepFrames: 18,
          speed: 1,
        },
        { duration: "2600ms" },
      );
      await scene.hold("600ms");
    });

    await demo.scene("outro", async (scene) => {
      await scene.transition({ type: "crossfade", duration: "600ms" });
      await scene.establish("preview-workspace");
      await scene.visual(
        "local.outro-lockup",
        {
          wordmark: "Democraft",
          tagline: "Demos as code.",
          footnote: "Playwright captures. Remotion renders.",
          speed: 1,
        },
        { duration: "3000ms" },
      );
      await scene.hold("800ms");
    });
  },
});
