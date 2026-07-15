# Render Artifact History Implementation Plan

> **For agentic workers:** Execute tasks in order, keep API compatibility, and verify each task before proceeding.

**Goal:** Prevent default video renders from overwriting earlier results while creating a minimal, durable metadata trail shared by CLI and Studio.

**Architecture:** Add a Node-only artifact lifecycle beside the existing server renderer. It owns unique IDs, managed paths, metadata transitions and atomic promotion; `renderDemoVideo` remains unchanged. CLI opts into managed artifacts only when no explicit output file is supplied. Studio always uses managed artifacts.

**Tech Stack:** TypeScript, Node `fs/path/crypto`, Vitest, pnpm/Turborepo, Remotion.

---

## Constraints

- Do not change `renderDemoVideo(options)` signature.
- Preserve exact `--output-file` behavior.
- Do not migrate capture directories in this change.
- Do not add a database or dependency.
- Do not claim atomicity across filesystems; temp and final live in one directory.

## Task 1: Artifact primitives

**Files:**

- Create: `packages/remotion/src/artifacts.ts`
- Modify: `packages/remotion/src/server.ts`
- Modify: `packages/remotion/src/index.ts`
- Test: `packages/remotion/src/artifacts.test.ts`

- [ ] Define metadata v1 and statuses `rendering/completed/failed/cancelled`.
- [ ] Sanitize demo ID to a non-empty slug.
- [ ] Generate UTC timestamp + `randomBytes` short ID.
- [ ] Create `<root>/<slug>/<timestamp-shortid>` with collision retry.
- [ ] Write metadata atomically using sibling temp + rename.
- [ ] Return final and temporary video paths.
- [ ] Promote temp video only on completion.
- [ ] Remove temp file best-effort on failure/cancel.
- [ ] Test deterministic clock/random injection, hostile slugs and transitions.

## Task 2: CLI compatibility adapter

**Files:**

- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/index.test.ts`

- [ ] If `--output-file` exists, retain current call and stdout.
- [ ] Otherwise create a managed artifact rooted at `.democraft/renders`.
- [ ] Record source paths and effective render config.
- [ ] Render to temp MP4, promote, mark completed.
- [ ] On error mark failed and rethrow so existing top-level behavior remains.
- [ ] Assert consecutive renders use different paths and metadata is valid.
- [ ] Assert explicit output does not create a managed directory.

## Task 3: Studio queue adapter

**Files:**

- Modify: `packages/studio/lib/render-queue.ts`
- Test: existing/new Studio render queue tests where practical.

- [ ] Replace timestamp filename with managed artifact.
- [ ] Use job creation time/config in metadata.
- [ ] Point UI `outputPath` at final `video.mp4`.
- [ ] Complete/promote only after renderer success.
- [ ] Persist `failed` or `cancelled` and original error.
- [ ] Keep serialized one-at-a-time queue behavior.

## Task 4: Reproducible lint

**Files:**

- Modify: `eslint.config.mjs`

- [ ] Ignore `**/.next/**` and other repository-generated source caches.
- [ ] Confirm lint result no longer depends on running build first.

## Task 5: Verification

- [ ] Run focused artifact tests uncached.
- [ ] Run CLI, Remotion and Studio tests uncached.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck --force` equivalent through Turbo.
- [ ] Run full tests with Turbo cache bypassed.
- [ ] Run full build with Turbo cache bypassed.
- [ ] Inspect `git diff --check` and final status.

## Acceptance criteria

1. Two default renders never target the same final file under normal or same-millisecond execution.
2. Successful managed render has `metadata.json` with `completed` and `video.mp4`.
3. Failed/cancelled managed render has terminal metadata and no promoted final video.
4. CLI `--output-file` and public renderer API remain source-compatible.
5. Lint, typecheck, tests and build are green from the post-build workspace.

## Follow-up, explicitly out of scope

- capture history and `latest` resolution; **entregue na fase P1B**
- definition hash and staleness migration;
- run listing/removal/retention CLI;
- filesystem history UI;
- complete runtime schemas;
- security changes to Studio routes.

## Execution status (2026-07-15)

The render-history plan is implemented. Managed CLI and Studio renders use
unique artifact directories, atomic promotion, and terminal metadata for
success, failure, and cancellation; explicit CLI output remains compatible.
The Studio queue also contains preparation failures after artifact creation and
continues with later jobs.

The formerly out-of-scope identity migration was completed as a compatible
follow-up: versioned `definitionHash` and `captureHash` propagate through IR,
manifest, timeline, Studio provenance, preview/render validation, and managed
render metadata. A legacy artifact with no capture identity remains readable
but is `unknown`, never promoted to known-compatible from a newer IR and never
silently reused by Studio launch.

Remaining boundary work belongs to P1: `captureHash` does not fingerprint the
capture environment, and the long-lived Studio process cache-busts only the
demo entry module, not its transitive ESM imports. No safe existing isolation
mechanism was found in the repository, so this plan deliberately does not add
an ad hoc loader; worker/child-process or module-graph isolation should be
designed and tested separately.

Capture lifecycle advanced in P1B: managed capture runs now have unique crypto
IDs, versioned terminal metadata, atomic manifest writes, cooperative
`AbortSignal`, exhaustive Playwright cleanup and an atomic `latest.json` index.
Studio launch and recapture follow the latest completed run while retaining a
read-only legacy fallback. Explicit capture output remains exact and does not
silently join the managed store.

The corrective pass hardened this lifecycle with raw-ID namespace digests,
leased single-writer locks, scan-and-repair for stale pointers, canonical
contained screenshot paths and generation-based Studio materialization. These
changes preserve both the original legacy layout and the temporary slug-only
layout produced during the P1B rollout.

Runtime validation advanced in P1A: versioned Zod contracts and public parsers
now cover IR, capture manifest, render timeline, render metadata, and Studio
metadata. CLI and Studio readers no longer rely on unchecked JSON casts for
these artifacts. Compatibility is conservative: absent legacy hashes and
Studio schema version remain accepted, but malformed present hashes and unknown
versions fail before preview/render. JSON Schema publication and explicit
payload limits remain follow-up work.
