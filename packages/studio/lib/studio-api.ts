import {
  STUDIO_SESSION_TOKEN_HEADER,
  type StudioSessionResponse,
} from "./studio-session-contract";
import { readApiError } from "./api-error";

let sessionTokenPromise: Promise<string> | undefined;

/** Fetches the ephemeral token same-origin and keeps it out of URLs and logs. */
export async function studioMutationFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getStudioSessionToken();
  const headers = new Headers(init.headers);
  headers.set(STUDIO_SESSION_TOKEN_HEADER, token);
  return fetch(input, { ...init, headers });
}

/** Converts HTTP mutation failures into caught, user-facing errors. */
export async function studioMutationRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackError: string,
): Promise<Response> {
  const response = await studioMutationFetch(input, init);
  if (!response.ok) {
    throw new Error(await readApiError(response, fallbackError));
  }
  return response;
}

async function getStudioSessionToken(): Promise<string> {
  sessionTokenPromise ??= fetch("/api/session", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Studio session is unavailable.");
      const body = (await response.json()) as StudioSessionResponse;
      if (!body.token) throw new Error("Studio session token is unavailable.");
      return body.token;
    })
    .catch((error) => {
      sessionTokenPromise = undefined;
      throw error;
    });
  return sessionTokenPromise;
}
