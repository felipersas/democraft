# Native authentication: architecture investigation and technical plan

Status: Implemented in the v1 local-first authentication release. This document
retains the original investigation, decisions, boundaries, and verification
criteria as the architectural record for the shipped implementation.

## Scope and evidence

This document records the integration points and decisions for native,
reusable authentication profiles. Code investigation used only the repository's
CodeGraph index, as required. `codegraph node` reported that `PRODUCT.md` and
`DESIGN.md` cannot be indexed because they are Markdown; after that explicit
tool limitation, the orchestrator authorized a targeted direct read of only
those two normative documents. Their requirements are incorporated below.

The current implementation already accepts a raw Playwright `storageState` path
through `--storage-state`. This is a useful low-level proof, but it exposes a
sensitive filesystem detail to callers and has no profile lifecycle,
validation, expiry detection, isolation policy, or Studio management.

## Current architecture

### Authoring and compilation

- `packages/core/src/types.ts` defines `DemoInput`, `DemoConfig`, and the scene
  authoring surface. `DemoConfig` currently keeps `environment` and `outputs`
  as open records, while the source contains `baseUrl` and `initialPath`.
- `packages/compiler/src/types.ts` deliberately narrows compiled configuration
  to `fps`; capture behavior lives in `DemoIR` and runtime options. An auth
  profile reference must survive compilation explicitly instead of being
  smuggled through `environment`.
- A first version should associate one optional profile with the demo. Scene
  overrides should be reserved in the domain contract but not implemented.

### Browser runtime and scene execution

- `packages/playwright/src/runner.ts` is the single browser lifecycle boundary.
  `runDemoWithBindings` launches Chromium, creates exactly one context and one
  page, then executes every step of every scene sequentially in that same page.
  It closes the context and browser after tracing and video finalization.
- Context creation already passes `storageState` from
  `RunDemoOptions.environment`. Consequently all scenes in one run already
  share one restored session, and independent `runDemo` calls naturally use
  isolated contexts.
- `packages/playwright/src/environment-fingerprint.ts` hashes the contents of
  the configured storage-state file into capture compatibility. This avoids
  reusing a capture after the session state changes, but the profile ID and
  validation result are not represented.
- `BrowserContextLike` exposes only `newPage`, `close`, and tracing. Interactive
  login requires extending the binding boundary with context `storageState()`;
  validation requires page primitives such as final URL and locator visibility,
  while response-status validation may require a separate optional adapter.
- Authentication preflight occurs **before `createCaptureArtifact`** so a failed
  session creates no run directory, trace, video, screenshots, or misleading
  failure artifact. Resolve and validate with a short-lived, unrecorded context
  (no tracing and no `recordVideo`) loaded from an immutable in-memory snapshot
  of the profile state. Close it, then create a fresh recorded context from the
  exact same snapshot and execute every scene there. Validation navigation can
  therefore never appear in the video/trace or mutate recording state. Never
  write either context back to the stored profile implicitly.

### CLI and Studio/runtime communication

- `packages/cli/src/run.ts` owns top-level command dispatch. Its flat command
  list currently includes inspect, validate, capture, timeline, preview, render,
  studio, and targets. Auth commands should delegate to shared application
  services rather than add persistence or Playwright logic to this dispatcher.
- `packages/cli/src/studio.ts` compiles and captures before starting Studio,
  materializes data under `<workspace>/.democraft/studio-data`, then spawns the
  Next.js server on loopback. It passes trusted paths and a random per-process
  session token through environment variables.
- The current raw storage-state path is forwarded in
  `DEMOCRAFT_STUDIO_STORAGE_STATE` and read by `trustedStorageState()` for
  recapture. Replace this public/raw-path flow with an abstract profile ID;
  only the server-side service resolves the state path.
- Studio mutations use same-origin loopback checks plus
  `x-democraft-studio-token`. New profile create/login/validate/rename/delete
  routes must use `authorizeStudioMutation`; read routes must remain loopback
  scoped and return metadata only.
- `packages/studio/app/api/recapture/route.ts` recompiles, runs Playwright,
  resolves the timeline, materializes output, and publishes progress over SSE.
  Auth validation must run before `runDemo` emits capture steps/artifacts and
  publish a distinct actionable auth event/error.

### Local persistence and filesystem safety

