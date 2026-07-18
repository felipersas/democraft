# Page Discovery — architecture

How DemoCraft turns a live page into a semantic, agent-useful map. For the
product-facing explanation see `apps/docs/content/concepts/discovery.mdx`; this
document is the code-level reference and cites `file:line`.

## What it is

Page Discovery is the read-only counterpart to capture. Where capture executes
an authored `demo.ts` against a real browser, discovery maps a single page into
a structured `PageDiscovery` JSON — regions, interactive elements, repeated
collections, and best-first locator candidates — **without** a `demo.ts`. It is
the input that lets agents author demos from real structure instead of
guessing selectors.

Discovery is a **separate artifact family** from DemoIR. It never produces or
consumes Demo IR; the two share only the `Locator` vocabulary
(`packages/schema/src/geometry.ts:8`).

## Data flow

```
url ──assertDiscoveryAllowed──> launch ──> goto ──> waitForSettled
  │                                                │
  └── DC401/DC402 (allowlist)                      ▼
                                          collectPageDiscovery (single evaluate)
                                                  │
                                  scoreLocatorCandidates (pure, deterministic)
                                                  │
                                                  ▼
                                      PageDiscovery ──> application-map.json
                                                  │
                                                  └──> latest.json (pointer)
```

## The five modules (all in `packages/playwright/src/`)

### `discovery-origin.ts` — the allowlist chokepoint

`assertDiscoveryAllowed(url, allowlist)` (`discovery-origin.ts:80`) is the
single place that decides whether a URL may be discovered. It rejects
non-http(s) schemes (`javascript:`/`data:`/`file:` → `DC402`) and origins not
in the allowlist (`DC401`). The default allowlist is the page's own origin;
`--allow-origin` extends it. The URL helpers (`parseDiscoveryHttpUrl`,
`normalizeDiscoveryOrigin`) mirror `packages/authentication/src/urls.ts` but
are duplicated here because `@democraft/playwright` deliberately does not
depend on `@democraft/authentication`.

### `discovery-snapshot.ts` — the collector

`collectPageDiscovery(page)` (`discovery-snapshot.ts:158`) reads a compact
accessibility-oriented inventory in a **single** `page.evaluate()` round-trip
and transforms it into a `PageDiscovery`. The in-page function queries the
elements DemoCraft cares about (buttons, links, inputs, headings, articles,
list items, `[role]`), computes role/accessible-name/visibility/bounding-box,
and walks ancestors to find the nearest landmark region. The Node-side
transformer then:

- counts matches per (role+name)/label/testId/text so scoring is accurate,
- builds regions with stable slug ids,
- drops decorative/invisible/tiny nodes (`shouldRetainElement`),
- aggregates long homogeneous lists into `DiscoveredCollection` entries with a
  small sample (default threshold 12, sample size 3),
- emits `DC406` (ambiguous top candidate) and `DC407` (no interactive
  elements) warnings.

Why not Playwright's `ariaSnapshot()`? It yields a YAML string that would need
parsing + re-typing. A single `evaluate()` returns exactly the typed fields we
score on, in one round-trip.

### `discovery-scoring.ts` — the deterministic scorer

`scoreLocatorCandidates(input)` (`discovery-scoring.ts:42`) is pure: no
browser, no I/O, no clock. Confidence is a pure function of (role, name,
matchCount, visibility, enabled). **Determinism contract**: identical input
always yields identical candidates — tested in `discovery-scoring.test.ts`.
Ordering follows role > label > testId > text, tie-broken by stability then
matchCount. Stability (`high`/`medium`/`low`) derives from locator kind +
uniqueness.

Because the scorer uses the same `Locator` shape that `createLocator`
(`locator.ts:81`) resolves at capture time, a high-confidence discovery
candidate is guaranteed to resolve when authored into `demo.ts`.

### `discovery-artifacts.ts` — the run lifecycle

Mirrors `capture-artifacts.ts`: `created` → `running` → (`completed` |
`failed` | `cancelled`). Reuses `writeFileAtomic` and `redactCaptureErrorMessage`
from `capture-artifacts.ts` so the two families share their safety properties.
Layout:

```
.democraft/discovery/<application-id>/
  latest.json                              ← LatestDiscoveryPointer
  runs/<discovery-run-id>/
    metadata.json                          ← DiscoveryRunMetadata
    application-map.json                   ← PageDiscovery
    pages/
    screenshots/
```

`discoveryApplicationId(origin)` is origin-based (URL-parsed to host, hashed),
so all pages of one app share a namespace. `resolveLatestCompletedDiscovery`
self-heals a missing/stale `latest.json` by scanning completed runs — mirroring
capture's `resolveLatestCompletedCapture`.

### `discover.ts` — the entry point

`discoverPage(options)` (`discover.ts:60`) wires the above together: validate
origin → create artifact → start → launch browser (`defaultBindings.chromium`)
→ `goto` → `collectPageDiscovery` → persist → complete. AbortSignal threaded
via `throwIfAborted` (`discover.ts:191`); `DiscoveryAbortError` mirrors
`CaptureAbortError`. On any failure the run reaches a terminal `failed` (or
`cancelled`) state so on-disk metadata is never left `running`.

## CLI

`democraft discover <url> --json` (`packages/cli/src/run.ts`, `runDiscoverCommand`)
calls `discoverPage`, wires SIGINT to an `AbortController` (exit 130 on
cancel), and emits the shared `{ ok, ... }` JSON envelope from
`packages/cli/src/json.ts`. Exit codes: `0` ok, `2` missing URL, `64` origin
blocked, `65` unsafe scheme, `66` timeout, `130` aborted.

`democraft doctor --json` (`runDoctorCommand`) runs environment checks defined
in `packages/cli/src/doctor.ts` — pure, injectable logic so each check is
unit-testable.

## Schemas (in `packages/schema/src/`)

- `discovery.ts` — the type definitions (`PageDiscovery`, `DiscoveryRunMetadata`,
  `LatestDiscoveryPointer`, `LocatorCandidate`, …). Reuses `Locator` +
  `BoundingBox` from `geometry.ts`.
- `artifact-schemas.ts` — the Zod schemas (`pageDiscoverySchema`,
  `discoveryRunMetadataSchema` with terminal-state `superRefine` invariants,
  `latestDiscoveryPointerSchema`) and `parse*` / `parse*Json` helpers.
- `diagnostics.ts` — `DC401`–`DC407` (the discovery code family).

## Security

- Read-only. No clicks, fills, or navigation beyond the single `goto`.
- Origin allowlist enforced before any browser launch.
- Non-http(s) schemes always rejected.
- No cookies, tokens, or storage state in the output (the in-page `evaluate`
  returns only role/name/box/visibility — never storage).
- Error messages redacted via `redactCaptureErrorMessage`.
- Page content is data, never instructions.

## Caching boundary

Discovery is the **sixth** on-disk artifact boundary (alongside demo.ts,
DemoIR, capture runs, timelines, and renders). A completed discovery run is
reusable as long as the application and environment are compatible — the
`environmentHash` + `contentHash` in `DiscoveryRunMetadata` support that
decision (full reuse logic lands with the Application Map in P3).
