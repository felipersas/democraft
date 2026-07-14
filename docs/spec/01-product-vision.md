# Product Vision

## Problem

Creating polished product demonstrations usually requires several disconnected steps:

- manually recording the screen;
- editing cursor movement;
- adding zooms and camera motion;
- inserting callouts and captions;
- repeating the recording when the product changes;
- recreating the same workflow for vertical, square, and landscape formats;
- manually synchronizing all visual elements.

Traditional screen recorders produce flattened video. Traditional browser automation produces test output, not a cinematic composition. Remotion provides programmable video, but does not by itself understand a real application workflow.

## Opportunity

Create a framework that transforms a real product journey into a structured, editable, renderable media project.

The framework should understand:

- what happened in the browser;
- which product elements were involved;
- why each scene exists;
- what the camera should emphasize;
- where the cursor should move;
- what should be explained visually;
- how the same journey should adapt to multiple formats.

## Product definition

A framework for creating deterministic product demos with a semantic TypeScript API.

The same authored demo should be usable for:

- release videos;
- onboarding tutorials;
- documentation;
- landing-page demos;
- social clips;
- sales demonstrations;
- feature announcements;
- changelog videos;
- automated launch content.

## Product promise

A developer or coding agent should be able to write:

```ts
await scene.click("new-project-button");
await scene.fill("project-name-input", "Oddworks");
await scene.focus("project-card");
await scene.callout("project-card", {
  title: "Your project is ready",
});
```

The framework should resolve:

- Playwright locators;
- automatic waits;
- browser execution;
- recording timestamps;
- target geometry;
- synthetic cursor movement;
- camera framing;
- Remotion sequences;
- callout timing;
- output-specific adaptations.

## Positioning

> Build deterministic product demos from your real application using TypeScript, Playwright, and Remotion.

Alternative positioning:

> Product demos as code.

> Automate the product. Direct the camera. Render with React.

## What this product is not

It is not primarily:

- a generic screen recorder;
- a video editor;
- a Playwright wrapper;
- a collection of Remotion templates;
- an AI agent that freely clicks through applications;
- a hosted rendering platform;
- a testing framework replacement.

It is a semantic bridge between real application behavior and programmable video composition.
