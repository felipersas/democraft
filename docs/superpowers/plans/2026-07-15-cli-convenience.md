# CLI Convenience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make common Democraft commands short, predictable, and strict while preserving the existing artifact-oriented commands.

**Architecture:** Keep `runCli` as the orchestration boundary, add a small conventional demo-path resolver, and reuse the existing compile, capture, timeline, and render functions for the high-level `render` path. The explicit `--manifest` and `--timeline` workflow remains supported as an advanced mode.

**Tech Stack:** TypeScript, pnpm, Vitest, Playwright capture artifacts, Remotion render artifacts.

---

### Task 1: Strict, understandable argument parsing

**Files:**
- Modify: `packages/cli/src/args.ts`
- Modify: `packages/cli/src/types.ts`
- Test: `packages/cli/src/index.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add expectations that `--output` and `-o` populate `outputFile`, while unknown flags, missing flag values, and unexpected positional arguments populate a parse error.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @democraft/cli test -- --run src/index.test.ts`

Expected: the new parser assertions fail because aliases and parse errors are not implemented.

- [ ] **Step 3: Implement table-driven strict parsing**

Return the existing parsed fields plus `parseError?: string`. Treat values beginning with `--` as missing values and report the exact offending flag. Preserve every existing flag.

- [ ] **Step 4: Reject parser errors before command dispatch**

In `runCli`, return `fail(args.parseError)` before numeric validation or side effects.

- [ ] **Step 5: Run the focused test**

Run: `pnpm --filter @democraft/cli test -- --run src/index.test.ts`

Expected: parser robustness tests pass.

### Task 2: Conventional demo discovery

**Files:**
- Modify: `packages/cli/src/paths.ts`
- Modify: `packages/cli/src/run.ts`
- Test: `packages/cli/src/index.test.ts`

- [ ] **Step 1: Write failing discovery tests**

Cover `demo.ts`, `src/demo.ts`, no candidate, and ambiguous candidates. Verify `validate` can run without an explicit demo argument when exactly one conventional file exists.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @democraft/cli test -- --run src/index.test.ts`

Expected: missing-path and unresolved helper failures.

- [ ] **Step 3: Add `resolveDemoPath`**

Resolve an explicit path unchanged. Otherwise check `<invocationRoot>/demo.ts`, `<invocationRoot>/demo.tsx`, `<invocationRoot>/src/demo.ts`, and `<invocationRoot>/src/demo.tsx`. Return the sole match, explain the supported convention when none exist, and require an explicit path when multiple exist.

- [ ] **Step 4: Apply discovery to demo-based commands**

Use discovery for `studio`, `inspect`, `targets`, `validate`, `capture`, `timeline`, and high-level `render`. Keep artifact-only `preview` and `render --manifest --timeline` valid without a demo.

- [ ] **Step 5: Run the focused test**

Run: `pnpm --filter @democraft/cli test -- --run src/index.test.ts`

Expected: discovery and existing path behavior pass.

### Task 3: One-command render pipeline

**Files:**
- Modify: `packages/cli/src/run.ts`
- Test: `packages/cli/src/index.test.ts`

- [ ] **Step 1: Write a failing high-level render test**

Run `runCli(["render", demoPath, "--output", outputFile])` and assert that it compiles, captures, resolves a timeline, writes the managed intermediate timeline beside the capture manifest, and invokes `renderDemoVideo` with the generated visual entry.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @democraft/cli test -- --run src/index.test.ts`

Expected: failure with the current missing manifest/timeline error.

- [ ] **Step 3: Extract shared render execution**

Move artifact validation and `renderDemoVideo` invocation into a private helper receiving `{args, manifest, manifestPath, timeline, timelinePath, demoPath}` so both high-level and explicit-artifact modes use identical compatibility, recording, visual-entry, and failure-metadata behavior.

- [ ] **Step 4: Implement the high-level pipeline**

For `render <demo>` without artifact flags: compile and validate, call `runDemo`, resolve the timeline using definition FPS or `--fps`, save `timeline.json` in the unique capture directory, and call the shared render helper. If only one of `--manifest` or `--timeline` is supplied, return an actionable paired-input error.

- [ ] **Step 5: Make static validation the default**

Allow `democraft validate demo.ts`; retain `--static` as a compatible no-op until additional modes exist.

- [ ] **Step 6: Run CLI tests**

Run: `pnpm --filter @democraft/cli test`

Expected: all CLI tests pass, including legacy artifact rendering.

### Task 4: Help and public documentation

**Files:**
- Modify: `packages/cli/src/help.ts`
- Modify: `packages/cli/README.md`
- Modify: `apps/docs/content/cli/overview.mdx`
- Modify: `apps/docs/content/cli/overview.pt-BR.mdx`
- Modify: `apps/docs/content/quickstart.mdx`
- Modify: `apps/docs/content/quickstart.pt-BR.mdx`

- [ ] **Step 1: Rewrite help around common workflows**

Lead with `democraft studio [demo.ts]`, `democraft render [demo.ts]`, and `democraft validate [demo.ts]`. Label `--manifest`, `--timeline`, and `--entry` as advanced artifact controls and document `--output` / `-o`.

- [ ] **Step 2: Update English and Portuguese docs**

Show the installed-package commands first. Keep the monorepo `pnpm --filter ... tsx` form only in contributor documentation. Explain conventional demo discovery and the explicit artifact escape hatch.

- [ ] **Step 3: Verify all touched surfaces**

Run: `pnpm lint && pnpm typecheck --force && pnpm exec turbo test --force && pnpm exec turbo build --force`

Expected: zero failures across lint, typecheck, tests, and builds.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors and only CLI convenience, tests, plan, and documentation changes.
