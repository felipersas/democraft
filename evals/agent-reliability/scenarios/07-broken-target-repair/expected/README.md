This scenario intentionally commits both sides of the one-round repair fixture:

- `DemoPlan.json` describes the expected repaired target selection.
- `demo.broken.ts` is the initial draft artifact. It still targets the old
  primary CTA accessible name, `Start free trial`, and should fail during
  capture/render target resolution against the current fixture.
- `demo.repair.ts` is the supplied bounded repair artifact. It uses the current
  `Start workspace` CTA and should pass after exactly one repair round.

Generated run output remains under `evals/results/agent-reliability/` and stays
gitignored. Commit only reviewed summaries or fixture artifacts from this
directory.
