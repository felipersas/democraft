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
