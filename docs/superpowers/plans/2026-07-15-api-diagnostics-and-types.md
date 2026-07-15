# API Diagnostics and Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute inline because the user explicitly requested no subagents. Steps use checkbox syntax for tracking.

**Goal:** Make the single TypeScript API easier to generate and repair through compile-time duration checks, optional targets, and actionable diagnostics.

**Architecture:** Keep runtime validation as the source of truth while adding template-literal duration types. Normalize omitted targets in `defineDemo`, enrich the shared diagnostic contract, and use one append-only `DCxxxx` catalog across compiler and Playwright.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm/Turborepo, MDX.

---

### Task 1: Type durations and allow target-free demos

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/define.ts`
- Test: `packages/core/src/index.test.ts`

- [x] Add compile-time tests proving `"1.5s"` and `"250ms"` are accepted, `"soon"` is rejected, and a demo without `targets` normalizes to an empty map.
- [x] Add `Duration = `${number}ms` | `${number}s`` and use it in `hold`, `TransitionOptions`, and captured duration steps.
- [x] Make `DemoInput.targets` optional while keeping `DemoDefinition.targets` required after normalization.
- [x] Run `pnpm --filter @democraft/core typecheck && pnpm --filter @democraft/core test` and expect PASS.

### Task 2: Enrich and unify diagnostics

**Files:**
- Modify: `packages/schema/src/diagnostics.ts`
- Modify: `packages/schema/src/schemas.ts`
- Modify: `packages/compiler/src/compile.ts`
- Modify: `packages/compiler/src/normalize.ts`
- Modify: `packages/compiler/src/validation.ts`
- Modify: `packages/playwright/src/diagnostics.ts`
- Modify: `packages/playwright/src/execute.ts`
- Modify: `packages/cli/src/format.ts`
- Test: `packages/compiler/src/index.test.ts`
- Test: `packages/playwright/src/index.test.ts`
- Test: `packages/cli/src/index.test.ts`

- [x] Extend `Diagnostic` with optional `path`, `suggestion`, and `docsUrl` fields and parse them through `diagnosticSchema`.
- [x] Add `DC003` for author callback failures and `DC201` for browser execution failures; replace the incorrect `MD102` and `MD201` codes.
- [x] Populate semantic paths and repair suggestions for invalid durations, unknown targets, invalid FPS, and runtime target failures.
- [x] Render diagnostic paths and suggestions in human CLI output while preserving JSON output unchanged.
- [x] Run focused schema, compiler, Playwright, and CLI tests and expect PASS.

### Task 3: Document and verify

**Files:**
- Modify: `apps/docs/content/reference/diagnostics.mdx`
- Modify: `apps/docs/content/reference/diagnostics.pt-BR.mdx`

- [x] Document the actual catalog and the actionable diagnostic fields.
- [x] Run `pnpm lint && pnpm typecheck --force && pnpm exec turbo test --force && pnpm exec turbo build --force` and expect all jobs to pass apart from existing Turbo missing-output warnings.
- [x] Commit with `git commit -m "feat: make authoring diagnostics actionable"`.
