import type { DemoIR, DemoStep } from "@democraft/schema";

export function inspectIR(ir: DemoIR): string {
  const lines = [ir.title.toUpperCase(), ""];

  for (const scene of ir.scenes) {
    lines.push(`Scene: ${scene.id}`, "");
    scene.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${describeStep(step)}`);
    });
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function describeStep(step: DemoStep): string {
  switch (step.kind) {
    case "browser.goto":
      return `Go to "${step.path}"`;
    case "browser.click":
      return `Click target "${step.target}"`;
    case "browser.fill":
      return `Fill target "${step.target}" with "${step.value}"`;
    case "browser.select":
      return `Select "${step.value}" in target "${step.target}"`;
    case "assert.visible":
      return `Expect target "${step.target}" to be visible`;
    case "assert.text":
      return `Expect target "${step.target}" to contain "${step.text}"`;
    case "assert.url":
      return `Expect URL "${step.path}"`;
    case "camera.establish":
      return step.target
        ? `Establish camera on "${step.target}"`
        : "Establish camera";
    case "camera.focus":
      return `Focus camera on "${step.target}"`;
    case "timeline.hold":
      return `Hold for ${step.durationMs}ms`;
    case "timeline.transition":
      return step.durationMs
        ? `Transition with ${step.transition} for ${step.durationMs}ms`
        : `Transition with ${step.transition}`;
    case "overlay.caption":
      return `Show caption "${step.text}"`;
    case "overlay.callout":
      return `Show callout "${step.title}" on "${step.target}"`;
    case "cue":
      return `Create cue "${step.name}"`;
  }
}
