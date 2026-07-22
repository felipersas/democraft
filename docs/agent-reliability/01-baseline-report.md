# DemoCraft Agent Reliability Baseline Report

Date: 2026-07-22

This is the first baseline produced after adding the `evals/agent-reliability`
harness. It measures both the deterministic Discovery portion of the agent
workflow and the currently reviewed full-mode scenario runs:

```text
doctor -> discover -> rubric scoring -> structured result
doctor -> discover -> DemoPlan/demo.ts intake -> validate -> render -> evidence
```

It does not claim suite-level autonomous demo reliability yet. Full ADSR still
requires externally produced `DemoPlan` and `demo.ts` artifacts for every frozen
prompt, then a harness run through validation, render, visual evidence, and
optional one-round repair.

## Environment

- Repository: local working tree
- CLI entry: `packages/cli/dist/index.js`
- Harness: `evals/harness/agent-reliability.mjs`
- Modes: `discovery`, `full`
- Agent: Codex-generated artifacts for the first three full-mode basic scenario
  runs
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
- Full-mode basic scenario pass rate: 5/5 measured after hardening.
- Full-mode intermediate scenario pass rate: 1/1 measured after hardening.
- Full autonomous demo success rate across the whole suite: not measured.
- Capture success rate for measured full-mode scenarios: 6/6.
- Render success rate for measured full-mode scenarios: 6/6.
- Repair effectiveness: 1/1 measured repaired scenarios effective.

## Full-Mode Baselines

| Scenario | Status | Classification | Attempts | Repairs | Semantic Locator Ratio | Validation Errors | Render | Score | Duration |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 01 Static landing page | passed | success | 1 | 0 | 1.000 | 0 | passed | 100 | 112758 ms |
| 02 Dashboard navigation | passed | success | 1 | 0 | 1.000 | 0 | passed | 100 | 57897 ms |
| 03 Modal interaction | passed | success | 1 | 0 | 1.000 | 0 | passed | 100 | 59979 ms |
| 04 Form flow | passed | success | 1 | 0 | 1.000 | 0 | passed | 100 | 89653 ms |
| 05 Repeated cards | passed | success | 1 | 0 | 1.000 | 0 | passed | 100 | 42906 ms |
| 07 Broken target repair | passed | success | 2 | 1 | 1.000 | 0 | passed | 100 | 92154 ms |

### 01 Static Landing Page

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

### 02 Dashboard Navigation

Scenario: `02-dashboard-navigation`

Command:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/02-dashboard-navigation \
  --plan live-agent-test/agent-reliability-inputs/02-dashboard-navigation/DemoPlan.json \
  --demo live-agent-test/agent-reliability-inputs/02-dashboard-navigation/demo.ts
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
| Total harness command duration | 57897 ms |

### 03 Modal Interaction

Scenario: `03-modal-interaction`

Command:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/03-modal-interaction \
  --plan live-agent-test/agent-reliability-inputs/03-modal-interaction/DemoPlan.json \
  --demo live-agent-test/agent-reliability-inputs/03-modal-interaction/demo.ts
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
| Total harness command duration | 59979 ms |

### 04 Form Flow

Scenario: `04-form-flow`

Command:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/04-form-flow \
  --plan live-agent-test/agent-reliability-inputs/04-form-flow/DemoPlan.json \
  --demo live-agent-test/agent-reliability-inputs/04-form-flow/demo.ts
```

| Metric | Value |
| --- | ---: |
| Status | passed |
| Classification | success |
| Attempts | 1 |
| Repair rounds | 0 |
| Semantic locator ratio | 1.000 |
| Target resolution rate | 1.000 |
| Validation errors | 0 |
| Capture succeeded | true |
| Render succeeded | true |
| Evaluation score | 100 |
| Human interventions during harness run | 0 |
| Commands executed | 4 |
| Total harness command duration | 89653 ms |

### 05 Repeated Cards

Scenario: `05-repeated-cards`

Command:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/05-repeated-cards \
  --plan live-agent-test/agent-reliability-inputs/05-repeated-cards/DemoPlan.json \
  --demo live-agent-test/agent-reliability-inputs/05-repeated-cards/demo.ts
```

| Metric | Value |
| --- | ---: |
| Status | passed |
| Classification | success |
| Attempts | 1 |
| Repair rounds | 0 |
| Semantic locator ratio | 1.000 |
| Target resolution rate | 1.000 |
| Validation errors | 0 |
| Capture succeeded | true |
| Render succeeded | true |
| Evaluation score | 100 |
| Human interventions during harness run | 0 |
| Commands executed | 4 |
| Total harness command duration | 42906 ms |

### 07 Broken Target Repair

Scenario: `07-broken-target-repair`

Command:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/07-broken-target-repair \
  --plan evals/agent-reliability/scenarios/07-broken-target-repair/expected/DemoPlan.json \
  --demo evals/agent-reliability/scenarios/07-broken-target-repair/expected/demo.broken.ts \
  --repair-demo evals/agent-reliability/scenarios/07-broken-target-repair/expected/demo.repair.ts
