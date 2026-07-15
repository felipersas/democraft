import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { subscribe } from "./event-bus";
import { handleDemoSourceChange } from "./file-watcher";

describe("handleDemoSourceChange", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it("publishes reload failures instead of swallowing them", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "democraft-watcher-"));
    const events: Array<{ event: string; data: unknown }> = [];
    cleanups.push(
      subscribe((event, data) => {
        events.push({ event, data });
      }),
    );

    await handleDemoSourceChange(dataDir);

    expect(events).toContainEqual({
      event: "staleness",
      data: {
        kind: "failed",
        detail:
          "Live reload failed: Studio metadata disappeared during reload.",
      },
    });
  });
});
