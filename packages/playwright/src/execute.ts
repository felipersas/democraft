import { join } from "node:path";
import {
  canonicalScreenshotFilename,
  screenshotRelativePath,
} from "./screenshot-path";
import type {
  DemoIR,
  DemoStep,
  Diagnostic,
  RecordedStep,
  TargetSnapshot,
} from "@democraft/schema";
import { resolveTarget, resolveUrl } from "./locator";
import { targetDiagnostic, unresolvedTargetDiagnostic } from "./diagnostics";
import { waitForSettled } from "./settle";
import type { PageLike, SettleStrategy } from "./types";

type ExecuteStepArgs = {
  ir: DemoIR;
  page: PageLike;
  sceneId: string;
  step: DemoStep;
  timeoutMs: number;
  screenshotsPath: string;
  diagnostics: Diagnostic[];
  /**
   * How to wait for the page to settle before the screenshot. When `undefined`,
   * no settling runs and a fixed hold ({@link captureStepHoldMs}) is used
   * instead. Pass a resolved strategy to capture after the page quiets down.
   */
  settleStrategy?: Required<SettleStrategy>;
};

export async function executeStep(
  args: ExecuteStepArgs,
): Promise<RecordedStep> {
  const startedAtMs = Date.now();
  let targetSnapshot: TargetSnapshot | undefined;

  try {
    switch (args.step.kind) {
      case "browser.goto":
        await args.page.goto(resolveUrl(args.ir, args.step.path));
        break;
      case "browser.click": {
        const resolved = await resolveTarget(
          args.ir,
          args.page,
          args.step.target,
          args.timeoutMs,
        );
        targetSnapshot = resolved.snapshot;
        if (resolved.locator) {
          // SPAs (Next.js App Router, React Router, …) resolve client-side
          // navigation AFTER an <a>/<Link> click resolves: the click returns
          // before the new route is mounted, so the next step would read the
          // outgoing page. Capture the URL before clicking, then opportunisti-
          // cally wait for the route to change. The wait is best-effort — it
          // never throws and resolves quickly when no navigation happens
          // (dialogs, toggles), so non-navigating clicks are unaffected.
          const urlBefore = args.page.url();
          await resolved.locator.click();
          await waitForClientNavigation(args.page, urlBefore, args.timeoutMs);
        } else {
          args.diagnostics.push(
            unresolvedTargetDiagnostic(
              args.ir.id,
              args.sceneId,
              args.step.id,
              args.step.target,
              resolved.snapshot.attemptedLocators,
            ),
          );
        }
        break;
      }
      case "browser.fill": {
        const resolved = await resolveTarget(
          args.ir,
          args.page,
          args.step.target,
          args.timeoutMs,
        );
        targetSnapshot = resolved.snapshot;
        if (resolved.locator) {
          await resolved.locator.fill(args.step.value);
        } else {
          args.diagnostics.push(
            unresolvedTargetDiagnostic(
              args.ir.id,
              args.sceneId,
              args.step.id,
              args.step.target,
              resolved.snapshot.attemptedLocators,
            ),
          );
        }
        break;
      }
      case "browser.select": {
        const resolved = await resolveTarget(
          args.ir,
          args.page,
          args.step.target,
          args.timeoutMs,
        );
        targetSnapshot = resolved.snapshot;
        if (resolved.locator) {
          await resolved.locator.selectOption(args.step.value);
        } else {
          args.diagnostics.push(
            unresolvedTargetDiagnostic(
              args.ir.id,
              args.sceneId,
              args.step.id,
              args.step.target,
              resolved.snapshot.attemptedLocators,
            ),
          );
        }
        break;
      }
      case "assert.visible": {
        const resolved = await resolveTarget(
          args.ir,
          args.page,
          args.step.target,
          args.timeoutMs,
        );
        targetSnapshot = resolved.snapshot;
        if (!targetSnapshot.visible) {
          args.diagnostics.push(
            targetDiagnostic(
              args.ir.id,
              args.sceneId,
              args.step.id,
              args.step.target,
              "Target is not visible.",
            ),
          );
        }
        break;
      }
      case "assert.text": {
        const resolved = await resolveTarget(
          args.ir,
          args.page,
          args.step.target,
          args.timeoutMs,
        );
        targetSnapshot = resolved.snapshot;
        const text = await resolved.locator?.textContent();
        if (!text?.includes(args.step.text)) {
          args.diagnostics.push(
            targetDiagnostic(
              args.ir.id,
              args.sceneId,
              args.step.id,
              args.step.target,
              `Target text does not include "${args.step.text}".`,
            ),
          );
        }
        break;
      }
      case "assert.url":
        if (!args.page.url().includes(args.step.path)) {
          args.diagnostics.push({
            code: "MD201",
            severity: "error",
            message: `Current URL "${args.page.url()}" does not include "${args.step.path}".`,
            demoId: args.ir.id,
            sceneId: args.sceneId,
            stepId: args.step.id,
          });
        }
        break;
      case "camera.establish":
      case "camera.focus":
      case "overlay.callout":
        if ("target" in args.step && args.step.target) {
          targetSnapshot = (
            await resolveTarget(
              args.ir,
              args.page,
              args.step.target,
              args.timeoutMs,
            )
          ).snapshot;
        }
        break;
      case "overlay.caption":
      case "timeline.hold":
      case "timeline.transition":
      case "cue":
        break;
    }
  } catch (error) {
    args.diagnostics.push({
      code: "MD201",
      severity: "error",
      message:
        error instanceof Error ? error.message : "Step execution failed.",
      demoId: args.ir.id,
      sceneId: args.sceneId,
      stepId: args.step.id,
    });
  }

  // Wait for the page to settle before the screenshot. When a settle strategy
  // is configured, gate on DOM + visual stability (the page stopped changing)
  // so the screenshot reflects the fully-rendered view — not a half-loaded
  // transition frame. Steps whose duration is author-controlled (holds,
  // captions, callouts) still use their explicit timing as a floor so the
  // narrative pace the author wrote is preserved; action steps (goto, click,
  // fill, select, asserts, camera) settle and capture as soon as the page is
  // quiet, cutting dead air on fast pages.
  if (args.settleStrategy && stepIsActionDriven(args.step)) {
    await waitForSettled(args.page, args.settleStrategy);
  }
  // Author-controlled steps (and the fallback when settle is disabled) keep a
  // fixed hold so the captured frame holds long enough to read.
  if (!args.settleStrategy || !stepIsActionDriven(args.step)) {
    await args.page.waitForTimeout?.(captureStepHoldMs(args.step));
  }

  let screenshotPath: string | undefined;
  const screenshotFilename = canonicalScreenshotFilename(
    args.sceneId,
    args.step.id,
  );
  try {
    await args.page.screenshot?.({
      path: join(args.screenshotsPath, screenshotFilename),
      // Capture the viewport, not the full document. A full-page screenshot
      // grows with page content (a tall dashboard yields a 1440×3244 PNG while
      // a short page yields 1440×900), so consecutive steps would be captured
      // at different aspect ratios and the renderer's fixed-size stage would
      // re-scale every cut — visible as flicker/flash between steps. The
      // viewport is constant (matches `environment.viewport`), so every
      // screenshot lands at identical dimensions and maps 1:1 onto the stage.
      // Element bounding boxes from Playwright are viewport-relative, so camera
      // focus targets line up with what the screenshot actually shows.
      fullPage: false,
    });
    if (args.page.screenshot) {
      screenshotPath = screenshotRelativePath(args.sceneId, args.step.id);
    }
  } catch (error) {
    args.diagnostics.push({
      code: "MD201",
      severity: "warning",
      message:
        error instanceof Error
          ? `Screenshot failed: ${error.message}`
          : "Screenshot failed.",
      demoId: args.ir.id,
      sceneId: args.sceneId,
      stepId: args.step.id,
    });
  }

  return {
    stepId: args.step.id,
    sceneId: args.sceneId,
    kind: args.step.kind,
    startedAtMs,
    endedAtMs: Date.now(),
    targetSnapshot,
    url: args.page.url(),
    screenshotPath,
  };
}

