# Compatible API Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan inline, task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Improve target inference, configuration flow, and compiler result handling without breaking `defineDemo`, existing scene methods, emitted `DemoIR`, or CLI commands.

**Architecture:** Keep the imperative DSL as the primary API and make its target map generic so scene methods accept only declared target IDs. Attach optional config to each definition, project the serializable compiler-owned settings into `CompilationResult`, and expose an additive discriminated compiler entry point while retaining `compileDemo` unchanged for existing consumers.

**Tech Stack:** TypeScript, Vitest, Zod-backed schema contracts, pnpm/Turborepo.

---

### Task 1: Preserve literal target IDs through the DSL

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/targets.ts`
- Modify: `packages/core/src/define.ts`
- Test: `packages/core/src/index.test.ts`

- [x] **Step 1: Add a compile-time regression test**

Create a demo from `defineTargets({ save: byRole("button", { name: "Save" }) })`, assert that `scene.click("save")` type-checks, and add `// @ts-expect-error` before `scene.click("missing")`. Assert with `expectTypeOf` that `keyof typeof targets` is `"save"`.

- [x] **Step 2: Verify the regression test fails typecheck**

Run: `pnpm --filter @democraft/core typecheck`

Expected: FAIL because the current `defineTargets` return type widens keys to `string`, making the `@ts-expect-error` directive unused.

- [x] **Step 3: Make authoring types generic**

Define `TargetMap<TTargetId extends string = string>`, `TargetId<TTargets>`, `DemoScene<TTargetId>`, `DemoCapture<TTargetId>`, and `DemoDefinition<TTargets>`. Return a mapped type from `defineTargets` and infer `TTargets` in `defineDemo` so all target-bearing scene methods receive the literal target union.

- [x] **Step 4: Verify core types and runtime behavior**

Run: `pnpm --filter @democraft/core typecheck && pnpm --filter @democraft/core test`

Expected: both commands PASS.

### Task 2: Carry definition config through compilation

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/compiler/src/types.ts`
- Modify: `packages/compiler/src/compile.ts`
- Modify: `packages/studio/lib/compile-demo-isolated.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/studio.ts`
- Modify: `packages/studio/lib/resolve-demo.ts`
- Test: `packages/compiler/src/index.test.ts`
- Test: `packages/cli/src/index.test.ts`
- Test: `packages/studio/lib/resolve-demo.test.ts`

- [x] **Step 1: Add failing config-flow tests**

Compile a definition containing `config: { fps: 30 }` and assert `result.config` equals `{ fps: 30 }`. Add CLI/timeline coverage proving explicit `--fps` wins and definition config supplies the default.

- [x] **Step 2: Verify the focused tests fail**

Run: `pnpm --filter @democraft/compiler test && pnpm --filter @democraft/cli test`

Expected: FAIL because `DemoDefinition` and `CompilationResult` do not contain config.

- [x] **Step 3: Implement the minimal serializable config projection**

Add optional `config?: DemoConfig` to `DemoDefinition`. Add `CompiledDemoConfig = Pick<DemoConfig, "fps">` and a required `config` field to `CompilationResult`; populate it without changing `DemoIR`. Parse this projection across Studio's isolated-process boundary and resolve FPS as `explicitFps ?? compilation.config.fps` in CLI and Studio timeline paths.

- [x] **Step 4: Validate invalid FPS consistently**

Emit `DC001` when definition-level FPS is non-finite or not greater than zero, using the existing diagnostic catalog and preserving CLI ownership of exit codes.

- [x] **Step 5: Verify compiler, CLI, and Studio**

Run: `pnpm --filter @democraft/compiler test && pnpm --filter @democraft/cli test && pnpm --filter @democraft/studio test`

Expected: all commands PASS.

### Task 3: Add a discriminated compiler result without breaking callers

**Files:**
- Modify: `packages/schema/src/diagnostics.ts`
- Modify: `packages/compiler/src/index.ts`
- Modify: `packages/compiler/src/compile.ts`
- Test: `packages/compiler/src/index.test.ts`

- [x] **Step 1: Add success and failure contract tests**

Call `compileDemoResult` with a valid demo and assert `{ ok: true, value, diagnostics }`; call it with an unknown target and assert `{ ok: false, diagnostics }` with no `value` property.

- [x] **Step 2: Verify the tests fail**

Run: `pnpm --filter @democraft/compiler test`

Expected: FAIL because `OperationResult` and `compileDemoResult` do not exist.

- [x] **Step 3: Add the shared result type and compatibility wrapper**

Export `OperationResult<T>` from schema. Implement `compileDemoResult` by calling the existing compiler path and discriminating on error-severity diagnostics. Keep `compileDemo` and its `{ ir, config, diagnostics }` result available so every current command remains source-compatible.

- [x] **Step 4: Run full verification**

Run: `pnpm lint && pnpm typecheck --force && pnpm exec turbo test --force && pnpm exec turbo build --force`

Expected: lint passes and every Turbo package task succeeds; only previously documented missing-output warnings may remain.

- [x] **Step 5: Commit the compatible API slice**

```bash
git add packages/core packages/schema packages/compiler packages/cli packages/studio docs/superpowers/plans/2026-07-15-compatible-api-redesign.md
git commit -m "feat: improve authoring api contracts"
```
