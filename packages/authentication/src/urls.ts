import { AuthenticationError } from "./errors";

export function normalizeOrigin(value: string): string {
  const url = parseHttpUrl(value, "origin");
  if (url.username || url.password || url.hash)
    throw invalidUrl("Origin cannot contain credentials or a fragment.");
  return url.origin;
}

export function resolveValidationUrl(origin: string, value?: string): string {
  if (!value) return normalizeOrigin(origin);
  if (value.startsWith("/"))
    return new URL(value, normalizeOrigin(origin)).href;
  return parseHttpUrl(value, "validation URL").href;
}

export function validateSelector(selector: string): string {
  if (!selector.trim() || Buffer.byteLength(selector, "utf8") > 2048)
    throw invalidUrl("Validation selector must contain 1 to 2048 bytes.");
  return selector;
}

function parseHttpUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidUrl(`Invalid ${label}.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw invalidUrl(`${label} must use http or https.`);
  if (url.username || url.password || url.hash)
    throw invalidUrl(`${label} cannot contain credentials or a fragment.`);
  return url;
}

function invalidUrl(message: string): AuthenticationError {
  return new AuthenticationError("AUTH_OPERATION_FAILED", message, {
    stage: "configuration",
  });
}
