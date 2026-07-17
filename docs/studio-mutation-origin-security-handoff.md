# Studio mutation security — definitive fix handoff

## Objective

Eliminate recurring `Studio mutation origin is not allowed.` failures without
disabling the protection that prevents arbitrary websites or remote clients
from controlling a local DemoCraft Studio instance.

This is an architecture fix, not another special case for `127.0.0.1`.

## Current state verified

The current branch is `fix/studio-playhead-perf`.

`packages/studio/lib/request-security.ts` currently authorizes a mutation only
when all of these conditions are true:

1. `request.url` has a loopback hostname;
2. the `Origin` header has a loopback hostname;
3. `origin.origin === new URL(request.url).origin`;
4. the request carries the per-process Studio session token.

The third condition is the recurring failure point:

```ts
origin.origin !== requestUrl.origin
```

The tests encode the same fragile assumption. They reject a request when the
browser origin and `request.url` use different ports or loopback aliases.

## Root cause

`Origin` describes the origin of the page making the browser request.
`request.url` inside a Next.js route is a framework-reconstructed URL. It is not
a reliable representation of the address shown in the browser.

They can be semantically equivalent but textually different because of:

- `localhost` versus `127.0.0.1`;
- IPv4 versus `[::1]`;
- forwarded host/protocol headers;
- Next.js development versus production runtime;
- a packaged Studio versus a source checkout;
- proxy or server URL reconstruction;
- stale generated bundles containing an older guard.

Comparing those two origins confuses routing information with authorization.
Adding more alias comparisons may hide individual cases, but it preserves the
unstable dependency and will fail again in another runtime combination.

## Threat model

The Studio must prevent:

- a remote network client from invoking local mutation endpoints;
- a malicious website from issuing effective cross-site mutations;
- a caller without the CLI-created session capability from mutating state;
- timing leakage while comparing the secret token.

The Studio does **not** need to distinguish `localhost`, `127.0.0.1`, and
`[::1]` as separate trusted applications. They are supported loopback access
forms for the same local tool.

## Recommended security contract

Authorize mutations using independent, stable invariants:

1. **Local server boundary** — the CLI starts Next bound explicitly to
   `127.0.0.1`, never `0.0.0.0`.
2. **Local request target** — the request target hostname must resolve to an
   explicitly supported loopback literal/name.
3. **Local browser origin** — when `Origin` exists, it must parse successfully
   and its hostname must be loopback. Do not compare it with `request.url`.
4. **Browser fetch metadata** — when `Sec-Fetch-Site` exists, require
   `same-origin`. Reject `cross-site`, `same-site`, and `none` for mutations.
5. **Session capability** — require the random per-process token in
   `x-democraft-studio-token` and compare it with `timingSafeEqual`.
6. **Fail closed** — return `503` when the CLI did not configure the expected
   token and `401` when the supplied token is absent or invalid.

The token is the primary mutation capability. Binding to loopback, checking a
local `Origin`, and Fetch Metadata are defense-in-depth layers. None depends on
Next.js reproducing the browser's URL exactly.

### Proposed decision flow

```ts
function authorizeStudioMutation(request: Request) {
  if (!hasLoopbackTarget(request)) return deny("non_loopback_target", 403);

  const origin = parseOptionalOrigin(request.headers.get("origin"));
  if (origin === "invalid" || (origin && !isLoopbackHostname(origin.hostname))) {
    return deny("non_loopback_origin", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return deny("cross_site_request", 403);
  }

  const expected = process.env.DEMOCRAFT_STUDIO_SESSION_TOKEN;
  if (!expected) return deny("session_not_configured", 503);

  const supplied = request.headers.get("x-democraft-studio-token");
  if (!supplied || !tokensEqual(supplied, expected)) {
    return deny("invalid_session_token", 401);
  }

  return undefined;
}
```

Missing `Sec-Fetch-Site` may be accepted only because non-browser clients and
unit-test `Request` objects may omit it; the valid secret token remains
mandatory. A browser that supplies Fetch Metadata must satisfy it.

## Session bootstrap hardening

`GET /api/session` currently returns the token after checking only that the
request target is loopback. Keep the JSON bootstrap design, but add these
requirements:

- target is loopback;
- reject `Sec-Fetch-Site: cross-site`, `same-site`, or `none`;
- never emit CORS headers;
- preserve `Cache-Control: no-store, private`;
- never place the token in a URL, log, error, event, or persisted storage.

A same-origin Studio page can read the response. A hostile website cannot read
it because of the browser same-origin policy, and Fetch Metadata makes the
bootstrap explicitly reject its cross-site request.

Do not replace the token with a port-scoped cookie without a separate design.
Cookies are scoped by hostname rather than port, so simultaneous Studio
instances can overwrite or share them unexpectedly.

## Error diagnostics

Replace the single ambiguous error string with stable machine-readable codes:

