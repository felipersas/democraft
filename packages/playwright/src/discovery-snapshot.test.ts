import { describe, expect, it } from "vitest";
import { collectPageDiscovery, type DiscoveryPage } from "./discovery-snapshot";

/**
 * A minimal fake DOM fixture matching the shape the in-page evaluate function
 * returns. `collectPageDiscovery` consumes this via `page.evaluate`, so we stub
 * evaluate to return the canned inventory — no browser required.
 */
type RawNode = {
  role: string;
  name: string;
  tag: string;
  testId: string | null;
  label: string | null;
  text: string;
  visible: boolean;
  enabled: boolean;
  checked: boolean | null;
  selected: boolean | null;
  expanded: boolean | null;
  region: string | null;
  box: { x: number; y: number; width: number; height: number } | null;
  // Optional in test fixtures (production always sets them). Omitting means
  // "not inside a closed overlay" — the common case.
  insideClosedOverlay?: boolean;
  closedOverlayTrigger?: string | null;
};

type RawInventory = {
  url: string;
  pathname: string;
  title: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  nodes: RawNode[];
  regions: { role: string; name: string }[];
};

function fakePage(inventory: RawInventory): DiscoveryPage {
  return {
    url: () => inventory.url,
    title: async () => inventory.title,
    async evaluate<T>(fn: () => T | Promise<T>): Promise<T> {
      // The real in-page function reads the live DOM; here we short-circuit
      // by returning the canned inventory directly.
      void fn;
      return inventory as unknown as T;
    },
  };
}

