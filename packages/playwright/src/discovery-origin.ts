/**
 * Origin allowlist guard for Discovery.
 *
 * Discovery is read-only by default (plan §3.7, §5.9) and must never silently
 * navigate to an unapproved origin. This module is the single chokepoint that
 * decides whether a URL may be discovered.
 *
 * The small URL helpers (`parseHttpUrl`, `normalizeOrigin`) mirror the ones in
 * `@democraft/authentication/src/urls.ts`. They are duplicated here rather
 * than imported because `@democraft/playwright` deliberately does NOT depend
 * on `@democraft/authentication` (auth is an optional concern layered on top
 * by the CLI). Keeping discovery's origin logic in a leaf module with zero
 * workspace deps makes it trivially unit-testable without a browser.
 */
import { diagnosticCodes, type Diagnostic } from "@democraft/schema";

/** Error thrown when a URL is rejected by the discovery allowlist. */
export class DiscoveryOriginError extends Error {
  readonly code:
    | typeof diagnosticCodes.discoveryOriginBlocked
    | typeof diagnosticCodes.discoveryUnsafeScheme;
  readonly url: string;

  constructor(
    code: DiscoveryOriginError["code"],
    url: string,
    message: string,
  ) {
    super(message);
    this.name = "DiscoveryOriginError";
    this.code = code;
    this.url = url;
  }

  toDiagnostic(): Diagnostic {
    return {
      code: this.code,
      severity: "error",
      message: this.message,
      details: { url: this.url },
    };
  }
}

/**
 * Parse an http(s) URL, rejecting credentials, fragments, and non-web
 * schemes. `javascript:` / `data:` / `file:` are blocked — discovery must
 * never execute page content or touch the local filesystem via a URL.
 */
export function parseDiscoveryHttpUrl(value: string, label = "URL"): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DiscoveryOriginError(
      diagnosticCodes.discoveryUnsafeScheme,
      value,
      `Invalid ${label}.`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DiscoveryOriginError(
      diagnosticCodes.discoveryUnsafeScheme,
      value,
      `${label} must use http or https (got ${url.protocol}).`,
    );
  }
  if (url.username || url.password || url.hash) {
    throw new DiscoveryOriginError(
      diagnosticCodes.discoveryUnsafeScheme,
      value,
      `${label} cannot contain credentials or a fragment.`,
    );
  }
  return url;
}

/** Normalize a URL/origin string to its bare origin (`scheme://host:port`). */
export function normalizeDiscoveryOrigin(value: string): string {
  return parseDiscoveryHttpUrl(value, "origin").origin;
}

/**
 * Assert that `url` is allowed for discovery. The allowlist is the set of
 * origins the caller explicitly approved. When the allowlist is empty, the
 * URL's own origin is permitted (the single-page snapshot MVP — plan §5.8
 * Level 1). Pass additional origins via the CLI `--allow-origin` flag to
 * extend it.
 *
 * @param url     The full URL the browser intends to discover.
 * @param allowlist Explicitly approved origins (already normalized or raw).
 */
export function assertDiscoveryAllowed(
  url: string,
  allowlist: string[] = [],
): void {
  const parsed = parseDiscoveryHttpUrl(url);
  const origin = parsed.origin;
  const allowed = new Set(
    allowlist.length > 0
      ? allowlist.map((entry) => normalizeDiscoveryOrigin(entry))
      : [origin],
  );
  if (!allowed.has(origin)) {
    throw new DiscoveryOriginError(
      diagnosticCodes.discoveryOriginBlocked,
      url,
      `Origin ${origin} is not in the discovery allowlist (${[
        ...allowed,
      ].join(", ")}).`,
    );
  }
}
