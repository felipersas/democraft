# DemoCraft Agent Reliability Baseline Report

Date: 2026-07-22

This is the first baseline produced after adding the `evals/agent-reliability`
harness. It measures both the deterministic Discovery portion of the agent
workflow and the first full-mode static landing-page run:

```text
doctor -> discover -> rubric scoring -> structured result
doctor -> discover -> DemoPlan/demo.ts intake -> validate -> render -> evidence
```

It does not claim suite-level autonomous demo reliability yet. Full ADSR
requires externally produced `DemoPlan` and `demo.ts` artifacts for every frozen
prompt, then a harness run through validation, render, visual evidence, and
optional one-round repair.

## Environment

- Repository: local working tree
- CLI entry: `packages/cli/dist/index.js`
- Harness: `evals/harness/agent-reliability.mjs`
- Modes: `discovery`, `full`
- Agent: Codex-generated static landing-page artifact for the first full-mode
  run
- Model: not recorded

## Discovery-Mode Baseline

Command:

```bash
for scenario in evals/agent-reliability/scenarios/*; do
  node evals/harness/agent-reliability.mjs "$scenario"
done
```

| Scenario | Status | Classification | Score | Mode |
| --- | --- | --- | ---: | --- |
| 01 Static landing page | passed | success | 100 | discovery |
| 02 Dashboard navigation | passed | success | 100 | discovery |
| 03 Modal interaction | passed | success | 100 | discovery |
| 04 Form flow | passed | success | 100 | discovery |
| 05 Repeated cards | passed | success | 100 | discovery |
| 06 Authenticated dashboard | passed | success | 100 | discovery |
| 07 Broken target repair | passed | success | 100 | discovery |
| 08 Responsive layout | passed | success | 100 | discovery |
| 09 Slow loading | passed | success | 100 | discovery |
| 10 Visual quality | passed | success | 100 | discovery |

## Current Metrics

- Discovery scenario pass rate: 10/10.
- Discovery unsafe-action failures: 0/10.
- Structured result preservation: 10/10.
- Full-mode basic scenario pass rate: 1/1 measured.
- Full autonomous demo success rate across the whole suite: not measured.
- Capture success rate for measured full-mode scenarios: 1/1.
- Render success rate for measured full-mode scenarios: 1/1.
- Repair effectiveness: not measured; no repair was needed in the passing
  full-mode run.

## Full-Mode Baseline

Scenario: `01-static-landing-page`

Command:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/01-static-landing-page \
  --plan live-agent-test/agent-reliability-inputs/01-static-landing-page/DemoPlan.json \
  --demo live-agent-test/agent-reliability-inputs/01-static-landing-page/demo.ts
```

| Metric | Value |
| --- | ---: |
| Status | passed |
| Classification | success |
| Attempts | 1 |
| Repair rounds | 0 |
| Semantic locator ratio | 1.000 |
| Validation errors | 0 |
| Capture succeeded | true |
| Render succeeded | true |
| Evaluation score | 100 |
| Human interventions during harness run | 0 |
| Commands executed | 4 |
| Total harness command duration | 112758 ms |
| Render command duration | 101766 ms |
| Visual target boxes out of bounds | 0/6 |

Preserved artifacts:

- `result.json`
- `draft.mp4`
- `draft-capture/`
- `draft-sentinel-frames.json`
- `draft-contact-sheet.html`
- command stdout/stderr JSON evidence

## Findings

- The new reliability harness can boot deterministic local fixtures, run
  `doctor`, run `discover`, compute rubric results, classify outcomes, and
  preserve command evidence.
- The current baseline proves Discovery readiness across the ten frozen
  scenario shapes.
- The first full-mode static landing-page baseline validates that externally
  produced `DemoPlan` and `demo.ts` artifacts can pass validation, capture,
  render, and evidence preservation.
- Before the passing run, the harness surfaced two useful frictions:
  `ENVIRONMENT_SETUP` when Playwright Chromium was missing and
  `AUTHORING_API_MISUSE` when generated artifacts used stale authoring shapes or
  lived outside a workspace able to resolve `@democraft/core`.

## Next Baseline Step

Run the dashboard-navigation scenario in full mode:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/02-dashboard-navigation \
  --plan /path/to/DemoPlan.json \
  --demo /path/to/demo.ts
```

Then compare validation, render, visual evidence, and repair metrics across the
two basic scenarios.
