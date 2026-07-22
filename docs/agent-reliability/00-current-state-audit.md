# DemoCraft Agent Reliability Current-State Audit

Date: 2026-07-18

This audit is the Phase 0 gate for the Agent Reliability and Distribution plan. It records what is already implemented, what is missing, and where the first implementation slice should land. It is intentionally scoped to observed repository state and does not assume every item in the plan is absent.

## Sources Reviewed

- `AGENTS.md`
- `DEVELOPMENT.md`
- `llms.txt`
- `docs/architecture/overview.md`
- `docs/architecture/pipeline.md`
- `docs/architecture/discovery.md`
- `docs/authentication.md`
- `docs/DEMOCRAFT_AGENT_RELIABILITY_ACTION_PLAN.md`
- `skills/democraft-product-demo/SKILL.md`
- `evals/README.md`
- `evals/harness/run-eval.mjs`
- Current package manifests under `packages/*/package.json`

## Current Capabilities

### Package and API Boundaries

The monorepo has the intended package split:

- `@democraft/schema`: shared JSON-serializable shapes, Zod artifact parsers, diagnostics, discovery schemas.
- `@democraft/core`: single TypeScript authoring API (`defineDemo`, `defineTargets`, `byRole`, `byLabel`, `byTestId`, `byText`).
- `@democraft/compiler`: compiles authored demos into compiler-owned `DemoIR` and validates static diagnostics.
- `@democraft/playwright`: capture runtime plus semantic Page Discovery.
- `@democraft/timeline`: deterministic timeline resolver.
- `@democraft/preview`: standalone HTML preview from manifest and timeline.
- `@democraft/remotion`: Remotion renderer.
- `@democraft/authentication`: local auth profile services.
- `@democraft/studio`: local Next.js Studio runtime.
- `@democraft/cli`: command surface tying all packages together.
- `@democraft/testing`: reusable demo fixtures.

The key load-bearing boundary is intact: the renderer consumes manifest and timeline JSON and does not depend on compiler or Playwright. `schema` remains the leaf package.

Code references:

- `packages/core/src/define.ts`
- `packages/core/src/locators.ts`
- `packages/core/src/targets.ts`
- `packages/compiler/src/compile.ts`
- `packages/compiler/src/validation.ts`
- `packages/playwright/src/runner.ts`
- `packages/timeline/src/resolve.ts`
- `packages/remotion/src/index.ts`
- `packages/cli/src/run.ts`

### Discovery and Application Map

Semantic Page Discovery exists and is documented as the read-only counterpart to capture. It produces a `PageDiscovery` artifact with regions, elements, collections, best-first locator candidates, warnings, viewport, and page metadata.

Implemented pieces:

- Origin allowlist and unsafe scheme blocking via `packages/playwright/src/discovery-origin.ts`.
- Browser orchestration and artifact lifecycle via `packages/playwright/src/discover.ts` and `packages/playwright/src/discovery-artifacts.ts`.
- Accessibility-oriented page inventory via `packages/playwright/src/discovery-snapshot.ts`.
- Deterministic locator scoring via `packages/playwright/src/discovery-scoring.ts`.
- Discovery types via `packages/schema/src/discovery.ts`.
- Zod artifact validation via `packages/schema/src/artifact-schemas.ts`.
- CLI command `democraft discover <url> --json`.

Discovery artifacts are persisted under `.democraft/discovery/<application-id>/runs/<run-id>/application-map.json`, with a `latest.json` pointer. The docs identify this as a sixth cache boundary.

Current limitation: the action plan asks for an "Application Map" in the broader agent workflow. Today the `PageDiscovery` artifact is the map. There is no separate multi-page application-map planner, reuse policy, or scenario-level map contract beyond Discovery output.

### DemoPlan

`DemoPlan` exists as an agent workflow concept in the skill and action plan, not as a versioned schema or package API. The current product still correctly preserves the single TypeScript authoring API and compiler-owned `DemoIR`.

Observed implementation:

- The skill requires agents to "produce or revise a DemoPlan" before authoring.
- References under `skills/democraft-product-demo/references/` provide procedural guidance.
- No `DemoPlan` schema, validator, CLI command, fixture contract, or persisted artifact was observed.

Recommended interpretation: keep `DemoPlan` external to core packages for now, but define a harness-level scenario artifact contract if evals need to accept or score plans.

### CLI JSON Contracts and Diagnostics

The CLI has a shared JSON envelope helper for agent-facing commands:

- `packages/cli/src/json.ts` emits `{ ok: true, ...payload }` for success and `{ ok: false, code, message, diagnostics? }` for failures.
- `democraft doctor --json` uses structured checks.
- `democraft discover <url> --json` returns a parseable success/failure envelope.
- `validate --json` is documented by the skill as a bare diagnostics array, so it is not yet fully aligned with the newer envelope contract.