- Managed project artifacts currently live in `<workspace>/.democraft`; Studio
  data is atomically materialized by generation-directory swap.
- Studio filesystem helpers enforce canonical containment, reject escaping
  symlinks, use exclusive temporary files, and atomically rename them. The auth
  repository should reuse these semantics in a package-neutral infrastructure
  module.
- Browser state must not be placed in `studio-data`, capture artifacts,
  manifests, diagnostics, or client `localStorage`. Those surfaces are visible
  to the UI and potentially to an LLM.
- Proposed local root: `<workspace>/.democraft/auth/v1/`, with one opaque
  directory per generated profile ID. The exact versioned layout is specified
  below. Store metadata separately from `state.json`, use secret-specific atomic
  writes, reject symlinks, and set directories to `0700` and files to `0600`
  where supported. Add `/.democraft/auth/` to the workspace `.gitignore`
  idempotently, preserving existing bytes/line endings and appending one line
  only when no equivalent rule exists. A failure to update `.gitignore` is a
  visible warning and requires explicit acknowledgement before the first secret
  state write; the system must not claim the state is protected from Git.
- Treat the persisted state as immutable during capture: read the base state,
  create a fresh Playwright context, discard it after the run. Only successful
  explicit login/renew operations replace `state.json`.

### Errors, diagnostics, and redaction

- Schema diagnostics use stable codes, severity, user message, suggestion,
  documentation URL, scoped IDs, and optional details. Runtime failures also
  persist capture failure metadata, while Studio recapture redacts messages
  before returning them.
- Authentication needs typed application errors independent of presentation:
  `AUTH_PROFILE_NOT_FOUND`, `AUTH_NOT_CONFIGURED`, `AUTH_LOGIN_REQUIRED`,
  `AUTH_SESSION_EXPIRED`, `AUTH_STATE_CORRUPT`, `AUTH_VALIDATION_FAILED`,
  `AUTH_UNAVAILABLE_IN_CI`, and `AUTH_OPERATION_FAILED`.
- The safe public shape is `{code, profileId, status, actionRequired, message,
stage, sanitizedUrl?, criterion?}`. Never include state paths, cookies,
  authorization headers, tokens, local/session storage, secret values, or raw
  Playwright errors. Add authentication diagnostic codes to the central schema
  only when the failure belongs in a recorded artifact; pre-capture failures
  should be typed operational errors and must not create a misleading capture.

## Proposed contracts

```ts
type AuthenticationStatus =
  | "not-configured"
  | "authenticating"
  | "authenticated"
  | "expired"
  | "invalid"
  | "error";

type AuthenticationStrategy = { type: "interactive" };

type AuthenticationValidation = {
  url: string;
  expect?: { selector: string; state?: "visible" } | { urlNotMatching: string };
};

type AuthenticationProfile = {
  id: string;
  name: string;
  origin: string;
  strategy: AuthenticationStrategy;
  status: AuthenticationStatus;
  validation: AuthenticationValidation;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
};

type AuthenticationActionRequired =
  | "none"
  | "interactive-login"
  | "choose-profile"
  | "repair-state"
  | "retry"
  | "confirm-force-remove"
  | "provide-state";

type DemoAuthentication = { profileId: string };
```

Profile DTOs expose only metadata. Internal repository results pair metadata
with an opaque state handle; only browser infrastructure may resolve that
handle. Profile IDs are generated opaque IDs (`auth_` + 26 lowercase ULID
characters) and never change. Names are mutable, non-unique display labels;
the CLI accepts only stable IDs for mutating commands and may show names beside
them. Origin is normalized as described below.

### Exact authoring, compiler, and IR propagation

Add `authentication?: { profileId: string }` to `DemoInput` beside `source`,
not inside the open `config.environment` record. Add the identical optional
field to `DemoIR` and its Zod schema. `compileDemo` copies it verbatim into IR;
it does not resolve local profiles. Both `definitionHash` and `captureHash`
include the canonical authentication object because changing a profile changes
capture behavior. `CompilationResult.config` remains `Pick<DemoConfig, "fps">`.

Static validation trims nothing and emits errors without touching the local
repository: `DC109` for an empty/invalid profile ID at
`authentication.profileId`, and no diagnostic when authentication is absent.
Profile existence is an operational preflight concern because compilation must
remain deterministic across machines. Schema parsing allows the optional field
for backward compatibility; legacy IR without it remains unauthenticated.

