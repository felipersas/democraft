import { describe, expect, it } from "vitest";
import { readJsonBodyLimited, RequestBodyTooLargeError } from "./request-body";

describe("bounded JSON request bodies", () => {
  it("parses JSON within the byte limit", async () => {
    await expect(
      readJsonBodyLimited(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ ok: true }),
        }),
        32,
      ),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects streamed bodies before buffering past the limit", async () => {
    await expect(
      readJsonBodyLimited(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ value: "too large" }),
        }),
        8,
      ),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
