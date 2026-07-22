# DemoCraft Agent Reliability Evals

This is the canonical full-workflow reliability harness for agent-created
DemoCraft demos. It is separate from `evals/agent-authoring`, which remains the
deterministic Discovery-contract suite.

## What It Measures

The harness always runs:

```text
doctor -> discover -> rubric scoring -> result.json
```

When externally produced artifacts are supplied, it runs the fuller workflow:

```text
doctor -> discover -> DemoPlan/demo.ts intake -> validate -> draft render
  -> deterministic evidence -> optional one repair artifact -> final result
```

The harness does not call an LLM provider. Agents produce `DemoPlan` and
`demo.ts` outside the harness, then pass them in with `--plan` and `--demo`.

## Run

Build packages first so the CLI exists at `packages/cli/dist/index.js`:

```bash
pnpm build
node evals/harness/agent-reliability.mjs evals/agent-reliability/scenarios/01-static-landing-page
```

Full-flow run with agent artifacts:

```bash
node evals/harness/agent-reliability.mjs \
  evals/agent-reliability/scenarios/01-static-landing-page \
  --plan /path/to/DemoPlan.json \
  --demo /path/to/demo.ts
```

Every run writes:

```text
evals/results/agent-reliability/<scenario>/<run-id>/result.json
```

Generated results are gitignored. Commit only reviewed baseline summaries or
explicit golden artifacts.

## Scenario Contract

Each scenario contains:

- `scenario.json`: fixture, prompt, rubric, budgets, expected artifacts.
- `prompt.md`: frozen user request.
- `rubric.json`: thresholds and required rules.
- `target-app/app.json`: deterministic local fixture specification.
- `expected/README.md`: notes for reviewed baselines.

Prompts are product inputs. Do not rewrite them after observing failures; create
a new scenario version instead.