### V1 compatibility decision

V1 supports interactive profiles only. Imported state is deferred because a
safe ownership/provenance UX is not yet specified. The existing
`--storage-state <path>` option remains backward compatible for `capture` and
`studio`, but is explicitly a deprecated low-level escape hatch: it is mutually
exclusive with `authentication.profileId`, bypasses profile management and
validation, and retains current fingerprint behavior. The CLI fails before
capture when both are supplied. No `auth import` command or imported strategy
is exposed in V1. Removal is a future major-version decision after migration
guidance exists.

### Versioned persistence envelope and layout

```text
<workspace>/.democraft/auth/v1/
  profiles.json                 # non-secret index/envelopes
  locks/index.lock
  profiles/<profile-id>/
    metadata.json               # non-secret profile envelope
    state.json                  # secret Playwright storage state
    operation.lock
```

Every JSON file is `{ "schemaVersion": 1, "data": ... }`; metadata also has
`revision: number` incremented on each committed mutation. Unknown versions are
never rewritten: list reports the affected entry as unavailable and direct
operations fail `AUTH_UNSUPPORTED_VERSION`/`repair-state`. Invalid JSON,
missing state, or metadata/state disagreement marks the profile `invalid` with
`AUTH_STATE_CORRUPT`; preserve files for diagnosis and require explicit remove
or renewal. Temporary files left by a crash are ignored and safely removed on
next locked operation. Since rename is atomic on one filesystem, the old file
is either intact or the new file is complete; no backup containing secret state
is ever created.

The index is a rebuildable cache, not authority. On missing/corrupt index, scan
contained metadata directories, reject invalid IDs/symlinks, rebuild under the
index lock, and report skipped entries. Metadata is authoritative for status;
state is authoritative only after its hash matches `stateSha256` in metadata.

### Validation contract

- Accept only absolute `http:` or `https:` origin/login/validation URLs.
  Normalize origin to `new URL(value).origin` (lowercase host, default port
  removed). Reject credentials, fragments, `data:`, `file:`, `javascript:`,
  `blob:`, and all other schemes. A relative validation URL resolves against
  the normalized origin; it must begin with `/`.
- Redirects follow Playwright's normal navigation policy up to its built-in
  redirect ceiling. Final URL is captured only after successful navigation.
  Navigation uses a configurable validation timeout clamped to 1–60 seconds,
  default 10 seconds. Timeout/network/TLS failures produce
  `AUTH_VALIDATION_FAILED`, not `expired`, because login state is unproven.
- Explicit selector validation uses a new narrow adapter method
  `page.locator(selector).waitFor({state: "visible", timeout})`; selectors are
  non-empty and capped at 2 KiB. This exact adapter is added to
  `PageLike`/bindings and mocked in tests; no direct Playwright API leaks into
  application services.
- Explicit success is: navigation succeeded, final URL does not match a
  configured login URL/pattern, and the expected selector becomes visible.
  A redirect to configured login URL/pattern is `expired`. Missing selector is
  `invalid` during create/renew and `expired` for a previously authenticated
  profile only when the final URL is also login-like; otherwise it is a
  validation failure that preserves prior status.
- Default heuristic, visibly labelled “Less reliable”, navigates to
  `validation.url` (or origin), requires a successful non-error document URL,
  and treats a final path containing case-insensitive `/login`, `/signin`, or
  `/auth` as expired. It never infers authentication from state-file existence.
- OAuth may redirect across origins during interactive login. Validation may
  target another HTTPS origin only when explicitly stored in profile metadata;
  no automatic widening occurs. Local HTTP is allowed for development.
  Private/loopback destinations are allowed because Studio is local, but every
  user-supplied URL is re-resolved at operation time and shown before browser
  launch; this is not a server-side fetch API and routes never return response
  bodies. DNS rebinding cannot expose file schemes because scheme checks occur
  before every navigation.

Playwright storage state persists cookies and local storage, but **not
sessionStorage**. V1 does not claim sessionStorage support. Apps whose session
depends on it must use the deprecated raw escape hatch/custom future adapter;
Studio displays this limitation before profile creation.

### Status state machine and concurrency

Allowed persisted transitions are:

