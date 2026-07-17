import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { STUDIO_SESSION_TOKEN_HEADER } from "./studio-session-contract";

export const STUDIO_SESSION_TOKEN_ENV = "DEMOCRAFT_STUDIO_SESSION_TOKEN";

/**
 * Machine-readable reason a Studio request was rejected. Stable across
 * runtimes so clients and operators can branch on the code, not on a
 * human-readable string.
 */
export type MutationDenialCode =
  | "non_loopback_target"
  | "non_loopback_origin"
  | "cross_site_request"
  | "session_not_configured"
  | "invalid_session_token";

const DENIAL_ERROR = "Studio mutation request was rejected.";
const SESSION_NOT_CONFIGURED_ERROR =
  "Studio session security is not configured.";
const FETCH_SITE_HEADER = "sec-fetch-site";

/**
 * Authorizes a state-changing Studio request.
 *
 * The capability model: the per-process session token created by the CLI is
 * the *primary* mutation capability. Binding to loopback, requiring a local
 * `Origin`, and enforcing Fetch Metadata are defense-in-depth layers.
 *
 * No layer depends on Next.js reproducing the browser's URL exactly, so
 * `localhost` vs `127.0.0.1`, IPv4 vs `[::1]`, forwarded headers, dev vs prod,
 * or stale bundles cannot break a legitimate mutation. Each invariant is
 * checked independently.
 */
export function authorizeStudioMutation(
  request: Request,
): NextResponse | undefined {
  const requestUrl = parseUrl(request.url);
  if (!requestUrl || !isLoopbackHostname(requestUrl.hostname)) {
    return deny(request, "non_loopback_target", 403);
  }

  // `Origin` describes the page making the browser request. A present but
  // non-loopback origin is a cross-origin browser request; a missing origin is
  // permitted because non-browser clients and unit-test Requests omit it, and
  // the token remains mandatory regardless.
  const origin = parseOptionalOrigin(request.headers.get("origin"));
  if (
    origin === "invalid" ||
    (origin && !isLoopbackHostname(origin.hostname))
  ) {
    return deny(request, "non_loopback_origin", 403);
  }

  const fetchSite = request.headers.get(FETCH_SITE_HEADER);
  if (fetchSite && fetchSite !== "same-origin") {
    return deny(request, "cross_site_request", 403);
  }

  const expectedToken = process.env[STUDIO_SESSION_TOKEN_ENV];
  if (!expectedToken) {
    return denySessionNotConfigured(request);
  }

  const suppliedToken = request.headers.get(STUDIO_SESSION_TOKEN_HEADER);
  if (!suppliedToken || !tokensEqual(suppliedToken, expectedToken)) {
    return deny(request, "invalid_session_token", 401);
  }

  return undefined;
}

/**
 * Authorizes a non-mutating but still local-only Studio request (the session
 * token bootstrap and read endpoints that must never be reachable from a
 * remote or cross-site caller). Rejects non-loopback targets and, when the
 * browser supplies Fetch Metadata, anything that is not same-origin. Never
 * emits CORS headers.
 */
export function authorizeStudioLoopbackRequest(
  request: Request,
): NextResponse | undefined {
  const requestUrl = parseUrl(request.url);
  if (!requestUrl || !isLoopbackHostname(requestUrl.hostname)) {
    return deny(request, "non_loopback_target", 403);
  }

  const fetchSite = request.headers.get(FETCH_SITE_HEADER);
  if (fetchSite && fetchSite !== "same-origin") {
    return deny(request, "cross_site_request", 403);
  }

  return undefined;
}

export const authorizeStudioSessionBootstrap = authorizeStudioLoopbackRequest;

export function studioSessionToken(): string | undefined {
  return process.env[STUDIO_SESSION_TOKEN_ENV];
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

type ParsedOrigin = { hostname: string; protocol: string; port: string };

function parseUrl(value: string | null): URL | undefined {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Parses an optional `Origin` header. Returns `undefined` when absent (allowed),
 * the parsed origin when well-formed, or `"invalid"` when present but
 * unparseable (must be rejected).
 */
function parseOptionalOrigin(
  value: string | null,
): ParsedOrigin | "invalid" | undefined {
  if (!value) return undefined;
  const parsed = parseUrl(value);
  return parsed
    ? {
        hostname: parsed.hostname,
        protocol: parsed.protocol,
        port: parsed.port,
      }
    : "invalid";
}

function tokensEqual(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

function deny(
  request: Request,
  code: MutationDenialCode,
  status: number,
): NextResponse {
  logSecurityDenial(request, code);
  return NextResponse.json({ error: DENIAL_ERROR, code }, { status });
}

function denySessionNotConfigured(request: Request): NextResponse {
  // 503 is operationally distinct (server misconfiguration) from a client
  // authorization failure, so it keeps its own message rather than the generic
  // denial error.
  logSecurityDenial(request, "session_not_configured");
  return NextResponse.json(
    { error: SESSION_NOT_CONFIGURED_ERROR, code: "session_not_configured" },
    { status: 503 },
  );
}

/**
 * Emits a sanitized diagnostic for a denied request, development-only. Makes
 * future runtime mismatches observable instead of collapsing them into a single
 * ambiguous error string. NEVER logs the session-token header or env value.
 */
function logSecurityDenial(request: Request, code: MutationDenialCode): void {
  if (process.env.NODE_ENV !== "development") return;

  const requestUrl = parseUrl(request.url);
  const origin = parseOptionalOrigin(request.headers.get("origin"));
  const originSummary =
    origin && origin !== "invalid"
      ? {
          hostname: origin.hostname,
          protocol: origin.protocol,
          port: origin.port,
        }
      : origin;

  console.warn("[studio-security] request denied", {
    code,
    request: requestUrl
      ? {
          hostname: requestUrl.hostname,
          protocol: requestUrl.protocol,
          port: requestUrl.port,
        }
      : request.url,
    origin: originSummary,
    host: request.headers.get("host"),
    "x-forwarded-host": request.headers.get("x-forwarded-host"),
    "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
    [FETCH_SITE_HEADER]: request.headers.get(FETCH_SITE_HEADER),
  });
}
