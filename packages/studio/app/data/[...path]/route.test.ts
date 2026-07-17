import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const roots: string[] = [];

afterEach(async () => {
  delete process.env.DEMOCRAFT_STUDIO_DATA;
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("GET /data/[...path]", () => {
  it("serves a contained asset", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "image.png"), "image");

    const response = await request(["image.png"]);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("image");
  });

  it("serves an audio file with the correct content type", async () => {
    const root = await fixture();
    await mkdir(path.join(root, "audio"), { recursive: true });
    await writeFile(path.join(root, "audio", "music.mp3"), "bytes");

    const response = await request(["audio", "music.mp3"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
  });

  it("advertises range support for media (accept-ranges: bytes)", async () => {
    const root = await fixture();
    const body = Buffer.alloc(2048, 0xaa);
    await mkdir(path.join(root, "audio"), { recursive: true });
    await writeFile(path.join(root, "audio", "music.mp3"), body);

    const response = await request(["audio", "music.mp3"]);

    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("2048");
  });

  it("serves a partial byte range (206) for seekable media", async () => {
    const root = await fixture();
    const body = Buffer.alloc(2048, 0xaa);
    await mkdir(path.join(root, "audio"), { recursive: true });
    await writeFile(path.join(root, "audio", "music.mp3"), body);

    const response = await rangeRequest(
      ["audio", "music.mp3"],
      "bytes=0-1023",
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("content-length")).toBe("1024");
    expect(response.headers.get("content-range")).toBe("bytes 0-1023/2048");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  it("serves an open-ended range (bytes=1024-) to the end", async () => {
    const root = await fixture();
    const body = Buffer.alloc(2048, 0xaa);
    await mkdir(path.join(root, "audio"), { recursive: true });
    await writeFile(path.join(root, "audio", "music.mp3"), body);

    const response = await rangeRequest(["audio", "music.mp3"], "bytes=1024-");

    expect(response.status).toBe(206);
    expect(response.headers.get("content-length")).toBe("1024");
    expect(response.headers.get("content-range")).toBe("bytes 1024-2047/2048");
  });

  it("rejects an out-of-range request with 416", async () => {
    const root = await fixture();
    await mkdir(path.join(root, "audio"), { recursive: true });
    await writeFile(path.join(root, "audio", "music.mp3"), Buffer.alloc(100));

    const response = await rangeRequest(
      ["audio", "music.mp3"],
      "bytes=200-300",
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */100");
  });

  it("ignores the Range header for non-media (images)", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "image.png"), "image-bytes");

    const response = await rangeRequest(["image.png"], "bytes=0-2");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("rejects a prefix-sibling traversal", async () => {
    const root = await fixture();
    const sibling = `${root}-private`;
    roots.push(sibling);
    await mkdir(sibling);
    await writeFile(path.join(sibling, "secret.png"), "secret");

    const response = await request([
      "..",
      path.basename(sibling),
      "secret.png",
    ]);

    expect(response.status).toBe(403);
  });

  it("rejects an asset symlink that escapes studio data", async () => {
    const root = await fixture();
    const outside = path.join(
      path.dirname(root),
      `${path.basename(root)}-secret.png`,
    );
    await writeFile(outside, "secret");
    roots.push(outside);
    await symlink(outside, path.join(root, "linked.png"));

    const response = await request(["linked.png"]);

    expect(response.status).toBe(404);
  });

  it("does not reveal whether an escaping symlink target exists", async () => {
    const root = await fixture();
    const outside = path.join(
      path.dirname(root),
      `${path.basename(root)}-gone`,
    );
    await symlink(outside, path.join(root, "dangling.png"));

    const response = await request(["dangling.png"]);

    expect(response.status).toBe(404);
  });
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "democraft-data-route-"));
  roots.push(root);
  process.env.DEMOCRAFT_STUDIO_DATA = await import("node:fs/promises").then(
    ({ realpath }) => realpath(root),
  );
  return root;
}

function request(segments: string[]) {
  return GET(new Request("http://localhost/data") as never, {
    params: Promise.resolve({ path: segments }),
  });
}

function rangeRequest(segments: string[], range: string) {
  return GET(
    new Request("http://localhost/data", {
      headers: { range },
    }) as never,
    { params: Promise.resolve({ path: segments }) },
  );
}