Diagnostics are centralized in `@democraft/schema`, with families for configuration, authoring, runtime, audio, and discovery. Discovery warnings include `DC401` to `DC407` in current docs and code comments.

Risk: mixed JSON shapes across commands increase agent branching and make the planned harness harder to generalize.

### Doctor

Environment checks exist in `packages/cli/src/doctor.ts`:

- Node version.
- Playwright package availability.
- Chromium executable availability.
- Workspace writability.
- Optional app reachability.

The implementation is pure and injectable. It reports stable check IDs, status, diagnostic code, message, and suggestions.

Gap: doctor does not yet cover all release-readiness prerequisites, such as packed-package installability, Studio production asset availability, auth profile readiness, or target app reset/health protocol.

### Capture, Timeline, Preview, Render

The canonical pipeline exists:

```text
demo.ts -> compileDemo -> runDemo -> manifest/screenshots/trace/recording -> resolveTimeline -> preview/render
```

Implemented pieces:

- Compile and validate through `@democraft/compiler`.
- Playwright capture with traces and screenshots.
- Target resolution attempts recorded in snapshots.
- Timeline resolution uses the larger of planned and actual step duration.
- Preview is pure artifact playback.
- Remotion render is artifact-driven and decoupled from compiler/Playwright.
- Studio can materialize cached artifacts and recapture when requested.

Gap: there is no deterministic visual evaluation package or CLI command that scores final renders. Current success largely means command success plus any manual review.

### Sentinel Frames and Contact Sheets

The skill includes `scripts/collect-render-frames.mjs`, described as deterministic frame times for review. No first-class product package, CLI command, schema, or committed contact-sheet artifact contract was observed.

Gap: the plan requires deterministic evaluation, sentinel frames, contact sheets, and evidence attached to findings. Current support appears skill-side and partial.

### Repair

Repair exists as procedural guidance in `skills/democraft-product-demo/references/repair-playbook.md` and in diagnostics/suggestions, but there is no bounded repair engine, repair result schema, or CLI repair command.

Current product primitives that can support repair:

- Static validation diagnostics.
- Discovery locator candidates.
- Runtime target snapshots and failed resolution attempts.
- Artifact reuse boundaries allowing presentation-only changes without recapture.

Gap: the planned "one bounded repair round" is not yet measurable or orchestrated by a stable contract.

### Run History

Studio render history exists:

- `packages/studio/lib/render-history.ts`
- `packages/studio/lib/render-history.test.ts`

Capture and discovery artifacts also have run metadata and latest pointers. The eval harness writes reports under `evals/results/<scenario>/<run-id>/report.json`.

Gap: there is no unified agent-run history schema spanning doctor, discovery, plan, authoring, validation, capture, render, evaluation, and repair.

### Authentication

Authentication profiles are implemented and documented:

- Package: `@democraft/authentication`.
- CLI lifecycle: create, login, validate, list, rename, remove.
- Studio panel for create, associate, validate, renew, rename, remove.
- Runtime validates auth state before capture and avoids writing browser state into demo source or artifacts.
- Structured agent-safe failure shapes include `actionRequired`.

Code/tests cover repository behavior, validation, interactive flows, Playwright runtime integration, Studio routes, source association, and UI accessibility.

Gap: the eval suite does not yet include an authenticated scenario, expired profile result fixture, or CI-safe auth classification path.

### Packaged CLI and Studio Execution

Published package manifests exist for all public packages. The CLI depends on the Studio package and includes `@democraft/studio` as a workspace dependency. Studio package files include selected `.next` production artifacts.

Gap: no fresh clean-consumer install verification was run as part of this audit. Existing docs require `pnpm build` because workspace packages resolve through `dist/`, and the action plan requires proving packed packages outside the monorepo.

### Agent Skill

The official skill exists at `skills/democraft-product-demo/SKILL.md` with:

- Trigger metadata.
- Mandatory discover-plan-author-validate-capture-render-evaluate workflow.
- Rules for semantic locators, generated artifacts, DemoIR ownership, auth secrecy, unsafe actions, and one repair round.
- References for workflow, discovery, direction, locator strategy, authentication, authoring API, repair, and diagnostics.
- Scripts for environment checks, discovery summaries, validation, and render-frame collection.

Gaps:

- No CI drift check was observed proving templates/scripts remain synchronized with current packages.
- No skill installation validation was observed.
- No trigger/non-trigger evaluation suite was observed.
- The skill claims an evaluate loop, but product-side evaluation is not yet a stable command/schema.

### Existing Evals

There is an existing deterministic eval suite under `evals/agent-authoring/` with five scenarios:

