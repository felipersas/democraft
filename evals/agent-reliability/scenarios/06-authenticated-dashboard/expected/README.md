# Authenticated Dashboard Baseline

Frozen full-mode inputs:

- `DemoPlan.json`
- `demo.ts`

The demo reads `EVAL_BASE_URL` and `EVAL_AUTH_PROFILE_ID`; it commits only an
opaque placeholder fallback and never stores browser state. The harness creates
and removes an ephemeral local profile around each auth-required run.

Reviewed local baseline, generated on 2026-07-22:

- Status: `passed`
- Classification: `success`
- Evaluation score: `100`
- Attempts: `1`
- Repair rounds: `0`
- Semantic locator ratio: `1`
- Target resolution rate: `1`
- Validation errors: `0`
- Capture succeeded: `true`
- Render succeeded: `true`
- Command evidence: doctor, discovery, draft validation, draft render
- Visual evidence: draft sentinel frames and draft contact sheet

Hardening evidence:

- Before: the scenario described auth readiness but had no frozen full-mode
  `DemoPlan.json` or executable demo artifact to run.
- After: `node evals/harness/agent-reliability.mjs
evals/agent-reliability/scenarios/06-authenticated-dashboard --plan
evals/agent-reliability/scenarios/06-authenticated-dashboard/expected/DemoPlan.json
--demo
evals/agent-reliability/scenarios/06-authenticated-dashboard/expected/demo.ts
--mode full` passed and preserved command plus visual evidence.
- Auth readiness failures now use `AUTH_READINESS_FAILURE`, separate from
  authoring, capture, render, and visual-quality classifications.

Generated result artifacts live under `evals/results/agent-reliability/` and
remain gitignored.
