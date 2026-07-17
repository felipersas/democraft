import type { AuthenticationStatus } from "./domain";

export const authenticationErrorCodes = [
  "AUTH_PROFILE_NOT_FOUND",
  "AUTH_NOT_CONFIGURED",
  "AUTH_LOGIN_REQUIRED",
  "AUTH_SESSION_EXPIRED",
  "AUTH_STATE_CORRUPT",
  "AUTH_UNSUPPORTED_VERSION",
  "AUTH_VALIDATION_FAILED",
  "AUTH_PROFILE_BUSY",
  "AUTH_PROFILE_IN_USE",
  "AUTH_UNAVAILABLE_IN_CI",
  "AUTH_OPERATION_FAILED",
] as const;
export type AuthenticationErrorCode = (typeof authenticationErrorCodes)[number];
export type AuthenticationActionRequired =
  | "none"
  | "interactive-login"
  | "choose-profile"
  | "repair-state"
  | "retry"
  | "confirm-force-remove"
  | "provide-state";

const actions: Record<AuthenticationErrorCode, AuthenticationActionRequired> = {
  AUTH_PROFILE_NOT_FOUND: "choose-profile",
  AUTH_NOT_CONFIGURED: "choose-profile",
  AUTH_LOGIN_REQUIRED: "interactive-login",
  AUTH_SESSION_EXPIRED: "interactive-login",
  AUTH_STATE_CORRUPT: "repair-state",
  AUTH_UNSUPPORTED_VERSION: "repair-state",
  AUTH_VALIDATION_FAILED: "none",
  AUTH_PROFILE_BUSY: "retry",
  AUTH_PROFILE_IN_USE: "confirm-force-remove",
  AUTH_UNAVAILABLE_IN_CI: "provide-state",
  AUTH_OPERATION_FAILED: "retry",
};

export type PublicAuthenticationError = {
  code: AuthenticationErrorCode;
  profileId?: string;
  status?: AuthenticationStatus;
  actionRequired: AuthenticationActionRequired;
  message: string;
  stage: string;
  sanitizedUrl?: string;
  criterion?: string;
  usage?: { demoId: string }[];
};

export class AuthenticationError extends Error {
  readonly public: PublicAuthenticationError;
  constructor(
    code: AuthenticationErrorCode,
    message: string,
    fields: Omit<
      PublicAuthenticationError,
      "code" | "message" | "actionRequired"
    >,
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.public = {
      code,
      message: redact(message),
      actionRequired: actions[code],
      ...fields,
    };
  }
}

export function redact(value: string): string {
  let source = value;
  try {
    source = JSON.stringify(redactStructured(JSON.parse(value)));
  } catch {
    /* free-form text */
  }
  source = redactEmbeddedJson(source);
  return source
    .replace(
      /("(?:cookie|authorization|password|secret|token|accessToken|refreshToken|localStorage|sessionStorage)"\s*:\s*)"(?:\\.|[^"])*"/gi,
      '$1"[redacted]"',
    )
    .replace(/([?&][^=\s]+)=([^&#\s]+)/g, "$1=[redacted]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[redacted-jwt]",
    )
    .replace(/\b(authorization|cookie)\s*:\s*[^\r\n]+/gi, "$1: [redacted]")
    .replace(
      /\b(cookie|authorization|password|secret|token|localStorage|sessionStorage)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(
      /(?:[A-Za-z]:)?[/\\][^\s]*\.democraft[/\\]auth[/\\][^\s]*/gi,
      "[auth-state-path]",
    );
}

function redactEmbeddedJson(value: string): string {
  const sensitiveKey =
    /^(?:cookies?|origins?|localStorage|sessionStorage|authorization|password|secret|token|accessToken|refreshToken)$/i;
  let result = "";
  let cursor = 0;
  const keyPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*/g;
  for (;;) {
    keyPattern.lastIndex = cursor;
    const match = keyPattern.exec(value);
    if (!match) return result + value.slice(cursor);
    const valueStart = keyPattern.lastIndex;
    if (!sensitiveKey.test(match[1])) {
      result += value.slice(cursor, valueStart);
      cursor = valueStart;
      continue;
    }
    const valueEnd = jsonValueEnd(value, valueStart);
    result += value.slice(cursor, valueStart) + '"[redacted]"';
    cursor = valueEnd;
  }
}

function jsonValueEnd(value: string, start: number): number {
  const opening = value[start];
  if (opening === '"') {
    for (let index = start + 1; index < value.length; index += 1) {
      if (value[index] === "\\") index += 1;
      else if (value[index] === '"') return index + 1;
    }
    return value.length;
  }
  if (opening === "[" || opening === "{") {
    const stack = [opening];
    let quoted = false;
    for (let index = start + 1; index < value.length; index += 1) {
      const character = value[index];
      if (quoted && character === "\\") {
        index += 1;
        continue;
      }
      if (character === '"') {
        quoted = !quoted;
        continue;
      }
      if (quoted) continue;
      if (character === "[" || character === "{") stack.push(character);
      else if (character === "]" || character === "}") {
        stack.pop();
        if (stack.length === 0) return index + 1;
      }
    }
    return value.length;
  }
  const end = value.slice(start).search(/[,}\]\s]/);
  return end < 0 ? value.length : start + end;
}

function redactStructured(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStructured);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] =
      /cookie|origin|localStorage|sessionStorage|authorization|password|secret|token/i.test(
        key,
      )
        ? "[redacted]"
        : redactStructured(child);
  }
  return result;
}

export function sanitizeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}
