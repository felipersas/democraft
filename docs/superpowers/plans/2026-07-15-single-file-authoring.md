# Single-File Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute inline because the user explicitly requested no subagents. Steps use checkbox syntax for tracking.

**Goal:** Let developers and LLMs define a complete runnable demo in one `demo.ts` without a separate `targets.ts` or config file.

**Architecture:** `defineDemo` accepts the same `TargetInput` values as `defineTargets` and normalizes only non-normalized target maps. Existing definitions that already use `defineTargets` retain their object identity and runtime behavior, while inline definitions receive the same normalized `DemoDefinition` consumed by compiler, CLI, and Studio.

**Tech Stack:** TypeScript, Vitest, pnpm/Turborepo, MDX documentation.

---

### Task 1: Normalize inline targets in `defineDemo`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/targets.ts`
- Modify: `packages/core/src/define.ts`
- Test: `packages/core/src/index.test.ts`

- [x] **Step 1: Add the failing single-file API test**

```ts
const definition = defineDemo({
  id: "save-profile",
  title: "Save profile",
  source: { baseUrl: "http://localhost:3000" },
  targets: { save: byRole("button", { name: "Save" }) },
  async run({ demo }) {
    await demo.scene("save", async (scene) => {
      await scene.click("save");
      // @ts-expect-error Target "missing" is not declared by this demo.
      await scene.click("missing");
    });
  },
});

expect(definition.targets.save).toEqual({
  id: "save",
  locators: [{ kind: "role", role: "button", name: "Save" }],
});
```

- [x] **Step 2: Verify the test fails before implementation**

Run: `pnpm --filter @democraft/core typecheck`

Expected: FAIL because `DemoDefinition.targets` currently requires normalized `TargetDefinition` values.

- [x] **Step 3: Add the authoring input and normalization contracts**

```ts
export type DefinedTargets<TTargets extends Record<string, TargetInput>> = {
  [TTargetId in keyof TTargets]: TargetDefinition;
};

export type DemoInput<
  TTargets extends Record<string, TargetInput> = Record<string, TargetInput>,
> = {
  id: string;
  title: string;
  config?: DemoConfig;
  source: { baseUrl: string; initialPath?: string };
  targets: TTargets;
  run(args: { demo: DemoCapture<Extract<keyof TTargets, string>> }):
    | Promise<void>
    | void;
};
```

Move `DefinedTargets` to `types.ts`, reuse it from `targets.ts`, and implement `defineDemo` as:

```ts
export function defineDemo<TTargets extends Record<string, TargetInput>>(
  definition: DemoInput<TTargets>,
): DemoDefinition<DefinedTargets<TTargets>> {
  if (hasNormalizedTargets(definition.targets)) {
    return definition as DemoDefinition<DefinedTargets<TTargets>>;
  }
  return { ...definition, targets: defineTargets(definition.targets) };
}
```

`hasNormalizedTargets` returns true only when every entry has `id` equal to its map key and a `locators` array.

- [x] **Step 4: Verify core behavior**

Run: `pnpm --filter @democraft/core typecheck && pnpm --filter @democraft/core test`

Expected: PASS, including the existing `defineTargets` path and the new inline path.

### Task 2: Make single-file authoring the documented default

**Files:**
- Modify: `apps/docs/content/sdk/define-demo.mdx`
- Modify: `apps/docs/content/sdk/define-demo.pt-BR.mdx`
- Modify: `apps/docs/content/examples/basic.mdx`
- Modify: `apps/docs/content/examples/basic.pt-BR.mdx`
- Modify: `examples/basic-demo/src/demo.ts`
- Delete: `examples/basic-demo/src/targets.ts`

- [x] **Step 1: Replace the primary example with one complete file**

Use this exact shape in both language variants:

```ts
import { byTestId, defineDemo } from "@democraft/core";

export default defineDemo({
  id: "create-project-live",
  title: "Create a project live",
  source: {
    baseUrl: "http://localhost:4173",
    initialPath: "/dashboard",
  },
  targets: {
    dashboard: byTestId("dashboard"),
  },
  async run({ demo }) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
      await scene.establish("dashboard");
      await scene.caption("Create a workspace in seconds.");
      await scene.hold("5000ms");
    });
  },
});
```

State that extracting targets or config is optional organization for larger demos, not required setup.

- [x] **Step 2: Run full verification**

Run: `pnpm lint && pnpm typecheck --force && pnpm exec turbo test --force && pnpm exec turbo build --force`

Expected: all workspace jobs pass; existing Turbo warnings for packages without configured outputs may remain.

- [x] **Step 3: Commit the single-file API**

```bash
git add packages/core apps/docs/content docs/superpowers/plans/2026-07-15-single-file-authoring.md
git commit -m "feat: support single-file demo authoring"
```
