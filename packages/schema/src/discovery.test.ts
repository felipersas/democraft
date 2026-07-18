import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ArtifactValidationError,
  parseDiscoveryRunMetadata,
  parseDiscoveryRunMetadataJson,
  parseLatestDiscoveryPointer,
  parseLatestDiscoveryPointerJson,
  parsePageDiscovery,
  parsePageDiscoveryJson,
} from "./artifact-schemas";

const fixtures = new URL("../fixtures/v1/", import.meta.url);

describe("discovery schemas v1", () => {
  it("round-trips the page discovery fixture and preserves extensions", async () => {
    const discovery = await parseFixture(
      "discovery.valid.json",
      parsePageDiscoveryJson,
    );
    expect(discovery.schemaVersion).toBe(1);
    expect(discovery.page.url).toBe("http://localhost:3000/dashboard");
    expect(discovery.elements[0]?.locatorCandidates[0]?.locator).toEqual({
      kind: "role",
      role: "link",
      name: "Projects",
    });
    expect(discovery.collections[0]?.count).toBe(48);
    expect(discovery.warnings[0]?.code).toBe("DC406");
    expect(parsePageDiscoveryJson(JSON.stringify(discovery))).toEqual(discovery);
  });

  it("reads the discovery run metadata and latest pointer fixtures", async () => {
    const metadata = await parseFixture(
      "discovery-run-metadata.valid.json",
      parseDiscoveryRunMetadataJson,
    );
    const pointer = await parseFixture(
      "latest-discovery-pointer.valid.json",
      parseLatestDiscoveryPointerJson,
    );
    expect(metadata.status).toBe("completed");
    expect(metadata.paths.applicationMap).toBe("application-map.json");
    expect(metadata.hashes.environmentHash).toMatch(/^discovery-env-v1:sha256:/);
    expect(pointer.discoveryRunId).toBe(metadata.discoveryRunId);
    expect(parseDiscoveryRunMetadataJson(JSON.stringify(metadata))).toEqual(
      metadata,
    );
    expect(parseLatestDiscoveryPointerJson(JSON.stringify(pointer))).toEqual(
      pointer,
    );
  });

  it("preserves nested discovery extensions via passthrough", () => {
    const discovery = parsePageDiscovery({
      schemaVersion: 1,
      generatedAt: "2026-07-17T18:00:00.000Z",
      page: {
        url: "http://localhost:3000/",
        pathname: "/",
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
        extension: { page: true },
      },
      regions: [],
      elements: [
        {
          id: "element_01",
          kind: "button",
          role: "button",
          name: "Save",
          visible: true,
          enabled: true,
          interactive: true,
          locatorCandidates: [
            {
              locator: { kind: "role", role: "button", name: "Save" },
              confidence: 0.99,
              stability: "high",
              unique: true,
              matchCount: 1,
              reasons: ["Unique accessible role and name"],
              risks: [],
              extension: { candidate: true },
            },
          ],
          extension: { element: true },
        },
      ],
      collections: [],
      warnings: [],
      extension: { top: true },
    });
    expect((discovery as Record<string, unknown>).extension).toEqual({
      top: true,
    });
    expect(
      (discovery.elements[0] as unknown as { extension: unknown }).extension,
    ).toEqual({ element: true });
    expect(
      (
        discovery.elements[0]?.locatorCandidates[0] as unknown as {
          extension: unknown;
        }
      ).extension,
    ).toEqual({ candidate: true });
  });

  it("reports path-aware errors for malformed page discovery", () => {
    const valid = parsePageDiscovery({
      schemaVersion: 1,
      generatedAt: "2026-07-17T18:00:00.000Z",
      page: {
        url: "http://localhost:3000/",
        pathname: "/",
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
      },
      regions: [],
      elements: [],
      collections: [],
      warnings: [],
    });
    expect(() =>
      parsePageDiscovery({ ...valid, schemaVersion: 2 }),
    ).toThrow("$.schemaVersion");
    expect(() =>
      parsePageDiscovery({ ...valid, generatedAt: "not-a-date" }),
    ).toThrow("$.generatedAt");
    expect(() =>
      parsePageDiscovery({
        ...valid,
        page: { ...valid.page, viewport: { width: 0, height: 0 } },
      }),
    ).toThrow("$.page.viewport.width");
    // Confidence must stay in [0, 1].
    expect(() =>
      parsePageDiscovery({
        ...valid,
        elements: [
          {
            id: "element_01",
            kind: "button",
            visible: true,
            enabled: true,
            interactive: true,
            locatorCandidates: [
              {
                locator: { kind: "role", role: "button", name: "Save" },
                confidence: 1.5,
                stability: "high",
                unique: true,
                matchCount: 1,
                reasons: [],
              },
            ],
          },
        ],
      }),
    ).toThrow("$.elements[0].locatorCandidates[0].confidence");
  });

  it("rejects malformed discovery JSON with a stable kind", () => {
    expect(() => parsePageDiscoveryJson("{")).toThrow(ArtifactValidationError);
    expect(() => parseDiscoveryRunMetadataJson("null")).toThrow(
      ArtifactValidationError,
    );
  });

  it("enforces terminal discovery metadata invariants", async () => {
    const completed = JSON.parse(
      await readFile(new URL("discovery-run-metadata.valid.json", fixtures), "utf8"),
    );
    // created cannot carry startedAt.
    expect(() =>
      parseDiscoveryRunMetadata({ ...completed, status: "created" }),
    ).toThrow("$.startedAt");
    // running cannot carry finishedAt.
    expect(() =>
      parseDiscoveryRunMetadata({
        ...completed,
        status: "running",
        finishedAt: undefined,
      }),
    ).not.toThrow();
    expect(() =>
      parseDiscoveryRunMetadata({ ...completed, status: "running" }),
    ).toThrow("$.finishedAt");
    // failed requires an error.
    expect(() =>
      parseDiscoveryRunMetadata({
        ...completed,
        status: "failed",
        error: undefined,
      }),
    ).toThrow("$.error");
    // completed cannot carry an error.
    expect(() =>
      parseDiscoveryRunMetadata({
        ...completed,
        status: "cancelled",
        error: { message: "stale" },
      }),
    ).toThrow("$.error");
  });

  it("rejects traversal in the latest discovery pointer directory", () => {
    expect(() =>
      parseLatestDiscoveryPointer({
        schemaVersion: 1,
        applicationId: "app",
        discoveryRunId: "run",
        discoveryDirectory: "../escape",
        completedAt: "2026-07-17T18:00:05.000Z",
      }),
    ).toThrow("$.discoveryDirectory");
    expect(() =>
      parseLatestDiscoveryPointer({
        schemaVersion: 1,
        applicationId: "app",
        discoveryRunId: "run",
        discoveryDirectory: "nested/path",
        completedAt: "2026-07-17T18:00:05.000Z",
      }),
    ).toThrow("$.discoveryDirectory");
  });
});

async function parseFixture<T>(
  name: string,
  parse: (json: string) => T,
): Promise<T> {
  return parse(await readFile(new URL(name, fixtures), "utf8"));
}