- `01-static-landing-page`
- `02-dashboard-navigation`
- `03-form-flow`
- `04-repeated-cards`
- `05-modal-interaction`

The harness at `evals/harness/run-eval.mjs` boots a declarative local fixture, runs `democraft discover <url> --json`, scores the Discovery output, and writes `report.json`.

Observed latest report summaries:

| Scenario | Status | Semantic locator ratio | Elements | Collections | Warnings |
| --- | --- | ---: | ---: | ---: | ---: |
| 01 Static landing page | passed | 1.000 | 9 | 0 | 0 |
| 02 Dashboard navigation | passed | 1.000 | 8 | 0 | 0 |
| 03 Form flow | passed | 1.000 | 5 | 0 | 0 |
| 04 Repeated cards | passed | 1.000 | 98 | 2 | 0 |
| 05 Modal interaction | passed | 1.000 | 6 | 0 | 0 |

Important limitation: these evals verify the Discovery contract an agent consumes. They do not yet run the full agent workflow, accept generated `DemoPlan`/`demo.ts`, capture/render videos, evaluate visual quality, or perform bounded repair.

## Missing Capabilities

The following are not currently implemented as stable, versioned product or harness contracts:

1. Full `evals/agent-reliability/` structure from the action plan.
2. JSON schemas for scenario, rubric, and result contracts.
3. Harness support for isolated consumer workspaces and packed package installs.
4. Harness support for externally produced `DemoPlan` and `demo.ts`.
5. Harness support for capture, draft render, final render, artifact preservation, and budgets.
6. Classification taxonomy for product, agent, fixture, and environment failures.
7. Versioned `DemoPlan` schema or harness-level plan contract.
8. Deterministic visual evaluation, sentinel frame scoring, or contact sheets as product/harness APIs.
9. Bounded repair result schema and orchestration.
10. Authenticated dashboard eval with safe expired/invalid profile diagnostics.
11. Slow-loading, responsive, broken-target-repair, and visual-quality scenarios.
12. Baseline and after-hardening reports under `docs/agent-reliability/`.
13. Public skill install validation and skill/API drift CI.
14. Clean npm package installation proof outside the monorepo.
15. Security review specifically for the complete agent workflow.

## Reliability Risks

- Discovery success can be mistaken for full autonomous demo success.
- Mixed CLI JSON contracts force agents and harnesses to special-case commands.
- `DemoPlan` is procedural, so plan quality and schema drift cannot be scored reproducibly.
- Visual quality has no deterministic pass/fail gate.
- Repair guidance is not connected to a measurable one-round repair contract.
- Current eval fixtures are deterministic but synthetic and page-local; they do not prove real app workflows or multi-step capture reliability.
- Packed package behavior is unproven in a clean consumer in this audit.
- Auth is well-developed, but agent evals currently lack an auth scenario and failure classification.
- Discovery docs mention future Application Map reuse logic; consumers may over-assume cache reuse capabilities.
- Existing results under `evals/results/` may be useful baselines, but generated result retention policy should be clarified before committing or comparing them.

## Proposed Changes by Package or Area

### `evals/agent-reliability`

Create the full agent-reliability eval area instead of overloading `evals/agent-authoring`.

First slice:

- Add `schema/scenario.schema.json`, `schema/rubric.schema.json`, and `schema/result.schema.json`.
- Add a harness package or script that can run one isolated fixture through doctor and discovery.
- Reuse the existing five `agent-authoring` fixture ideas where possible, but store new reliability contracts separately.
- Produce result objects with `schemaVersion`, `runId`, `scenarioId`, `status`, `classification`, `environment`, `metrics`, `artifacts`, `rubric`, and `failures`.

### `packages/schema`

Keep core product schemas provider-neutral. Add shared types only if they represent durable DemoCraft artifacts rather than eval-only data.

Candidate additions:

- Failure classification enum if CLI/product commands should emit it.
- Visual evidence artifact metadata if sentinel/contact-sheet output becomes product-facing.

Avoid adding LLM-agent SDK or provider types.

### `packages/cli`

Align agent-facing JSON contracts over time:

- Preserve compatibility for existing commands.
- Add envelope-style output for any new eval, doctor, discover, or repair commands.
- Consider a non-breaking `validate --json-envelope` or future major change so harnesses do not need bare-array special cases.

### `packages/playwright`

Discovery is the strongest current foundation. Hardening should be evidence-driven after baseline runs.

Potential follow-ups:

- Expose more explicit element context for repeated collections and dialogs if scenarios fail.
- Ensure hidden responsive duplicates and closed-overlay elements emit actionable warnings.
- Add scenario-backed tests before changing scoring.

### `packages/timeline` and `packages/remotion`

