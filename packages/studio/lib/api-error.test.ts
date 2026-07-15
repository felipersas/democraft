import { describe, expect, it } from "vitest";
import { readApiError } from "./api-error";

describe("API error messages", () => {
  it("preserves server validation messages and issues", async () => {
    const response = Response.json(
      {
        error: "Invalid render request",
        issues: [
          {
            path: "$.crf",
            message: "Number must be at most 51",
            code: "too_big",
          },
        ],
      },
      { status: 400 },
    );

    await expect(
      readApiError(response, "Render request failed."),
    ).resolves.toBe(
      "Invalid render request ($.crf: Number must be at most 51)",
    );
  });

  it("uses the fallback for a malformed response", async () => {
    const response = new Response("not json", { status: 500 });

    await expect(
      readApiError(response, "Render request failed."),
    ).resolves.toBe("Render request failed.");
  });
});
