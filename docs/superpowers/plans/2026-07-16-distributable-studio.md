# Distributable Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This execution stays inline because the user explicitly asked not to use subagents.

**Goal:** Make the published `@democraft/cli` launch the packaged Studio with `npx democraft studio`, without relying on pnpm, workspace filters, or repository source files.

**Architecture:** Publish `@democraft/studio` as a production-built Next.js package and make it a runtime dependency of `@democraft/cli`. The CLI resolves both `@democraft/studio/package.json` and that package's own Next binary through Node module resolution, starts `next start` with `process.execPath`, and uses `next dev` only when running from a source checkout without a production build. Keep all user-workspace paths in the existing authenticated environment contract; only the server runtime moves into the installed Studio package.

**Tech Stack:** TypeScript, Node.js module resolution, Next.js 15, tsup, pnpm pack, Vitest.

**Status:** Completed and verified on 2026-07-16. The clean-install smoke test
used npm tarballs, `npx --no-install democraft studio`, a real Playwright
capture, the production Next server, `/` and `/api/data`, and clean shutdown.

---

### Task 1: Make the Studio production build valid

**Files:**
- Modify: `packages/studio/lib/compile-demo-isolated.ts`
- Modify: `packages/studio/package.json`
- Test: `packages/studio/lib/compile-demo-isolated.test.ts`

- [ ] **Step 1: Preserve the failing production-build evidence**

Run `pnpm --filter @democraft/studio exec next build` and verify that the generated server chunk contains `pathToFileURL(<numeric webpack module id>)` and fails while collecting page data.

- [ ] **Step 2: Add a runtime-resolution regression test**

Expose a small `resolveRuntimeModule(specifier)` boundary and assert that it returns an absolute filesystem path for `@democraft/compiler`. The specifier must remain dynamic at the call site so Webpack cannot replace it with an internal bundle ID.

- [ ] **Step 3: Run the focused test and verify the new assertion**

Run `pnpm --filter @democraft/studio test -- --run lib/compile-demo-isolated.test.ts`.

- [ ] **Step 4: Resolve the compiler package at Node runtime**

Replace the statically analyzable `require.resolve("@democraft/compiler")` expression with the tested runtime-resolution boundary, while preserving the isolated child-process protocol and compiler module URL.

- [ ] **Step 5: Add an explicit production build script and verify it**

Add `build:production: "next build"` and run `pnpm --filter @democraft/studio build:production`. Expected: `.next/BUILD_ID` exists and Next completes page-data collection.

### Task 2: Resolve and launch an installed Studio runtime

**Files:**
- Create: `packages/cli/src/studio-runtime.ts`
- Modify: `packages/cli/src/studio.ts`
- Modify: `packages/cli/src/index.test.ts`
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Write a failing runtime-selection test**

Specify the observable launch contract: production artifacts produce `process.execPath <resolved next binary> start --hostname 127.0.0.1 --port <port>` with the Studio package directory as `cwd`; a source checkout without `.next/BUILD_ID` produces the same command with `dev`; an installed package with neither build nor source throws an actionable packaging error.

- [ ] **Step 2: Run the CLI test and verify failure**

Run `pnpm --filter @democraft/cli test -- --run src/index.test.ts`.

- [ ] **Step 3: Implement package-manager-independent resolution**

Use `createRequire(import.meta.url)` to resolve `@democraft/studio/package.json`, create a resolver anchored to that manifest for `next/dist/bin/next`, inspect `.next/BUILD_ID` and `next.config.ts`, and return `{ command, args, cwd, mode }`.

- [ ] **Step 4: Replace the pnpm workspace spawn**

Have `startStudioServer` spawn the resolved Node command with `shell: false`, retain the existing authenticated environment, readiness detection, and signal forwarding, and update premature-exit errors to say `Studio server` rather than `Studio dev server`.

- [ ] **Step 5: Declare the Studio runtime dependency**

Add `@democraft/studio: "workspace:*"` to `@democraft/cli` dependencies so pnpm rewrites it to the matching registry version during pack/publish.

### Task 3: Publish the production Studio artifact

**Files:**
- Modify: `packages/studio/package.json`
- Add: `packages/studio/LICENSE`
- Modify: `Makefile`
- Modify: `turbo.json`

- [ ] **Step 1: Add public package metadata**

Set `@democraft/studio` to the common prerelease version, remove `private`, add MIT/repository/homepage/bugs/Node engine metadata, public npm `publishConfig`, and a `files` allowlist containing `.next`.

- [ ] **Step 2: Build before packing**

Set Studio `prepack` to the production build. Keep the normal Turbo `build`
task as the existing TypeScript gate; publishing performs the production build
and packages only the required `.next` runtime files.

- [ ] **Step 3: Insert Studio in release order**

Add `studio` after its runtime dependencies and before `cli` in the Makefile package list.

- [ ] **Step 4: Inspect the real tarballs**

Run `make pack`, inspect Studio and CLI tarball contents, and verify that Studio contains `.next/BUILD_ID` and no source cache, environment files, captures, or unrelated workspace files. Verify that the CLI manifest points to the packed Studio version.

### Task 4: Prove the npm-style user path

**Files:**
- Create or modify only test fixtures/scripts if the clean-install smoke test exposes a missing runtime file.

- [ ] **Step 1: Install only packed artifacts outside the workspace**

Create a temporary npm project, install the packed package graph using the generated tarballs, and run `npx democraft help` to prove the bin link.

- [ ] **Step 2: Launch the packaged Studio server**

Use a minimal valid demo plus existing capture fixtures or a controlled launch harness, execute the packed CLI from the temporary project, and verify the resolved runtime is production mode and the loopback server reaches readiness without pnpm on the command path.

- [ ] **Step 3: Check the HTTP surface and shutdown**

Request the Studio URL, verify an HTTP response from the packaged Next server, and terminate it cleanly so no child process remains.

### Task 5: Update public and maintainer documentation

**Files:**
- Modify: `README.md`
- Modify: `packages/cli/README.md`
- Modify: `packages/studio/README.md`
- Modify: `docs/releasing/npm.md`
- Modify: `apps/docs/content/quickstart.mdx`
- Modify: `apps/docs/content/quickstart.pt-BR.mdx`
- Modify: `apps/docs/content/cli/overview.mdx`
- Modify: `apps/docs/content/cli/overview.pt-BR.mdx`

- [ ] **Step 1: Lead with the npm executable**

Document `npm install -D @democraft/cli @democraft/core` followed by `npx democraft studio`, and show the pnpm and Bun equivalents without making them prerequisites.

- [ ] **Step 2: Remove the obsolete Studio blocker**

Explain that `@democraft/studio` is an implementation dependency installed through the CLI and normally should not be invoked directly. Update the release order and clean-install gate.

- [ ] **Step 3: Separate contributor commands**

Keep workspace-only commands such as `pnpm --filter @democraft/studio dev` solely in contributor documentation.

### Task 6: Final verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused package checks**

Run Studio and CLI tests, typechecks, CLI build, and Studio production build.

- [ ] **Step 2: Run the repository gate**

Run `make check` and `make publish-dry-run`.

- [ ] **Step 3: Review package and source diffs**

Run `git diff --check`, `git status --short`, and inspect the final diff and tarball inventory. Expected: no whitespace errors, no generated `.next` files tracked, and only the distributable-Studio implementation, tests, documentation, and plan are changed.
