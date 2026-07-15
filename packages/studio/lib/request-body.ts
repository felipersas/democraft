export const MAX_STUDIO_JSON_BYTES = 64 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Request body exceeds ${limit} bytes.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readJsonBodyLimited(
  request: Request,
  limit = MAX_STUDIO_JSON_BYTES,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    throw new RequestBodyTooLargeError(limit);
  }
  if (!request.body) return JSON.parse("");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new RequestBodyTooLargeError(limit);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}