describe("collectPageDiscovery", () => {
  it("produces a well-formed discovery with regions, elements, and candidates", async () => {
    const page = fakePage({
      url: "http://localhost:3000/dashboard",
      pathname: "/dashboard",
      title: "Dashboard",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
      regions: [
        { role: "banner", name: "" },
        { role: "navigation", name: "Main navigation" },
        { role: "main", name: "Projects" },
      ],
      nodes: [
        {
          role: "link",
          name: "Projects",
          tag: "a",
          testId: null,
          label: null,
          text: "Projects",
          visible: true,
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: "Main navigation",
          box: { x: 24, y: 16, width: 80, height: 32 },
        },
        {
          role: "button",
          name: "New project",
          tag: "button",
          testId: "new-project",
          label: null,
          text: "New project",
          visible: true,
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: "Projects",
          box: { x: 1120, y: 120, width: 160, height: 40 },
        },
        {
          role: "textbox",
          name: "Search projects",
          tag: "input",
          testId: "search-projects",
          label: "Search projects",
          text: "",
          visible: true,
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: "Projects",
          box: { x: 24, y: 120, width: 320, height: 40 },
        },
      ],
    });

    const discovery = await collectPageDiscovery(page);

    expect(discovery.schemaVersion).toBe(1);
    expect(discovery.page).toMatchObject({
      url: "http://localhost:3000/dashboard",
      pathname: "/dashboard",
      title: "Dashboard",
    });
    expect(discovery.regions.map((r) => r.kind)).toEqual([
      "banner",
      "navigation",
      "main",
    ]);
    expect(discovery.elements).toHaveLength(3);

    const button = discovery.elements.find((e) => e.kind === "button")!;
    expect(button.locatorCandidates[0]).toMatchObject({
      locator: { kind: "role", role: "button", name: "New project" },
      stability: "high",
      unique: true,
    });
    expect(button.suggestedTargetId).toBe("newProject");
    expect(button.risk).toBe("reversible");

    const link = discovery.elements.find((e) => e.kind === "link")!;
    expect(link.risk).toBe("read-only");

    // Textbox exposes both role+name and label and testId candidates, ordered.
    const textbox = discovery.elements.find((e) => e.kind === "textbox")!;
    expect(textbox.locatorCandidates.map((c) => c.locator.kind)).toEqual([
      "role",
      "label",
      "testId",
    ]);
  });

  it("drops invisible and tiny decorative nodes", async () => {
    const page = fakePage({
      url: "http://localhost:3000/",
      pathname: "/",
      title: "",
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      regions: [],
      nodes: [
        {
          role: "button",
          name: "Hidden",
          tag: "button",
          testId: null,
          label: null,
          text: "Hidden",
          visible: false,
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: null,
          box: null,
        },
        {
          role: "button",
          name: "Visible",
          tag: "button",
          testId: null,
          label: null,
          text: "Visible",
          visible: true,
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: null,
          box: { x: 0, y: 0, width: 100, height: 40 },
        },
      ],
    });
    const discovery = await collectPageDiscovery(page);
    expect(discovery.elements.map((e) => e.name)).toEqual(["Visible"]);
  });

  it("aggregates long homogeneous lists into a collection with samples", async () => {
    const cards: RawNode[] = Array.from({ length: 48 }, (_, index) => ({
      role: "article",
      name: `Project ${index + 1}`,
      tag: "article",
      testId: null,
      label: null,
      text: `Project ${index + 1}`,
      visible: true,
      enabled: true,
      checked: null,
      selected: null,
      expanded: null,
      region: null,
      box: { x: 0, y: index * 10, width: 200, height: 100 },
    }));
    const page = fakePage({
      url: "http://localhost:3000/projects",
      pathname: "/projects",
      title: "Projects",
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
      regions: [],
      nodes: cards,
    });
    const discovery = await collectPageDiscovery(page);
    expect(discovery.collections).toHaveLength(1);
    expect(discovery.collections[0]).toMatchObject({
      kind: "repeated-collection",
      count: 48,
      itemRole: "article",
    });
    expect(discovery.collections[0]!.sampleElementIds).toHaveLength(3);
  });

  it("warns when no interactive elements are discovered", async () => {
    const page = fakePage({
      url: "http://localhost:3000/empty",
      pathname: "/empty",
      title: "Empty",
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      regions: [],
      nodes: [],
    });
    const discovery = await collectPageDiscovery(page);
    expect(discovery.warnings.find((w) => w.code === "DC407")).toBeDefined();
  });

  it("warns when the top locator for an element is ambiguous", async () => {
    // Two buttons sharing the same accessible name -> matchCount 2 -> ambiguous.
    const shared = {
      role: "button",
      name: "Delete",
      tag: "button",
      testId: null,
      label: null,
      text: "Delete",
      visible: true,
      enabled: true,
      checked: null,
      selected: null,
      expanded: null,
      region: null,
      box: { x: 0, y: 0, width: 60, height: 30 },
    } satisfies RawNode;
    const page = fakePage({
      url: "http://localhost:3000/",
      pathname: "/",
      title: "",
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      regions: [],
      nodes: [
        shared,
        { ...shared, box: { x: 0, y: 40, width: 60, height: 30 } },
      ],
    });
    const discovery = await collectPageDiscovery(page, { collectionThreshold: 99 });
    expect(
      discovery.elements.find((e) => e.name === "Delete")?.locatorCandidates[0]
        ?.unique,
    ).toBe(false);
    expect(discovery.warnings.find((w) => w.code === "DC406")).toBeDefined();
  });

  it("surfaces elements inside a closed overlay and emits DC408", async () => {
    // Simulates a closed <dialog>: the trigger button is visible, but the
    // dialog's input + submit are invisible (display:none via UA). Discovery
    // must retain them marked, and warn the agent to open the overlay first.
    const page = fakePage({
      url: "http://localhost:3000/",
      pathname: "/",
      title: "App",
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      regions: [{ role: "main", name: "" }],
      nodes: [
        {
          role: "button",
          name: "New project",
          tag: "button",
          testId: "new-project",
          label: null,
          text: "New project",
          visible: true,
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: "main",
          box: { x: 100, y: 50, width: 120, height: 40 },
        },
        {
          role: "textbox",
          name: "Project name",
          tag: "input",
          testId: "project-name-input",
          label: "Project name",
          text: "",
          visible: false, // inside closed dialog
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: null,
          box: null,
          insideClosedOverlay: true,
          closedOverlayTrigger: "Create project",
        },
        {
          role: "button",
          name: "Create",
          tag: "button",
          testId: "create-project-button",
          label: null,
          text: "Create",
          visible: false, // inside closed dialog
          enabled: true,
          checked: null,
          selected: null,
          expanded: null,
          region: null,
          box: null,
          insideClosedOverlay: true,
          closedOverlayTrigger: "Create project",
        },
      ],
    });
    const discovery = await collectPageDiscovery(page);

    // The closed-overlay elements are retained (not dropped) and marked.
    const input = discovery.elements.find((e) => e.name === "Project name");
    const createBtn = discovery.elements.find((e) => e.name === "Create");
    expect(input).toBeDefined();
    expect(input?.visible).toBe(false);
    expect(input?.insideClosedOverlay).toBe(true);
    expect(input?.suggestedTargetId).toBe("projectName");
    expect(createBtn?.insideClosedOverlay).toBe(true);

    // The visible trigger is unaffected.
    const trigger = discovery.elements.find((e) => e.name === "New project");
    expect(trigger?.insideClosedOverlay).toBeUndefined();
    expect(trigger?.visible).toBe(true);

    // Exactly one DC408 warning naming the count + trigger.
    const overlayWarning = discovery.warnings.find(
      (w) => w.code === "DC408",
    );
    expect(overlayWarning).toBeDefined();
    expect(overlayWarning?.message).toContain("2 element(s)");
    expect(overlayWarning?.message).toContain("Create project");
    expect(overlayWarning?.message).toContain("re-run discover");
  });
});