/**
 * Steps whose on-screen content depends on the page state (navigation, inputs,
 * asserts, camera moves). These benefit from settling — wait for the page to
 * finish rendering before capturing, instead of a fixed delay.
 *
 * Steps NOT in this set (`timeline.hold`, `overlay.caption`, `overlay.callout`,
 * `timeline.transition`, `cue`) are author-paced: their duration is part of
 * the narrative. They use {@link captureStepHoldMs} so the captured frame
 * matches the timing the author wrote.
 */
export function stepIsActionDriven(step: DemoStep): boolean {
  switch (step.kind) {
    case "browser.goto":
    case "browser.click":
    case "browser.fill":
    case "browser.select":
    case "assert.visible":
    case "assert.text":
    case "assert.url":
    case "camera.establish":
    case "camera.focus":
    case "overlay.callout":
      return true;
    case "timeline.hold":
    case "timeline.transition":
    case "overlay.caption":
    case "cue":
      return false;
  }
}

export function captureStepHoldMs(step: DemoStep): number {
  switch (step.kind) {
    case "timeline.hold":
      return step.durationMs;
    case "timeline.transition":
      return step.durationMs ?? 500;
    case "overlay.caption":
      return Math.max(1200, step.text.length * 45);
    case "overlay.callout":
      return Math.max(
        1800,
        `${step.title} ${step.description ?? ""}`.trim().length * 45,
      );
    case "camera.establish":
      return 700;
    case "camera.focus":
      return 1100;
    case "browser.click":
      return 650;
    case "browser.fill":
    case "browser.select":
      return 700;
    case "browser.goto":
      return 700;
    case "assert.visible":
    case "assert.text":
    case "assert.url":
      return 300;
    case "cue":
      return 1;
  }
}

/**
 * How long to wait for client-side navigation after a click before giving up.
 * SPAs (Next App Router in particular) can take several seconds to swap the
 * route on a cold code-split chunk, so this is generous; the wait resolves the
 * instant the URL changes and never throws. Tuned above the settle timeout so
 * a slow route change isn't mistaken for a non-navigating click.
 */
const CLIENT_NAV_TIMEOUT_MS = 6000;
const CLIENT_NAV_POLL_MS = 150;

/**
 * Best-effort wait for a client-side (SPA) navigation triggered by a click.
 *
 * After clicking an in-app link, the new route mounts asynchronously. We poll
 * `page.url()` for a change, then let `waitForLoadState("domcontentloaded")`
 * settle the new view. The wait is best-effort — it never throws and resolves
 * quickly when no navigation happens (dialogs, toggles), so non-navigating
 * clicks are unaffected. Uses an unconditional timer-based sleep so it stays
 * cooperative even when the page mock lacks `waitForTimeout`.
 */
export async function waitForClientNavigation(
  page: Pick<PageLike, "url" | "waitForLoadState">,
  urlBefore: string,
  timeoutMs: number = CLIENT_NAV_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.url() !== urlBefore) {
      // Navigation is underway — let the new view settle.
      await withTimeout(
        page.waitForLoadState?.("domcontentloaded"),
        CLIENT_NAV_TIMEOUT_MS,
      );
      return;
    }
    await sleep(CLIENT_NAV_POLL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTimeout(
  promise: Promise<unknown> | undefined,
  ms: number,
): Promise<void> {
  if (!promise) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
