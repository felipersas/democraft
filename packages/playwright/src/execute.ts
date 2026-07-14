import { join } from "node:path";
import type {
  DemoIR,
  DemoStep,
  Diagnostic,
  RecordedStep,
  TargetSnapshot,
} from "@democraft/schema";
import { resolveTarget, resolveUrl } from "./locator";
import { targetDiagnostic, unresolvedTargetDiagnostic } from "./diagnostics";
import type { PageLike } from "./types";

type ExecuteStepArgs = {
  ir: DemoIR;
  page: PageLike;
  sceneId: string;
  step: DemoStep;
  timeoutMs: number;
  screenshotsPath: string;
  diagnostics: Diagnostic[];
};

export async function executeStep(args: ExecuteStepArgs): Promise<RecordedStep> {
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
          await resolved.locator.click();
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

  await args.page.waitForTimeout?.(captureStepHoldMs(args.step));

  await args.page
    .screenshot?.({
      path: join(args.screenshotsPath, `${args.sceneId}-${args.step.id}.png`),
      fullPage: true,
    })
    .catch(() => undefined);

  return {
    stepId: args.step.id,
    sceneId: args.sceneId,
    kind: args.step.kind,
    startedAtMs,
    endedAtMs: Date.now(),
    targetSnapshot,
    url: args.page.url(),
  };
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