```

| Metric | Value |
| --- | ---: |
| Status | passed |
| Classification | success |
| Attempts | 2 |
| Repair rounds | 1 |
| Repair category | CAPTURE_FAILURE |
| Repair effective | true |
| Semantic locator ratio | 1.000 |
| Target resolution rate | 1.000 |
| Validation errors | 0 |
| Capture succeeded | true |
| Render succeeded | true |
| Evaluation score | 100 |
| Human interventions during harness run | 0 |
| Commands executed | 6 |
| Total harness command duration | 92154 ms |

Before/after repair evidence:

| Run | Status | Classification | Target Resolution Rate | Evidence |
| --- | --- | --- | ---: | --- |
| Draft attempt | failed | CAPTURE_FAILURE | 0.500 | `evals/results/agent-reliability/07-broken-target-repair/2026-07-22T18-47-56-313Z-5679cd3f/result.json` (`repairs[0].priorFailures`, `draft-capture/`) |
| Final repaired attempt | passed | success | 1.000 | `evals/results/agent-reliability/07-broken-target-repair/2026-07-22T18-47-56-313Z-5679cd3f/result.json` (`final-capture/`, `final.mp4`) |

The draft artifact failed for the intended renamed-target reason:
`primaryCta` still pointed at the old `Start free trial` accessible name, while
the fixture now exposes `Start workspace`. The harness recorded the prior
`DC201` target-resolution diagnostic, one repair round, the supplied repair
artifact, final status, and `repairEffective: true`.

Preserved artifacts:

- `result.json`
- `DemoPlan.json`
- `draft-demo.ts`
- `draft.mp4`
- `draft-capture/`
- `draft-sentinel-frames.json`
- `draft-contact-sheet.html`
- `repair-demo.ts`
- `final.mp4`
- `final-capture/`
- `final-sentinel-frames.json`
- `final-contact-sheet.html`
- command stdout/stderr JSON evidence

## Findings

- The new reliability harness can boot deterministic local fixtures, run
  `doctor`, run `discover`, compute rubric results, classify outcomes, and
  preserve command evidence.
- The current baseline proves Discovery readiness across the ten frozen
  scenario shapes.
- The first five full-mode baselines validate that externally produced
  `DemoPlan` and `demo.ts` artifacts can pass validation, capture, render, and
  evidence preservation across landing-page, navigation, modal-interaction,
  form-flow, and repeated-card collection workflows.
- The form-flow baseline exposed a false-pass risk: the renderer could produce
  an MP4 even when the capture manifest contained unresolved targets. The
  harness now fails those runs as `CAPTURE_FAILURE` and records
  `targetResolutionRate`.
- The same form-flow baseline exposed a fixture fidelity gap: the prompt asked
  for a successful completion state, but the fixture had no post-submit state.
  The declarative fixture renderer now supports an opt-in `showSuccess` action
  and hidden `successState`, allowing this workflow to pass without
  scenario-specific selectors or rubric weakening.
- The repeated-cards baseline exposed a locator contract mismatch: Discovery
  suggested article role/name locators using text-derived card names, and
  capture used Playwright's substring role-name matching by default. Discovery
  now avoids invented role-name locators for unlabeled articles, generated
  collection cards have real `aria-label`s, and capture resolves string
  role-name locators exactly.
- The broken-target-repair baseline proves the harness can measure one supplied
  repair artifact end to end. It does not yet prove autonomous repair: the
  corrected `demo.repair.ts` is provided to the harness, and no product repair
  command generates it.
- Before the passing run, the harness surfaced two useful frictions:
  `ENVIRONMENT_SETUP` when Playwright Chromium was missing and
  `AUTHORING_API_MISUSE` when generated artifacts used stale authoring shapes or
  lived outside a workspace able to resolve `@democraft/core`.

Before/after evidence for the form-flow hardening:

| Run | Status | Classification | Target Resolution Rate | Score | Evidence |
| --- | --- | --- | ---: | ---: | --- |
| Before harness/fixture fix | failed | CAPTURE_FAILURE | 0.818 | 80 | `evals/results/agent-reliability/04-form-flow/2026-07-22T13-41-50-310Z-f38ee436/result.json` |
| After harness/fixture fix | passed | success | 1.000 | 100 | `evals/results/agent-reliability/04-form-flow/2026-07-22T13-45-14-132Z-afa80d2c/result.json` |

Before/after evidence for the repeated-cards hardening:

| Run | Status | Classification | Target Resolution Rate | Score | Evidence |
| --- | --- | --- | ---: | ---: | --- |
| Before locator fix | failed | CAPTURE_FAILURE | 0.385 | 83 | `evals/results/agent-reliability/05-repeated-cards/2026-07-22T14-15-39-109Z-c9ad71f4/result.json` |
| After locator fix | passed | success | 1.000 | 100 | `evals/results/agent-reliability/05-repeated-cards/2026-07-22T14-24-44-760Z-e758c46e/result.json` |

## Next Baseline Step

Run the authenticated-dashboard scenario in full mode:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/06-authenticated-dashboard \
  --plan /path/to/DemoPlan.json \
  --demo /path/to/demo.ts
```

Then compare validation, render, visual evidence, and repair metrics across the
first six scenarios.