```json
{
  "error": "Studio mutation request was rejected.",
  "code": "cross_site_request"
}
```

Suggested codes:

- `non_loopback_target`
- `non_loopback_origin`
- `cross_site_request`
- `session_not_configured`
- `invalid_session_token`

In development only, log a sanitized diagnostic containing:

- request URL hostname, protocol, and port;
- `Origin` hostname, protocol, and port;
- `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`;
- `Sec-Fetch-Site`;
- Studio runtime mode and build identifier.

Never log the session-token header or environment value. These diagnostics make
future runtime mismatches observable instead of collapsing them into the same
message.

## Implementation scope

Primary files:

- `packages/studio/lib/request-security.ts`
- `packages/studio/lib/request-security.test.ts`
- `packages/studio/app/api/session/route.ts`
- `packages/studio/app/api/session/route.test.ts`
- `packages/studio/lib/studio-api.ts`
- `packages/studio/lib/studio-api.test.ts`
- `packages/studio/lib/studio-session-contract.ts`
- `packages/cli/src/studio-runtime.ts`
- the CLI runtime tests

Audit every state-changing route and ensure it calls the single shared guard.
At minimum this includes authentication-profile changes, recapture, resolve,
render start/cancel, audio, opening folders, and any filesystem-writing route.
Do not duplicate route-specific origin logic.

Also verify the source-checkout runtime cannot run a stale `.next` production
bundle. A source checkout should use the development runtime; an installed npm
package should use its shipped production build. Security source and executed
server code must not silently diverge.

## Required test matrix

### Unit tests for the guard

Accept with a valid token:

- target `127.0.0.1`, origin `127.0.0.1`, `same-origin`;
- target reconstructed as `localhost`, origin `127.0.0.1`, `same-origin`;
- target reconstructed as `127.0.0.1`, origin `localhost`, `same-origin`;
- target/origin using `[::1]` where supported;
- different textual ports between `request.url` and `Origin`, because the
  framework URL must not be an authorization authority;
- missing Fetch Metadata with a valid token for non-browser compatibility.

Reject:

- a non-loopback target;
- a malformed or non-loopback `Origin`;
- `Sec-Fetch-Site: cross-site`;
- `Sec-Fetch-Site: same-site`;
- `Sec-Fetch-Site: none`;
- missing or incorrect token;
- missing server-side token configuration.

### Integration tests

- bootstrap token, then perform a real authenticated mutation;
- confirm no mutation route bypasses the guard;
- confirm an invalid token cannot trigger side effects;
- confirm a cross-site request is rejected before its handler runs;
- run the same suite against development and production Studio runtimes.

### Consumer smoke tests

Use `examples/talento-saas` and test both browser entry URLs:

- `http://127.0.0.1:<port>`;
- `http://localhost:<port>`.

Exercise all mutation categories, not only one endpoint:

1. select an authentication profile;
2. recapture;
3. resolve/reload the timeline;
4. start and cancel a render;
5. invoke audio generation when configured;
6. open an output folder;
7. restart Studio and verify the old token is no longer accepted.

Run the consumer smoke test once from the monorepo source checkout and once from
packed npm tarballs installed into an isolated temporary project. A global
`pnpm build` alone does not prove which Studio package or bundle the consumer is
executing.

## Acceptance criteria

- No legitimate Studio mutation fails because Next reconstructed a different
  loopback alias, port, or protocol.
- A remote target, non-local origin, cross-site browser request, or invalid
  session token remains blocked.
- Every state-changing route uses the same authorization function.
- `examples/talento-saas` passes the full mutation smoke test through both
  `127.0.0.1` and `localhost`.
- Source, production build, packed package, and executed runtime can be traced
  to the same implementation.
- Unit tests, integration tests, typecheck, lint, Studio build, and CLI build
  pass.

## Explicit non-solutions

Do not:

- disable origin checks entirely;
- allow `Origin: *` or broad CORS;
- add one-off exceptions inside individual API routes;
- keep comparing `Origin` with `request.url.origin` using a growing alias list;
- hardcode the Talento port;
- expose the session token to query strings, local storage, or logs;
- treat rebuilding the monorepo as proof that a globally installed CLI changed.

## Recommended implementation order

1. Add failing table-driven tests for the alias/reconstructed-URL matrix.
2. Refactor the shared guard to the stable contract above.
3. Harden `/api/session` with Fetch Metadata.
4. Audit all mutation routes for centralized guard coverage.
5. Add safe diagnostic codes and development logging.
6. Verify source-checkout and packaged runtime selection.
7. Run builds and the full Talento smoke matrix.
8. Commit in logical units: guard contract, bootstrap hardening, route coverage,
   diagnostics, then packaged-runtime verification.

## Working-tree warning

At the time of this handoff, the current branch contains unrelated uncommitted
timeline/playhead work. The implementing agent must preserve it and avoid
mixing it into the mutation-security commits.
