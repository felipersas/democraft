import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";

const tempDirs: string[] = [];

beforeEach(() => {
  vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "test-token");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const validTrack = {
  id: "music",
  src: "music.mp3",
  startAtMs: 0,
  volume: 0.5,
  muted: false,
  loop: true,
  fadeInMs: 0,
  fadeOutMs: 0,
};

describe("POST /api/audio", () => {
  it.each([
    [{ origin: "http://localhost" }, 401],
    [
      {
        origin: "https://attacker.example",
        "x-democraft-studio-token": "test-token",
      },
      403,
    ],
  ])("rejects an unauthorized mutation %#", async (headers, status) => {
    const response = await POST(
      new Request("http://localhost/api/audio", {
        method: "POST",
        headers,
        body: "[]",
      }),
    );
    expect(response.status).toBe(status);
  });

  it("rejects an invalid override set", async () => {
    const response = await POST(
      jsonRequest([
        {
          id: "x",
          src: "x.mp3",
          startAtMs: 0,
          volume: 2,
          muted: false,
          loop: false,
          fadeInMs: 0,
          fadeOutMs: 0,
        },
      ]),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      kind: "audio overrides",
      issues: [
        expect.objectContaining({ path: expect.stringContaining("volume") }),
      ],
    });
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/audio", {
        method: "POST",
        headers: authorizedHeaders({ "content-type": "application/json" }),
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      issues: [{ path: "$", code: "invalid_json" }],
    });
  });

  it("writes a valid override set to audio-overrides.json", async () => {
    const dir = await dataFixture();

    const response = await POST(jsonRequest([validTrack]));

    expect(response.status).toBe(200);
    const written = JSON.parse(
      await readFile(path.join(dir, "audio-overrides.json"), "utf8"),
    );
    expect(written).toEqual([validTrack]);
  });
});

describe("DELETE /api/audio", () => {
  it("removes the override file when present", async () => {
    const dir = await dataFixture();
    const file = path.join(dir, "audio-overrides.json");
    await mkdir(path.dirname(file), { recursive: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "[]");

    const response = await DELETE(
      new Request("http://localhost/api/audio", {
        method: "DELETE",
        headers: authorizedHeaders(),
      }),
    );

    expect(response.status).toBe(200);
    await expect(readFile(file, "utf8")).rejects.toThrow();
  });

  it("succeeds even when no override file exists", async () => {
    await dataFixture();
    const response = await DELETE(
      new Request("http://localhost/api/audio", {
        method: "DELETE",
        headers: authorizedHeaders(),
      }),
    );
    expect(response.status).toBe(200);
  });
});

async function dataFixture(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "democraft-audio-route-"));
  tempDirs.push(dir);
  const { realpath } = await import("node:fs/promises");
  vi.stubEnv("DEMOCRAFT_STUDIO_DATA", await realpath(dir));
  return dir;
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/audio", {
    method: "POST",
    headers: authorizedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

function authorizedHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("origin", "http://localhost");
  headers.set("x-democraft-studio-token", "test-token");
  return headers;
}
