import type { CapturedStep, DemoScene } from "@democraft/core";

export function createSceneCapture(steps: CapturedStep[]): DemoScene {
  const push = (step: CapturedStep) => {
    steps.push(step);
    return Promise.resolve();
  };

  return {
    goto: (path, options) =>
      push({ kind: "browser.goto", id: options?.id, path }),
    click: (target, options) =>
      push({ kind: "browser.click", id: options?.id, target }),
    fill: (target, value, options) =>
      push({ kind: "browser.fill", id: options?.id, target, value }),
    select: (target, value, options) =>
      push({ kind: "browser.select", id: options?.id, target, value }),
    expectVisible: (target, options) =>
      push({ kind: "assert.visible", id: options?.id, target }),
    expectText: (target, text, options) =>
      push({ kind: "assert.text", id: options?.id, target, text }),
    expectUrl: (path, options) =>
      push({ kind: "assert.url", id: options?.id, path }),
    establish: (target, options) =>
      push({ kind: "camera.establish", id: options?.id, target }),
    focus: (target, options) =>
      push({
        kind: "camera.focus",
        id: options?.id,
        target,
        padding: options?.padding,
      }),
    hold: (duration, options) =>
      push({ kind: "timeline.hold", id: options?.id, duration }),
    transition: (options) =>
      push({
        kind: "timeline.transition",
        id: options?.id,
        transition: options?.type,
        duration: options?.duration,
      }),
    caption: (text, options) =>
      push({
        kind: "overlay.caption",
        id: options?.id,
        text,
        renderer: options?.renderer,
      }),
    callout: (target, options) =>
      push({
        kind: "overlay.callout",
        id: options.id,
        target,
        title: options.title,
        description: options.description,
        renderer: options.renderer,
      }),
    visual: (visual, props, options) =>
      push({
        kind: "overlay.visual",
        id: options?.id,
        visual,
        props,
        duration: options?.duration,
      }),
    cue: (name, options) => push({ kind: "cue", id: options?.id, name }),
  };
}
