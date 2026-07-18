# Authoring API

The public authoring API lives in `@democraft/core`. Full reference:
`apps/docs/content/sdk/overview.mdx`. This is the agent cheat sheet.

## Minimal demo

```ts
import { byTestId, defineDemo, defineTargets } from "@democraft/core";

const targets = defineTargets({
  dashboard: byTestId("dashboard"),
});

export default defineDemo({
  id: "dashboard-tour",
  title: "Dashboard tour",
  source: { baseUrl: "http://localhost:3000" },
  targets,
  async run({ demo }) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
      await scene.expectVisible("dashboard");
      await scene.establish("dashboard");
      await scene.caption("Everything you need, at a glance.");
    });
  },
});
```

## Locator builders

- `byRole(role, { name? })` — e.g. `byRole("button", { name: "Save" })`.
- `byLabel(text)` — e.g. `byLabel("Email")`.
- `byTestId(id)` — e.g. `byTestId("submit")`.
- `byText(text)` — e.g. `byText("Welcome back")`.

These produce exactly the `Locator` shape Discovery returns in
`locatorCandidates[].locator`, so you can copy a candidate's fields directly.

## Scene methods (the `scene` argument)

- `scene.goto(path)` — navigate to a path (relative to `baseUrl`).
- `scene.expectVisible(targetId)` — assert a target is visible.
- `scene.expectText(targetId, text)` — assert an element's text.
- `scene.expectUrl(path)` — assert the current URL.
- `scene.establish(targetId?)` — wide establishing shot.
- `scene.focus(targetId, { padding? })` — zoom to a target.
- `scene.click(targetId)` — click a target.
- `scene.fill(targetId, value)` — fill an input.
- `scene.select(targetId, value)` — select an option.
- `scene.caption(text, { renderer? })` — overlay caption.
- `scene.callout(targetId, { title, description? })` — overlay callout.
- `scene.hold(duration)` — hold the current frame. `duration` is a `Duration`
  string: `"500ms"`, `"1.5s"`, `"2s"` (NOT a bare number).
- `scene.transition({ transition: "cut" | "crossfade", durationMs? })`.

`renderer` on `caption`/`callout` is **optional** — omit it for the default
style. (Values like `"remocn.kinetic-title"` select alternative visual styles
from the remocn registry; they're not required.)

## Step presentation durations

Each step contributes a fixed presentation duration to the rendered video
(decoupled from how long capture took). Estimate the total **without
rendering** via `democraft inspect demo.ts --estimate --json` — it returns
`{ totalMs, totalSeconds, totalFrames, scenes: [{ sceneId, estimatedMs, ... }] }`.
Use it to hit a target length in one render instead of a render-and-measure
loop.

| Step kind | Default on-screen duration |
| --- | --- |
| `hold` | your `duration` |
| `transition` | your `durationMs`, or 500ms if unset |
| `caption` | `max(1200ms, text.length × 45ms)` — longer text gets more time |
| `callout` | `max(1800ms, (title+description).length × 45ms)` |
| `visual` | your `durationMs`, or 1800ms |
| `establish` | 700ms |
| `focus` | 1100ms |
| `click` | 650ms |
| `fill` / `select` | 700ms |
| `goto` | 900ms |
| `assert.*` | 300ms |

## Targets

`defineTargets` maps ids → locators. The id is what steps reference. Use the
`suggestedTargetId` from Discovery as the key.

```ts
const targets = defineTargets({
  newProject: byRole("button", { name: "New project" }),
  email: byLabel("Work email"),
});
```

For a fragile primary locator, pass a **fallback chain** — DemoCraft tries
each in order until one resolves:

```ts
import { defineTarget, byRole, byTestId } from "@democraft/core";

const targets = defineTargets({
  save: defineTarget({
    id: "save",
    locators: [
      byRole("button", { name: "Save" }),
      byTestId("save-button"), // fallback if role+name changes
    ],
  }),
});
```


## Custom visuals (optional)

`defineVisual(Component)` registers a React/Remotion component. Reference it
by id with `scene.visual(id, props)`. See `apps/docs/content/concepts/components.mdx`.
