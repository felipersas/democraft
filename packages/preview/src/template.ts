import { escapeHtml, safeJson } from "./escape";
import type { PreviewInput } from "./types";

export function renderPreviewHtml(input: PreviewInput): string {
  const videoSrc = input.videoSrc ?? input.manifest.recording?.path ?? "";
  const recording = input.manifest.recording ?? { width: 1440, height: 900 };
  const screenshotSrcByStepId = input.screenshotSrcByStepId ?? {};

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.timeline.demoId)} preview</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #10131a;
        --panel: #181d26;
        --line: #2c3545;
        --text: #edf2ff;
        --muted: #99a6bd;
        --accent: #79e3c7;
        --warm: #f5c96f;
        --danger: #ff7b8c;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% 0%, rgb(121 227 199 / 14%), transparent 34rem),
          linear-gradient(135deg, #0d1017, #151925 56%, #11131a);
        color: var(--text);
        font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .app {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 20px;
        padding: 22px;
        min-height: 100vh;
      }

      .stage-shell,
      .panel {
        border: 1px solid var(--line);
        background: rgb(24 29 38 / 88%);
        box-shadow: 0 24px 90px rgb(0 0 0 / 32%);
      }

      .stage-shell {
        border-radius: 8px;
        overflow: hidden;
        align-self: start;
      }

      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
      }

      h1 {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .meta {
        color: var(--muted);
        font-size: 12px;
      }

      .stage {
        position: relative;
        background: #07090d;
      }

      .media {
        display: block;
        width: 100%;
        aspect-ratio: ${recording.width} / ${recording.height};
        object-fit: contain;
        background: #05070a;
      }

      .reference-video {
        display: none;
      }

      .layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .target-box {
        position: absolute;
        border: 2px solid var(--warm);
        box-shadow: 0 0 0 1px rgb(0 0 0 / 50%), 0 0 28px rgb(245 201 111 / 42%);
        border-radius: 6px;
      }

      .cursor {
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        translate: -50% -50%;
        background: var(--accent);
        box-shadow: 0 0 0 7px rgb(121 227 199 / 18%), 0 0 30px rgb(121 227 199 / 65%);
      }

      .caption,
      .callout {
        position: absolute;
        border: 1px solid rgb(255 255 255 / 16%);
        background: rgb(11 14 20 / 82%);
        backdrop-filter: blur(12px);
        border-radius: 8px;
      }

      .caption {
        left: 50%;
        bottom: 28px;
        translate: -50% 0;
        max-width: min(720px, 80%);
        padding: 14px 18px;
        font-size: 18px;
        text-align: center;
      }

      .callout {
        padding: 14px 16px;
        max-width: 320px;
        box-shadow: 0 18px 50px rgb(0 0 0 / 30%);
      }

      .callout strong {
        display: block;
        margin-bottom: 6px;
        color: var(--accent);
      }

      .callout p {
        margin: 0;
        color: var(--muted);
        line-height: 1.45;
      }

      .panel {
        border-radius: 8px;
        padding: 16px;
        max-height: calc(100vh - 44px);
        overflow: auto;
      }

      .readout {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin: 14px 0 18px;
      }

      .metric {
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #111620;
      }

      .metric b {
        display: block;
        margin-top: 4px;
        font-size: 18px;
      }

      .scene {
        border-top: 1px solid var(--line);
        padding: 12px 0;
      }

      .scene h2 {
        margin: 0 0 8px;
        font-size: 13px;
        color: var(--accent);
      }

      .step {
        display: grid;
        grid-template-columns: 70px 1fr;
        gap: 10px;
        padding: 5px 0;
        color: var(--muted);
        font-size: 12px;
      }

      .active-step {
        color: var(--text);
      }

      .active-step .range {
        color: var(--warm);
      }

      .controls {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px 16px;
        border-top: 1px solid var(--line);
        background: #0c1018;
      }

      button {
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #141a24;
        color: var(--text);
        font: inherit;
        padding: 8px 12px;
        cursor: pointer;
      }

      input[type="range"] {
        width: 100%;
        accent-color: var(--accent);
      }

      @media (max-width: 980px) {
        .app {
          grid-template-columns: 1fr;
        }

        .panel {
          max-height: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="stage-shell">
        <div class="top">
          <h1>${escapeHtml(input.timeline.demoId)}</h1>
          <div class="meta"><span id="frame">0</span> / ${input.timeline.durationInFrames} frames</div>
        </div>
        <div class="stage" id="stage">
          <img class="media" id="shot" alt="" />
          <video class="reference-video" id="video" src="${escapeHtml(videoSrc)}" muted playsinline preload="metadata"></video>
          <div class="layer" id="layer"></div>
        </div>
        <div class="controls">
          <button id="play" type="button">Play</button>
          <input id="scrub" type="range" min="0" max="${input.timeline.durationInFrames}" value="0" />
          <div class="meta"><span id="time">0.00</span>s / ${(input.timeline.durationInFrames / input.timeline.fps).toFixed(2)}s</div>
        </div>
      </section>
      <aside class="panel">
        <h1>Resolved Preview</h1>
        <div class="readout">
          <div class="metric"><span>FPS</span><b>${input.timeline.fps}</b></div>
          <div class="metric"><span>Scenes</span><b>${input.timeline.scenes.length}</b></div>
          <div class="metric"><span>Tracks</span><b>${input.timeline.camera.length + input.timeline.cursor.length + input.timeline.overlays.length}</b></div>
        </div>
        <div id="steps"></div>
      </aside>
    </main>
    <script>
      const timeline = ${safeJson(input.timeline)};
      const recording = ${safeJson(recording)};
      const screenshotSrcByStepId = ${safeJson(screenshotSrcByStepId)};
      const shot = document.getElementById("shot");
      const layer = document.getElementById("layer");
      const frameLabel = document.getElementById("frame");
      const stepsRoot = document.getElementById("steps");
      const playButton = document.getElementById("play");
      const scrub = document.getElementById("scrub");
      const timeLabel = document.getElementById("time");
      let frame = 0;
      let playing = false;
      let playStartedAt = 0;
      let playStartedFrame = 0;
      const allSteps = timeline.scenes.flatMap((scene) => scene.steps);

      function active(track, frame) {
        return frame >= track.fromFrame && frame < track.fromFrame + track.durationInFrames;
      }

      function scaleBox(box) {
        const rect = shot.getBoundingClientRect();
        const sx = rect.width / recording.width;
        const sy = rect.height / recording.height;
        return {
          x: box.x * sx,
          y: box.y * sy,
          width: box.width * sx,
          height: box.height * sy
        };
      }

      function div(className, styles = {}, html = "") {
        const element = document.createElement("div");
        element.className = className;
        Object.assign(element.style, styles);
        element.innerHTML = html;
        return element;
      }

      function render(frame) {
        const visibleStep = [...allSteps].reverse().find((step) => frame >= step.fromFrame);
        const screenshotSrc = visibleStep ? screenshotSrcByStepId[visibleStep.stepId] : undefined;
        if (screenshotSrc && shot.src !== screenshotSrc) shot.src = screenshotSrc;
        frameLabel.textContent = String(frame);
        timeLabel.textContent = (frame / timeline.fps).toFixed(2);
        scrub.value = String(frame);
        layer.replaceChildren();

        for (const camera of timeline.camera.filter((track) => active(track, frame))) {
          if (!camera.boundingBox) continue;
          const box = scaleBox(camera.boundingBox);
          layer.append(div("target-box", {
            left: box.x + "px",
            top: box.y + "px",
            width: box.width + "px",
            height: box.height + "px"
          }));
        }

        for (const cursor of timeline.cursor.filter((track) => active(track, frame))) {
          if (!cursor.point) continue;
          const point = scaleBox({ x: cursor.point.x, y: cursor.point.y, width: 0, height: 0 });
          layer.append(div("cursor", { left: point.x + "px", top: point.y + "px" }));
        }

        for (const overlay of timeline.overlays.filter((track) => active(track, frame))) {
          if (overlay.kind === "caption") {
            layer.append(div("caption", {}, escapeHtmlJs(overlay.text)));
          } else if (overlay.kind === "callout") {
            const box = overlay.boundingBox ? scaleBox(overlay.boundingBox) : { x: 40, y: 40, width: 0, height: 0 };
            layer.append(div("callout", {
              left: Math.min(box.x + box.width + 18, shot.clientWidth - 340) + "px",
              top: Math.max(18, box.y) + "px"
            }, "<strong>" + escapeHtmlJs(overlay.title) + "</strong>" + (overlay.description ? "<p>" + escapeHtmlJs(overlay.description) + "</p>" : "")));
          }
        }

        document.querySelectorAll(".step").forEach((node) => {
          const from = Number(node.dataset.from);
          const to = Number(node.dataset.to);
          node.classList.toggle("active-step", frame >= from && frame < to);
        });
      }

      function renderSteps() {
        stepsRoot.replaceChildren(...timeline.scenes.map((scene) => {
          const section = div("scene");
          section.append(div("", {}, "<h2>" + scene.id + " · " + scene.fromFrame + "-" + (scene.fromFrame + scene.durationInFrames) + "</h2>"));
          for (const step of scene.steps) {
            const node = div("step", {}, "<span class='range'>" + step.fromFrame + "+" + step.durationInFrames + "</span><span>" + step.kind + "</span>");
            node.dataset.from = String(step.fromFrame);
            node.dataset.to = String(step.fromFrame + step.durationInFrames);
            section.append(node);
          }
          return section;
        }));
      }

      function setFrame(nextFrame) {
        frame = Math.max(0, Math.min(timeline.durationInFrames, Math.round(nextFrame)));
        render(frame);
      }

      function tick(now) {
        if (!playing) return;
        setFrame(playStartedFrame + ((now - playStartedAt) / 1000) * timeline.fps);
        if (frame >= timeline.durationInFrames) {
          playing = false;
          playButton.textContent = "Play";
          return;
        }
        requestAnimationFrame(tick);
      }

      function escapeHtmlJs(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[char]);
      }

      renderSteps();
      render(0);
      playButton.addEventListener("click", () => {
        playing = !playing;
        playButton.textContent = playing ? "Pause" : "Play";
        playStartedFrame = frame >= timeline.durationInFrames ? 0 : frame;
        playStartedAt = performance.now();
        if (playing) requestAnimationFrame(tick);
      });
      scrub.addEventListener("input", () => {
        playing = false;
        playButton.textContent = "Play";
        setFrame(Number(scrub.value));
      });
      window.addEventListener("resize", () => render(frame));
    </script>
  </body>
</html>`;
}