```text
not-configured -> authenticating -> authenticated
not-configured -> authenticating -> invalid | error
authenticated  -> authenticating -> authenticated | expired | error
authenticated  -> authenticated | expired | error  # validate operation commits only its result
expired|invalid|error -> authenticating -> authenticated | invalid | error
```

`validating` is an ephemeral operation phase, not a persisted public status;
the stored status remains unchanged until the operation commits. A process
crash while persisted as `authenticating` is recovered to `error` with action
`interactive-login` when the expired lease is observed. Only successful
validation commits `authenticated` and `lastValidatedAt`. Login redirect commits
`expired`; corruption commits `invalid`; operational failures commit `error`
only for create/renew, while validate preserves the previous usable status and
records a safe `lastErrorCode`.

Mutations acquire the profile `operation.lock` with owner nonce, PID, created
time, 30-second renewable lease, and bounded wait. Expired leases may be stolen
atomically; live contention returns `AUTH_PROFILE_BUSY`. Index mutations also
take `index.lock`, always after the profile lock to prevent deadlock. Each write
uses expected `revision`; mismatch returns busy/conflict and retries reads once.
Readers snapshot metadata+state under shared optimistic revision/hash checks.

Rename changes only `name`, never ID or demo references. Names need not be
unique. Delete is rejected with `AUTH_PROFILE_IN_USE` and the safe list of demo
IDs unless `--force`/explicit Studio confirmation is supplied. Forced delete
removes the contained profile directory while locked, then repairs the index;
demo source files are never edited and subsequent capture reports not found.
Concurrent validate/renew/delete on one profile returns busy rather than
queuing invisibly; operations on different profiles may run concurrently.

### Error, HTTP, CLI, and action mapping

| Code                       | actionRequired         | HTTP | CLI exit | Meaning                      |
| -------------------------- | ---------------------- | ---: | -------: | ---------------------------- |
| `AUTH_PROFILE_NOT_FOUND`   | `choose-profile`       |  404 |        4 | Stable ID absent             |
| `AUTH_NOT_CONFIGURED`      | `choose-profile`       |  409 |        4 | Demo needs a profile         |
| `AUTH_LOGIN_REQUIRED`      | `interactive-login`    |  409 |        5 | No state yet                 |
| `AUTH_SESSION_EXPIRED`     | `interactive-login`    |  409 |        5 | Login redirect confirmed     |
| `AUTH_STATE_CORRUPT`       | `repair-state`         |  422 |        6 | State/envelope invalid       |
| `AUTH_UNSUPPORTED_VERSION` | `repair-state`         |  422 |        6 | Newer/unknown format         |
| `AUTH_VALIDATION_FAILED`   | `none`                 |  422 |        7 | Criterion/network failed     |
| `AUTH_PROFILE_BUSY`        | `retry`                |  409 |        8 | Concurrent operation         |
| `AUTH_PROFILE_IN_USE`      | `confirm-force-remove` |  409 |        9 | Delete needs confirmation    |
| `AUTH_UNAVAILABLE_IN_CI`   | `provide-state`        |  409 |       10 | Interactive flow unavailable |
| `AUTH_OPERATION_FAILED`    | `retry`                |  500 |        1 | Sanitized unexpected failure |

Extend `AuthenticationActionRequired` with `retry`, `confirm-force-remove`,
`provide-state`. All API errors use `{error:{code, message, profileId?, status?,
actionRequired, stage, sanitizedUrl?, criterion?}}`; never return arbitrary
`details`. Success uses 200, create 201, delete 204, and interactive start 202.
CLI human output uses the same message and next action; `--json` emits the exact
public object plus `ok:false`, writes it to stdout for machine parsing, and uses
the table's exit code. Studio maps the same codes to persistent inline status.

## Module ownership

Follow existing package boundaries rather than placing domain logic in React:

- `packages/core`: owns only the authored
  `authentication?: {profileId:string}` type.
- `packages/schema`: owns only serializable IR/profile public DTO/error schemas,
  stable codes, Zod parsing, and hash canonicalization; never filesystem paths.
- New shared `packages/authentication`: sole owner of profile-root resolution
  from an already-canonical workspace root, URL normalization, IDs, repository
  layout/versioning, contained secret writes, locks, status transitions,
  validation policy, application services, and public result contracts.
