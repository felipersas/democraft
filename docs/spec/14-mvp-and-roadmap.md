# MVP and Roadmap

## MVP objective

Prove that one semantic TypeScript demo can:

1. execute against a real application;
2. generate a reusable recording manifest;
3. render a polished Remotion video;
4. be modified by an LLM without re-recording browser actions;
5. adapt to at least one secondary output format.

## MVP public API

```ts
defineConfig()
defineTargets()
defineDemo()

demo.scene()

scene.goto()
scene.click()
scene.fill()
scene.select()
scene.scrollTo()

scene.expectVisible()
scene.expectText()
scene.expectUrl()

scene.establish()
scene.focus()
scene.hold()
scene.transition()

scene.caption()
scene.callout()
scene.spotlight()
```

## MVP runtime

- Chromium only;
- local and remote URLs;
- Playwright locators;
- storage-state authentication;
- fixed viewport;
- video capture;
- screenshots;
- bounding boxes;
- trace artifact;
- structured diagnostics.

## MVP renderer

- application recording;
- browser frame;
- synthetic cursor;
- click effect;
- target-aware camera;
- callout;
- caption;
- basic transition;
- landscape output;
- vertical output;
- Remotion Studio preview.

## MVP Remocn integration

- optional adapter;
- one title component;
- one text transition;
- one background;
- one theme preset.

## MVP CLI

```bash
democraft init
democraft inspect
democraft validate
democraft capture
democraft preview
democraft render
```

## First proof of concept

Build a sample Next.js dashboard with this flow:

1. open dashboard;
2. click New project;
3. fill project name;
4. submit;
5. wait for project card;
6. focus the project card;
7. show a callout;
8. render landscape;
9. render vertical.

## Success condition

After the first capture, change only:

- final callout text;
- final camera target;
- final hold duration;
- vertical framing.

The framework must render again without re-running Playwright.

## Roadmap

### Phase 1: semantic foundation

- schema;
- core API;
- compiler;
- static validation;
- inspect command.

### Phase 2: browser execution

- Playwright runner;
- targets;
- assertions;
- recording;
- manifest;
- trace output.

### Phase 3: Remotion renderer

- recording playback;
- cursor;
- camera;
- overlays;
- preview.

### Phase 4: outputs and presets

- vertical;
- square;
- camera adaptation;
- theme presets.

### Phase 5: Remocn

- adapter;
- visual registry;
- component schemas;
- cinematic preset.

### Phase 6: agent ergonomics

- JSON CLI output;
- richer diagnostics;
- discovery;
- generated target suggestions;
- llms.txt;
- AGENTS.md template.

### Phase 7: advanced capture

- screenshot sequences;
- deterministic frame capture;
- clock integration;
- layout tracking.

### Phase 8: editor

- scene list;
- cue timeline;
- camera controls;
- component browser;
- preview;
- source synchronization.

## Explicit non-goals for MVP

- desktop capture;
- native mobile;
- full timeline editor;
- cloud collaboration;
- voice generation;
- hosted rendering;
- free-form autonomous agents;
- Firefox and Safari;
- advanced audio editing;
- marketplace.
