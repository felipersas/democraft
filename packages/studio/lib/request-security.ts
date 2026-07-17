import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { STUDIO_SESSION_TOKEN_HEADER } from "./studio-session-contract";

export const STUDIO_SESSION_TOKEN_ENV = "DEMOCRAFT_STUDIO_SESSION_TOKEN";

/**
 * Authorizes a state-changing Studio request.
 *
 * The Studio is a local tool, so mutations must target a loopback origin, come
 * from an equivalent loopback origin (same protocol and port), and carry the
 * per-process token created by the CLI.
 */
export function authorizeStudioMutation(
  request: Request,
): NextResponse | undefined {
  const requestUrl = parseUrl(request.url);
  if (!requestUrl || !isLoopbackHostname(requestUrl.hostname)) {
    return forbidden("Studio mutations are only available on loopback.");
  }

  const origin = parseUrl(request.headers.get("origin"));
  if (
    !origin ||
    !isLoopbackHostname(origin.hostname) ||
    origin.protocol !== requestUrl.protocol ||
    origin.port !== requestUrl.port
  ) {
    return forbidden("Studio mutation origin is not allowed.");
  }

  const expectedToken = process.env[STUDIO_SESSION_TOKEN_ENV];
  if (!expectedToken) {
    return NextResponse.json(
      { error: "Studio session security is not configured." },
      { status: 503 },
    );
  }

  const suppliedToken = request.headers.get(STUDIO_SESSION_TOKEN_HEADER);
  if (!suppliedToken || !tokensEqual(suppliedToken, expectedToken)) {
    return NextResponse.json(
      { error: "Studio session token is missing or invalid." },
      { status: 401 },
    );
  }

  return undefined;
}

/** Only expose the token bootstrap endpoint when the target itself is local. */
export function authorizeStudioLoopbackRequest(
  request: Request,
): NextResponse | undefined {
  const requestUrl = parseUrl(request.url);
  if (!requestUrl || !isLoopbackHostname(requestUrl.hostname)) {
    return forbidden("Studio sessions are only available on loopback.");
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

function parseUrl(value: string | null): URL | undefined {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function tokensEqual(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

function forbidden(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 403 });
}