- `packages/playwright`: owns only browser adapters (interactive browser,
  context state capture/restoration, page navigation/selector operations). It
  receives bytes/objects and returns safe facts; it never resolves profile or
  workspace paths and never writes profile files.
- `packages/cli`: canonicalizes/authorizes workspace root once, parses commands,
  calls application services, and formats results. It does not reconstruct auth
  paths or inspect state JSON.
- `packages/studio`: obtains the canonical workspace root only through existing
  trusted launch authority, injects it into the same application services, and
  owns API/UI presentation. Routes do not resolve profile paths or call
  Playwright directly.

Application services should be `listProfiles`, `createProfile`, `renameProfile`,
`removeProfile`, `loginProfile`, `renewProfile`, `validateProfile`, and
`prepareAuthenticatedExecution`. Studio and CLI must call the same services.

Dependency direction is `core/schema <- authentication application -> ports`,
with filesystem and Playwright adapters injected at composition roots. There is
exactly one `AuthenticationPaths.fromWorkspace(canonicalRoot)` implementation;
CLI, Studio, runtime, tests, and migration code cannot duplicate path joining.

## Security guarantees and threat model

The V1 guarantee is local isolation against accidental publication, path
traversal, cross-profile mixing, logs/LLM exposure, partial writes, and ordinary
multi-process races. `0700`/`0600` restrict other OS users where the filesystem
honors POSIX modes. Project-local state is **not encryption** and does not
protect against malware, privileged processes, backups, disk forensics, or any
process running as the same OS user. UI and docs must state this plainly.

The secret writer is authentication-owned and intentionally stricter than the
general Studio writer: canonicalize the workspace and every existing ancestor;
require containment beneath the exact auth root; reject symlinks and non-regular
files for root, version, profile directory, target, lock, and temp path; open
temporary state with `wx`, mode `0600`, and no inherited-readable window;
`fsync` the temp file, rename in place, `fsync` the directory, then verify final
mode and hash. It never creates backups, copies state, embeds state in metadata,
or writes outside the profile directory. Directories are created/verified
`0700`; unsupported mode enforcement yields a documented warning, not a false
security claim.

Delete resolves and verifies the stable ID path without following links, unlinks
only known files under the contained directory, and removes the empty directory;
it never uses an unresolved recursive target. Logs use event name, stable ID,
stage, safe status, and sanitized origin only. Central redaction removes cookie,
authorization, bearer/JWT, password/secret/token, local-storage values, state
paths, query strings, URL credentials, and raw browser errors from logs, SSE,
API, capture metadata, diagnostics, CLI JSON, and test snapshots.

Required adversarial tests cover `..`/absolute/prefix-sibling traversal,
symlinked roots/directories/files/locks/temp targets, dangling/racing symlinks,
wrong file types, permissive mode repair/failure, stale/live lock stealing,
revision races, crash before/after rename/fsync, unknown versions, corrupt/hash-
mismatched state, gitignore duplicate/newline/permission failures, and canary
secrets across every public/log/snapshot surface. A same-user read test documents
the non-guarantee rather than pretending modes prevent it.

## Studio product and design integration

Authentication extends the existing code-first chain without becoming a new
marketing-style page:

`demo.ts profile reference → authenticated capture → resolved timeline → Studio`

- The profile reference is source configuration. Profile metadata and browser
  state are local capture prerequisites, not Studio overrides and never implied
  to rewrite `demo.ts`.
- Put profile status and the selected profile near demo identity/freshness in
  the workspace header. Keep the preview and timeline dominant. Profile
  management belongs in a labelled inspector section or responsive sheet;
  guided login may use a proper dialog because it is a focused, interruptible
  workflow requiring explicit completion.
- Use the persistent single workspace, existing mutation security, explicit
  confirmations for renew/remove, named phases, and recovery actions. Do not
  create a decorative dashboard or expose roadmap-only strategy controls.
- Status is icon + literal text, never color alone: “Session valid”, “Login
  required”, “Session expired”. Include last validation as secondary metadata
  and keep failures attached until resolved. Long operations use an `aria-live`
  phase label such as “Opening browser…” or “Validating session…”.
- The auth surface uses the normative near-black neutral system, one indigo
  action/focus accent, sparse semantic colors, Schibsted Grotesk, Lucide icons,
  4px spacing rhythm, 6px controls, 32px desktop targets, and sentence case.
  It must not copy the current legacy mint/blue token values.
