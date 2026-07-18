# Repair playbook

After rendering a draft, evaluate it. If problems remain, make **at most one**
automatic repair round in MVP (plan §13). Never loop indefinitely.

## Evaluate before repairing

Check the draft against:

- **Structure**: every scene has a purpose; the demo has a clear ending.
- **Timeline**: camera moves are not excessive; no jarring cuts between distant
  regions; reading time on captions is adequate.
- **Visuals**: no empty/loading frames; overlays don't cover the target;
  cursor lands on the target.
- **Actions**: every important click produced a visible change.

A successful render is **not** proof of quality.

## Group by cause, fix the smallest coherent change

1. **Execution errors first** — failed targets, missing elements, timeouts.
   These block everything else.
2. **Structural problems** — missing establish, scene without purpose, demo
   without an ending.
3. **Direction/aesthetics last** — too much zoom, captions too long, pacing.

Change **one category** per attempt, then re-validate and re-render.

## Capture reuse rule (critical)

- **Presentation-only changes** (captions, camera, callouts, pacing, audio)
  can **reuse the existing capture** — no need to re-run Playwright. Use the
  explicit artifact path (see below): `render --manifest <m> --timeline <t>`.
- **Changed browser actions or locators** require a **recapture**
  (`democraft capture`), because the recorded screenshots no longer match.

Editing a target's locator, adding/removing a step, or changing `goto` paths
all count as non-presentation changes → recapture.

### Reusing a capture (presentation-only re-render)

`democraft render demo.ts` always re-captures. To re-render from an existing
capture without re-running Playwright, use the two-step artifact path:

```bash
# 1. Capture once (produces .democraft/runs/<id>/manifest.json)
democraft capture demo.ts

# 2. After a presentation-only edit, re-resolve + re-render from that manifest:
democraft timeline demo.ts --manifest .democraft/runs/<id>/manifest.json \
  --output timeline.json
democraft render demo.ts \
  --manifest .democraft/runs/<id>/manifest.json \
  --timeline timeline.json \
  -o revised.mp4
```

`--manifest` and `--timeline` must be supplied together. This skips the
browser entirely, so iteration on captions/camera/pacing is fast.


## One round, then stop

After one repair round, render the final and report — even if minor warnings
remain. Escalate unresolved issues to the user rather than looping.

## Common fixes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `DC101` unknown target | typo in target id | match the `defineTargets` key |
| `DC106` invalid target | locator matched nothing | re-discover; pick a different candidate |
| `DC201` runtime step failed | element not visible/ready | add `expectVisible` before the action |
| target clicks wrong element | locator ambiguous | re-discover; scope to region or use testId |
| camera jittery | too many `focus` steps | remove redundant focuses; `establish` first |
| caption unreadable | too short / covered target | lengthen hold; reposition callout |
