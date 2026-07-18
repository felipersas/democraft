# Workflow — the 14 steps expanded

The SKILL.md workflow is mandatory. This reference adds the "why" and the
decision points at each step.

## 1. Understand the request

Capture explicitly: the **objective** (what the viewer should learn/feel), the
**audience** (new users vs. power users), the **target duration**, and the
**aspect ratio** (16:9 default). If any are missing, ask — do not guess.

## 2. Check the environment

`democraft doctor --json`. Every check has a `status` of `ok`/`warning`/
`error`. Resolve all `error` checks first. The `--url` flag adds a
reachability check for the target app.

## 3. Discover the application

`democraft discover <url> --json`. The output is a `PageDiscovery`:

- `regions` — landmark areas (nav, main, banner, …).
- `elements` — interactive + narratively useful elements, each with
  `locatorCandidates` ordered best-first.
- `collections` — aggregated long repeated lists (don't enumerate every item).
- `warnings` — `DC406` ambiguous, `DC407` no interactive elements.

Discovery is **read-only** and scoped to a single origin (the page's own, or
`--allow-origin` extensions).

## 4. DemoPlan

Sketch before authoring. A demo has one objective; each scene has one purpose
and answers one question; important actions have an expected outcome. The plan
is a thinking aid, not a second authoring DSL — `demo.ts` remains the source.

## 5. Select targets

From each element you'll interact with, take the top `locatorCandidate`
(highest confidence, `stability: "high"`, `unique: true`). Use its
`suggestedTargetId` as the target id in `defineTargets`.

## 6. Author demo.ts

`defineDemo({ id, title, source: { baseUrl }, targets, async run({ demo }) })`.
Inside `run`, call `demo.scene(id, async (scene) => { … })`. Each scene uses
`scene.goto`, `scene.expectVisible`, `scene.establish`, `scene.focus`,
`scene.click`, `scene.caption`, etc.

## 7. Validate

`democraft validate demo.ts --json`. Zero error diagnostics before capture.
Common codes: `DC101` unknown target, `DC102` invalid duration, `DC104`
invalid step.

## 8. Capture

`democraft capture demo.ts` writes `.democraft/runs/<id>/`. Capture needs the
target app running.

## 9. Render draft

`democraft render demo.ts -o draft.mp4`.

## 10. Evaluate

Check: does each scene have a purpose? Is the camera moving too much? Are
captions readable? Did every important action produce a visible change? A
successful render is NOT proof of quality.

## 11. Repair (one round)

Group problems by likely cause. Apply the smallest coherent change.
Presentation-only changes (captions, camera, pacing) reuse the capture;
changed actions or locators require a recapture.

## 12. Render final

`democraft render demo.ts -o final.mp4`.

## 13. Report

Artifact paths, decisions made, and any limitations (e.g. "could not discover
the settings page because it requires auth — used the dashboard instead").