Do not add evaluation logic directly into rendering. Prefer a separate eval harness or package that consumes manifest, timeline, screenshots, and MP4 artifacts.

Potential follow-ups:

- Deterministic sentinel frame extraction.
- Contact sheet generation.
- Static checks for overlay/caption bounds using timeline + dimensions.

### `packages/authentication`

Add eval fixtures and result classifications before changing package behavior.

Potential follow-ups:

- CI-safe expired/invalid profile fixture.
- Structured classification mapping for `AUTH_*` errors in the harness.

### `skills/democraft-product-demo`

Add validation around the existing skill:

- Compile templates against current package versions.
- Execute bundled scripts in CI.
- Add trigger and non-trigger prompt fixtures.
- Add drift checks between skill command examples and CLI help.
- Clarify that current deterministic evals score Discovery only until full reliability harness lands.

### Documentation

Keep English and pt-BR docs synchronized for public behavior. Before release readiness, add concise docs for:

- Eval harness usage.
- Failure classification taxonomy.
- Skill installation.
- What current metrics do and do not prove.

## Compatibility Risks

- Changing CLI JSON output for existing commands can break users and tests.
- Moving `DemoPlan` into public packages could accidentally create a second authoring DSL; keep it harness-side unless product need is proven.
- Adding visual evaluation inside renderer could violate the renderer's decoupled artifact-only boundary.
- Scenario-specific Discovery tweaks would weaken product reliability; fixes must generalize.
- Auth evals must avoid real credentials and avoid storing browser state in committed fixtures.
- Packed Studio verification depends on Next production artifacts and package `files`; failures may surface packaging rather than code issues.

## Explicit Assumptions

- The user-provided action plan is the intended roadmap.
- Existing `evals/agent-authoring` scenarios are valid prior work and should be reused or migrated, not discarded.
- `DemoPlan` should remain external or harness-level until there is evidence that a public schema is necessary.
- Generated `.democraft/` artifacts remain out of source control.
- Existing untracked files outside this audit are user work and should not be modified.

## Test Coverage Observed

The repository has broad unit and integration tests, including:

- Authentication errors, repository, validation, interactive flows.
- CLI audio, discover, index, Studio paths/runtime.
- Compiler authoring and audio behavior.
- Core helpers.
- Playwright capture artifacts, discovery artifacts, discovery origin, scoring, snapshot, environment fingerprints, auth runtime integration.
- Preview and Remotion rendering helpers.
- Schema artifact/audio/discovery/identity validation.
- Studio API routes, mutation security, render lifecycle, render history, materialization, request security, path boundaries, source association, UI hooks/components.
- Timeline audio, estimate, and resolver behavior.

Notable gaps for this initiative:

- No full agent-reliability harness tests.
- No scenario/rubric/result schema validation tests for the action-plan contracts.
- No full `doctor -> discover -> DemoPlan -> demo.ts -> validate -> capture -> render -> evaluate -> repair` test.
- No deterministic visual quality scoring test.
- No skill install/drift tests.
- No clean packed-package consumer smoke test in this audit.

## Recommended Execution Order

1. Preserve the current `evals/agent-authoring` suite as Discovery-contract evidence.
2. Add `evals/agent-reliability/schema/` with scenario, rubric, and result JSON schemas.
3. Add a minimal reliability harness that runs one fixture through doctor and discovery, writes the action-plan-style result envelope, and classifies at least one environment/product failure.
4. Port or wrap the static landing-page scenario into the new reliability harness.
5. Port or wrap dashboard-navigation.
6. Add harness support for externally supplied `DemoPlan` and `demo.ts` without introducing a core package dependency on an LLM provider.
7. Extend the harness to validate, capture, render a draft, and preserve artifacts.
8. Define deterministic visual evidence primitives: sentinel frames first, contact sheet second.
9. Record a baseline report before changing Discovery, locator scoring, timeline, Remotion, or skill behavior.
10. Add remaining scenarios and only then prioritize hardening by frequency, severity, user impact, and repair confidence.

## Phase 0 Gate Decision

Large implementation should not begin until the new reliability harness contracts are agreed and added. The smallest coherent next implementation slice is:

1. `evals/agent-reliability/schema/*.schema.json`
2. `evals/agent-reliability/README.md`
3. A harness command capable of running one isolated fixture and producing one `result.json`
4. A static landing-page reliability scenario derived from the existing `evals/agent-authoring/01-static-landing-page`
5. A dashboard-navigation reliability scenario derived from the existing `evals/agent-authoring/02-dashboard-navigation`
6. One failure-classification path, preferably missing built CLI or blocked discovery origin

That slice should stop for review before expanding to the other eight scenarios or hardening product code.