- Lists are continuous rows separated by hairlines, not nested cards. A profile
  row shows name, origin, status, validation time, usage, and contextual
  actions. Sensitive technical state is absent, not merely visually hidden.
- Interactive controls implement hover, focus-visible, active, disabled,
  loading, success, warning, error, and empty states where applicable. Dialogs
  trap/restore focus and close with Escape; every action has a visible pointer
  path and keyboard access.
- At 720–959px the management surface becomes a labelled drawer/sheet; below
  720px it becomes a full-height sheet with explicit Back/Close and 40px touch
  targets. Reduced motion replaces drawer transforms/spinners while preserving
  textual progress.
- Copy remains technical and literal: “Create profile”, “Validate session”,
  “Renew login”, “Remove profile”. Errors state the affected profile, safe
  stage, consequence, and next action without “Oops” or vague failure text.

### Accessibility and responsive acceptance matrix

| Surface             | Keyboard/focus acceptance                                                                                                                 | State/announcement acceptance                                                                                                    | Responsive acceptance                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Profile list        | Tab reaches row actions in visual order; arrow keys only if implemented as a composite; every icon action has name+tooltip                | Status always icon+word; origin/name truncation exposes full accessible text; empty state offers “Create profile”                | ≥1280 inspector 320px; 960–1279 at least 288px; 720–959 labelled drawer; <720 full-height sheet with Back/Close and 40px targets |
| Create/renew dialog | Focus trapped; initial focus on name or instructions; Escape/cancel closes; focus returns to invoker; completion is an explicit button    | Named phases in polite live region; errors remain attached with recovery; opening an external browser is announced before launch | ≤560px desktop dialog; at narrow/small widths use full-height sheet without horizontal overflow                                  |
| Validation action   | Labeled 32px button; disabled reason exposed while busy; retry remains keyboard reachable                                                 | “Validating session…” then durable icon+text result and last-validated time; reduced motion uses static icon/text                | Action never displaces demo identity/recapture; moves into overflow only with visible label at narrow widths                     |
| Rename              | Native labelled input; Enter submits, Escape cancels; focus returns to row                                                                | Inline associated validation preserves value; success changes visible name without toast-only feedback                           | One column below 960px; no clipped labels                                                                                        |
| Remove              | Explicit labelled destructive action; confirmation traps/restores focus; force requires a second explicit confirmation naming usage count | In-use demos listed safely; failure remains in dialog; no color-only warning                                                     | Confirmation becomes full-width sheet <720px with 40px actions                                                                   |
| Header status       | Reachable action after demo identity; no keyboard-only shortcut                                                                           | Profile name + status icon/text; expired state exposes direct “Renew login”; `aria-live` only on transition                      | Full label wide; compact keeps icon+status accessible label; narrow moves secondary metadata, never renewal/status               |

Acceptance additionally requires visible 2px indigo `:focus-visible`, ≥4.5:1
meaningful text, ≥3:1 component/focus boundaries, no meaningful use of
`--studio-subtle`, color-vision-safe icon+text encoding, logical
header→preview/transport→inspector→timeline order, reduced-motion alternatives,
200% zoom without lost controls, and automated axe checks plus manual
keyboard/screen-reader checks at 1440, 1100, 800, and 390 CSS pixels.

## Decision records

### ADR-001: metadata and browser state are separate

Accepted. Metadata is safe to serialize to Studio/CLI/LLM-facing contracts;
browser state is accessible only via an internal opaque handle. This makes
accidental exposure harder than relying on every caller to redact a combined
object.

### ADR-002: project-local, ignored persistence for v1

Accepted for the local-first release. Store profiles beneath
`<workspace>/.democraft/auth`, using restrictive permissions and atomic writes.
This matches existing project authority boundaries and keeps different projects
isolated. Cloud sync, encryption-at-rest key management, and CI transport remain
future extensions. File permissions are defense in depth, not encryption.

### ADR-003: immutable base state per capture

Accepted. Every execution restores the persisted base state into a fresh
context and discards mutations. Only an explicit successful login or renewal
can replace the base state. This guarantees isolation between profiles and
repeatability across executions.

### ADR-004: validate before creating a capture

