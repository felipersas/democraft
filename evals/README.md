# Agent-authoring evals

Deterministic, CI-runnable evals that verify the discovery contract an agent
consumes. Part of the DemoCraft P0 initiative (plan §14, §16).

## Layout

```
evals/
  agent-authoring/
    01-static-landing-page/   static page, buttons + links + headings
    02-dashboard-navigation/  app shell with nav links and dashboard actions
    03-form-flow/             labelled inputs, checkbox, and submit action
    04-repeated-cards/        48 homogeneous cards (collection aggregation)
    05-modal-interaction/     visible dialog with semantic controls
      scenario.json           metadata
      prompt.md               FROZEN prompt (never edit; never show expected/ to agent)
      rubric.json             scoring rules (semantic-locator-ratio, musts, …)
      target-app/app.json     declarative page spec (rendered by the harness)
      expected/               known-good reference (regression baseline)
  harness/run-eval.mjs        boots the target-app, runs discover, scores
  results/                    scored run reports (gitignored)
```

## Run

From the repo root (after `pnpm build`):

```bash
node evals/harness/run-eval.mjs evals/agent-authoring/01-static-landing-page
node evals/harness/run-eval.mjs evals/agent-authoring/02-dashboard-navigation
node evals/harness/run-eval.mjs evals/agent-authoring/03-form-flow
node evals/harness/run-eval.mjs evals/agent-authoring/04-repeated-cards
node evals/harness/run-eval.mjs evals/agent-authoring/05-modal-interaction
```

Each run writes `evals/results/<scenario>/<run-id>/report.json` and prints a
one-line summary. The harness exits non-zero when a `must` rubric rule fails,
so CI can gate on regression.

## What is scored

- `minimumSemanticLocatorRatio` — fraction of locator candidates that are
  role/label/testId (not text). Default floor 0.8.
- `mustHaveNoEmptyElements` — every retained element has ≥1 candidate.
- `mustExposeSchemaVersion` — the discovery carries `schemaVersion: 1`.
- `mustUseCollectionSampling` — long lists are aggregated, not enumerated.
- `mustNotUseUnsafeExploration` — no `DC401`/`DC402` warnings.

## MVP scope

The MVP harness scores the **discovery output** (the input an agent consumes),
not a live agent run. This keeps evals deterministic and CI-runnable. A
`--live` mode that drives a real agent through discover → validate → capture →
render is documented in the plan (§14.4) and gated for scheduled runs.

## Adding a scenario

1. `mkdir evals/agent-authoring/<NN-name>/{target-app,expected}`.
2. Write `target-app/app.json` (regions + elements + optional collection).
3. Write `rubric.json` (copy an existing one and adjust thresholds).
4. Write `prompt.md` — then **freeze it**.
5. Run the harness; commit a reviewed `expected/` baseline.