Accepted. Profile existence, state loading, and protected-page validation run
in a separate unrecorded context before `createCaptureArtifact`. The fresh
recorded context is then created from the same immutable state snapshot. Expiry
updates profile metadata and raises a typed, actionable error; no invalid
recording is produced. A validation failure must not delete the profile.

### ADR-005: interactive login is the v1 primary strategy

Accepted. Interactive login uses a visible browser and explicit user completion,
then validates before atomically saving state. This supports OAuth, MFA, magic
links, CAPTCHA, and SSO without exposing credentials. Imported profile state,
form automation, and custom setup are deferred extension ports. The deprecated
raw `--storage-state` escape hatch remains supported outside profiles as
specified in the V1 compatibility decision.

### ADR-006: one profile per demo in v1

Accepted. The demo declares one optional profile reference. Every scene shares
the same authenticated context. Scene-level override syntax is deferred until a
real multi-role use case establishes lifecycle and safety semantics.

## Implemented package map

The planned boundaries are now represented by `@democraft/authentication`
(domain, repository, application services, errors and redaction),
`@democraft/playwright` (interactive and validation browser adapters plus
capture preflight), `@democraft/cli` (auth commands and structured output), and
the Studio metadata-only routes and management UI. Demo references propagate
through core, compiler and schema as `authentication.profileId`.

## Incremental implementation plan (completed v1 scope)

1. Foundation: add schemas/domain contracts, repository port and secure local
   adapter, typed errors/redaction, validation service, migrations/versioning,
   and unit tests for CRUD, corruption, permissions, isolation, and leakage.
2. Interactive login: extend Playwright binding interfaces with exact supported
   APIs, open headed Chromium, allow explicit completion/cancellation, validate,
   capture state, atomically persist, and test renewal/failure cleanup.
3. Studio: add metadata-only APIs, a compact management surface consistent with
   PRODUCT/DESIGN, guided creation/renewal, demo association, SSE progress, and
   route/component tests using existing security conventions.
4. Runtime: resolve the demo profile before artifact creation, validate in an
   unrecorded temporary context, close it, create a fresh recorded context from
   the same immutable state, execute all scenes there, mark expiry, prevent
   invalid artifacts, and test multi-scene reuse plus cross-profile/run
   isolation and absence of validation navigation in video/trace.
5. Developer/LLM experience: add `auth create|list|login|validate|remove`, JSON
   output with `actionRequired`, semantic messages, usage/security/CI docs, and
   a protected example application.

## Verification matrix for later phases

- Domain/repository: create, rename, list, load, remove, duplicate alias,
  corrupt metadata/state, restrictive permissions, atomic replacement, no
  secret in DTO/error/log/snapshot.
- Browser: successful restoration and validation, login redirect, expected
  selector absent, expired marking, renewal, cleanup after failure/cancel,
  separate contexts for profiles and runs.
- Integration: missing profile blocks before capture; multiple scenes share one
  context; recapture uses the selected profile; capture compatibility changes
  after explicit renewal; demo source contains only the profile reference.
- Studio/API: loopback/session-token enforcement, safe status codes and DTOs,
  SSE phases, no state endpoint, profile usage reporting, accessible keyboard
  and error states after design review.
- CLI: subcommand parsing, human and JSON output, headed login, CI failure,
  consistent service errors and exit codes.

## Risks and open gates

- Phase 4 must verify the implemented surface against the PRODUCT/DESIGN
  governance checklists, including keyboard, reduced motion, contrast, narrow
  layouts, source-of-truth wording, and no legacy mint/blue token adoption.
- Playwright's exact installed API and package version must be verified before
  implementation; do not invent `storageState` or launch signatures beyond the
  existing binding contract.
- Session-storage persistence is not guaranteed by Playwright storage state and
  requires an explicit documented extension if demanded by a target app.
- Multi-domain OAuth works for cookies/local storage represented by Playwright,
  but the profile's display origin must not constrain stored cookie domains.
- Profile metadata writes and login/renew/delete operations need a per-profile
  lock to avoid concurrent Studio/CLI corruption.
- Interactive completion needs a trusted local control channel and timeout; it
  must never infer success solely from the existence of a state file.
- CI must fail with `AUTH_UNAVAILABLE_IN_CI` when only a local interactive
  profile exists; encrypted import/key management is intentionally deferred.
