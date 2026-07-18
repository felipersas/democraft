/**
 * Page snapshot collector for Discovery.
 *
 * Reads a compact, accessibility-oriented inventory of the live page in a
 * single `page.evaluate()` round-trip, then turns it into a structured
 * `PageDiscovery` via the pure scoring functions in `./discovery-scoring.ts`.
 *
 * Design choices:
 * - Single evaluate() instead of `ariaSnapshot()` YAML: avoids a YAML
 *   dependency, returns exactly the typed fields we score on, and runs once
 *   per page (not once per element). `ariaSnapshot` exists in Playwright 1.61
 *   but yields a YAML string we'd have to parse and re-type.
 * - Each locator candidate produced here is built from the SAME `Locator`
 *   vocabulary that `createLocator` (`./locator.ts:81`) resolves at capture
 *   time, so a high-confidence discovery candidate is guaranteed to resolve
 *   when authored into `demo.ts`.
 * - Read-only. Nothing is clicked, filled, or navigated. See plan §5.9.
 *
 * The `RawNode` shape is the contract between the in-page function and the
 * Node-side scorer. Keep both halves in sync.
 */
import {
  diagnosticCodes,
  type BoundingBox,
  type DiscoveredCollection,
  type DiscoveredElement,
  type DiscoveredElementKind,
  type DiscoveredRegion,
  type DiscoveryWarning,
  type InteractionRisk,
  type PageDiscovery,
} from "@democraft/schema";
import {
  isInteractiveKind,
  scoreLocatorCandidates,
  shouldRetainElement,
  suggestTargetId,
} from "./discovery-scoring";

/** Structural subset of a Playwright page the collector needs. */
export type DiscoveryPage = {
  url(): string;
  title(): Promise<string>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  viewport?(): { width: number; height: number } | null;
  /** Optional full-page screenshot (used to persist a visual reference). */
  screenshot?(options?: { fullPage?: boolean }): Promise<Buffer>;
};

/** Element as observed in-page, before scoring (the evaluate round-trip shape). */
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
  box: BoundingBox | null;
  /** True when the element sits inside a closed overlay (dialog/[hidden]/details). */
  insideClosedOverlay: boolean;
  /** Locator of the trigger that opens the closed overlay, when discoverable. */
  closedOverlayTrigger: string | null;
};

type RawPage = {
  url: string;
  pathname: string;
  title: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  nodes: RawNode[];
  regions: { role: string; name: string }[];
};

export type CollectOptions = {
  /** Largest list that stays enumerated; longer lists become collections. */
  collectionThreshold?: number;
  /** How many sample ids to keep per aggregated collection. */
  collectionSampleSize?: number;
};

/** Role -> coarse kind taxonomy (see DiscoveredElementKind in @democraft/schema). */
function classifyKind(role: string, tag: string): DiscoveredElementKind {
  switch (role) {
    case "button":
      return "button";
    case "link":
      return "link";
    case "textbox":
      return tag === "textarea" ? "textarea" : "textbox";
    case "checkbox":
      return "checkbox";
    case "radio":
      return "radio";
    case "combobox":
    case "listbox":
      return "combobox";
    case "menuitem":
    case "menuitemcheckbox":
    case "menuitemradio":
      return "menuitem";
    case "tab":
      return "tab";
    case "dialog":
    case "alertdialog":
      return "dialog";
    case "heading":
      return "heading";
    case "article":
      return "card";
    case "listitem":
      return "listitem";
    default:
      return "other";
  }
}

const LANDMARK_ROLES: ReadonlySet<string> = new Set([
  "navigation",
  "main",
  "complementary",
  "banner",
  "contentinfo",
  "region",
  "search",
  "form",
]);

/** Risk classification by role (plan §5.9). `unknown` is NEVER safe. */
function classifyRisk(kind: DiscoveredElementKind): InteractionRisk {
  switch (kind) {
    case "link":
      return "read-only";
    case "button":
    case "menuitem":
    case "tab":
      return "reversible";
    case "textbox":
    case "textarea":
    case "checkbox":
    case "radio":
    case "combobox":
      return "state-changing";
    default:
      return "unknown";
  }
}

const ROLES_TO_INVENTORY = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "dialog",
  "alertdialog",
  "heading",
  "article",
  "listitem",
]);

/**
 * Collect a `PageDiscovery` from a settled page. Pure transformation over the
 * in-page inventory; deterministic given the same `RawPage`. Throws never for
 * content reasons — a page with no interactive elements yields a valid (if
 * warning-bearing) discovery.
 */
export async function collectPageDiscovery(
  page: DiscoveryPage,
  options: CollectOptions = {},
): Promise<PageDiscovery> {
  const collectionThreshold = options.collectionThreshold ?? 12;
  const collectionSampleSize = options.collectionSampleSize ?? 3;
  const raw = await readRawPage(page);

  // Build region list with stable ids. The in-page function already emits
  // canonical landmark kinds (banner/contentinfo/...), so no mapping here.
  const regionById = new Map<string, DiscoveredRegion>();
  for (const rawRegion of raw.regions) {
    if (!LANDMARK_ROLES.has(rawRegion.role)) continue;
    const kind = rawRegion.role as DiscoveredRegion["kind"];
    const id = regionIdFor(kind, rawRegion.name, regionById);
    regionById.set(id, {
      id,
      kind,
      label: rawRegion.name || undefined,
    });
  }
  // Index regions by their label/role so nodes can be attached.
  const regionIndex = indexRegions(raw.regions, regionById);

  // Count matches per (role+name), label, testId, text so scoring is accurate.
  const roleKey = (role: string, name: string) => `${role}\u0000${name}`;
  const roleCount = new Map<string, number>();
  const labelCount = new Map<string, number>();
  const testIdCount = new Map<string, number>();
  const textCount = new Map<string, number>();
  for (const node of raw.nodes) {
    roleCount.set(roleKey(node.role, node.name), (roleCount.get(roleKey(node.role, node.name)) ?? 0) + 1);
    if (node.label) labelCount.set(node.label, (labelCount.get(node.label) ?? 0) + 1);
    if (node.testId) testIdCount.set(node.testId, (testIdCount.get(node.testId) ?? 0) + 1);
    if (node.text) textCount.set(node.text, (textCount.get(node.text) ?? 0) + 1);
  }

  const warnings: DiscoveryWarning[] = [];
  const elements: DiscoveredElement[] = [];

  let index = 0;
  for (const node of raw.nodes) {
    if (!ROLES_TO_INVENTORY.has(node.role)) continue;
    const kind = classifyKind(node.role, node.tag);
    const fallbackId = `element_${String(++index).padStart(2, "0")}`;
    const regionId = node.region ? regionIndex.get(node.region) : undefined;

    const candidates = scoreLocatorCandidates({
      role: node.role,
      name: node.name || undefined,
      text: node.text || undefined,
      testId: node.testId ?? undefined,
      label: node.label ?? undefined,
      visible: node.visible,
      enabled: node.enabled,
      roleMatchCount: roleCount.get(roleKey(node.role, node.name)) ?? 1,
      labelMatchCount: node.label ? labelCount.get(node.label) ?? 1 : 0,
      testIdMatchCount: node.testId ? testIdCount.get(node.testId) ?? 1 : 0,
      textMatchCount: node.text ? textCount.get(node.text) ?? 1 : 0,
    });

    const interactive = isInteractiveKind(kind);
    const provisional: Pick<DiscoveredElement, "visible" | "interactive" | "boundingBox"> = {
      visible: node.visible,
      interactive,
      boundingBox: node.box ?? undefined,
    };
    // Retain closed-overlay elements even though they're invisible: they are
    // real interactive surface once the overlay opens, and an agent needs to
    // author them ahead of capture. They surface with visible:false +
    // insideClosedOverlay:true, plus a DC408 warning (emitted below).
    if (!node.insideClosedOverlay && !shouldRetainElement(provisional)) continue;

    const element: DiscoveredElement = {
      id: fallbackId,
      kind,
      role: node.role,
      name: node.name || undefined,
      text: node.text || undefined,
      visible: node.visible,
      enabled: node.enabled,
      checked: node.checked ?? undefined,
      selected: node.selected ?? undefined,
      expanded: node.expanded ?? undefined,
      interactive,
      regionId,
      boundingBox: node.box ?? undefined,
      insideClosedOverlay: node.insideClosedOverlay || undefined,
      locatorCandidates: candidates,
      suggestedTargetId: candidates[0]?.unique
        ? suggestTargetId(kind, node.role, node.name || undefined, fallbackId)
        : undefined,
      risk: interactive ? classifyRisk(kind) : undefined,
    };
    elements.push(element);

    if (candidates.length > 0 && !candidates[0]!.unique) {
      warnings.push({
        code: diagnosticCodes.discoveryAmbiguousTarget,
        severity: "warning",
        message: `Top locator for "${node.name || node.role}" matched ${candidates[0]!.matchCount} elements.`,
        elementId: element.id,
      });
    }
  }

  // Closed-overlay summary: one DC408 warning naming the count + a trigger, so
  // the agent knows to open the overlay (click the trigger) and re-run discover
  // before capture. The individual elements are already marked above.
  const closedOverlayElements = elements.filter((e) => e.insideClosedOverlay);
  if (closedOverlayElements.length > 0) {
    const triggers = new Set<string>();
    for (const node of raw.nodes) {
      if (node.insideClosedOverlay && node.closedOverlayTrigger) {
        triggers.add(node.closedOverlayTrigger);
      }
    }
    const triggerList = [...triggers].slice(0, 3).join(", ");
    warnings.push({
      code: diagnosticCodes.discoveryClosedOverlay,
      severity: "warning",
      message:
        `${closedOverlayElements.length} element(s) are inside closed overlay(s)` +
        (triggerList ? ` (${triggerList})` : "") +
        ". Open the overlay and re-run discover before capture.",
    });
  }

  const collections = aggregateCollections(
    elements,
    collectionThreshold,
    collectionSampleSize,
  );

  if (elements.length === 0) {
    warnings.push({
      code: diagnosticCodes.discoveryNoInteractiveElements,
      severity: "warning",
      message: "No interactive elements were discovered on this page.",
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    page: {
      url: raw.url,
      pathname: raw.pathname,
      title: raw.title || undefined,
      viewport: raw.viewport,
    },
    regions: [...regionById.values()],
    elements,
    collections,
    warnings,
  };
}

/** Aggregate long homogeneous lists into a `DiscoveredCollection` (plan §5.7). */
function aggregateCollections(
  elements: DiscoveredElement[],
  threshold: number,
  sampleSize: number,
): DiscoveredCollection[] {
  const byRole = new Map<string, DiscoveredElement[]>();
  for (const element of elements) {
    if (!element.role) continue;
    const bucket = byRole.get(element.role) ?? [];
    bucket.push(element);
    byRole.set(element.role, bucket);
  }
  const collections: DiscoveredCollection[] = [];
  for (const [role, bucket] of byRole) {
    if (bucket.length < threshold) continue;
    const id = `${role}-list`;
    collections.push({
      id,
      kind: "repeated-collection",
      count: bucket.length,
      itemRole: role,
      sampleElementIds: bucket.slice(0, sampleSize).map((e) => e.id),
    });
  }
  return collections;
}

function regionIdFor(
  kind: DiscoveredRegion["kind"],
  label: string,
  taken: Map<string, unknown>,
): string {
  const base = label
    ? label
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : kind;
  let id = base || kind;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function indexRegions(
  _rawRegions: { role: string; name: string }[],
  regionById: Map<string, DiscoveredRegion>,
): Map<string, string> {
  // Map a node's `region` string (label or canonical kind) back to a region id.
  const index = new Map<string, string>();
  for (const region of regionById.values()) {
    if (region.label) index.set(region.label, region.id);
    index.set(region.kind, region.id);
  }
  return index;
}

/**
 * Read the compact page inventory. The in-page function is serialized by
 * Playwright and run in the browser, so it must NOT close over outer scope.
 * It returns only plain JSON-serializable data — never cookies, tokens, or
 * storage state (plan §19).
 */
async function readRawPage(page: DiscoveryPage): Promise<RawPage> {
  const data = await page.evaluate<RawPage>(() => {
    const VISIBLE_ROLES = new Set([
      "button",
      "link",
      "textbox",
      "checkbox",
      "radio",
      "combobox",
      "listbox",
      "menuitem",
      "menuitemcheckbox",
      "menuitemradio",
      "tab",
      "dialog",
      "alertdialog",
      "heading",
      "article",
      "listitem",
    ]);

    const roleFor = (el: Element): string => {
      const explicit = el.getAttribute("role");
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      const map: Record<string, string> = {
        a: "link",
        button: "button",
        input: inputRole(el),
        select: "combobox",
        textarea: "textbox",
        h1: "heading",
        h2: "heading",
        h3: "heading",
        h4: "heading",
        h5: "heading",
        h6: "heading",
        article: "article",
        li: "listitem",
        dialog: "dialog",
        summary: "button",
      };
      return map[tag] ?? "";
    };

    function inputRole(el: Element): string {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      const tag = el.tagName.toLowerCase();
      if (tag === "select") return "combobox";
      return "textbox";
    }

    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute("aria-label");
      if (aria) return aria.trim();
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const target = document.getElementById(labelledBy);
        if (target) return (target.textContent || "").trim();
      }
      const title = el.getAttribute("title");
      if (title) return title.trim();
      // Associated <label for=...>
      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) return (label.textContent || "").trim();
      }
      // <label> wrapping the control
      const parent = el.closest("label");
      if (parent) return (parent.textContent || "").trim();
      return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160);
    };

    const boxOf = (rect: DOMRect): {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null => {
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const isVisible = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.hidden) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return true;
    };

    const isEnabledElement = (el: Element): boolean => {
      if (el.getAttribute("aria-disabled") === "true") return false;
      if (
        el instanceof HTMLButtonElement ||
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        return !el.disabled;
      }
      return true;
    };

    /**
     * Detect whether an element is inside a closed overlay: a `<dialog>` that
     * is NOT open, a `[hidden]` ancestor, or a `<details>` without `[open]`.
     * Such elements are invisible to `isVisible` but still part of the page's
     * interactive surface once the overlay opens — so Discovery surfaces them
     * (marked) instead of dropping them, and emits a `DC408` warning so the
     * agent knows to open the overlay before capturing.
     *
     * Returns the closed overlay's trigger description when one can be found
     * (an element referencing the dialog via `popovertarget`/`data-*` or a
     * nearby button), else null — the boolean presence is what matters most.
     */
    const closedOverlayInfo = (
      el: Element,
    ): { inside: boolean; trigger: string | null } => {
      let node = el.parentElement;
      while (node) {
        const tag = node.tagName.toLowerCase();
        const isClosedDialog =
          tag === "dialog" && !node.hasAttribute("open");
        const isClosedDetails =
          tag === "details" && !node.hasAttribute("open");
        const isHidden =
          node.hasAttribute("hidden") ||
          node.getAttribute("aria-hidden") === "true";
        if (isClosedDialog || isClosedDetails || isHidden) {
          return { inside: true, trigger: describeOverlayTrigger(node) };
        }
        node = node.parentElement;
      }
      return { inside: false, trigger: null };
    };

    function describeOverlayTrigger(overlay: Element): string | null {
      // Honor an explicit popover target, then a labelled dialog, then role.
      const id = overlay.id;
      if (id) {
        const targeted = document.querySelector(`[popovertarget="${CSS.escape(id)}"], [data-target="${CSS.escape(id)}"]`);
        if (targeted) {
          const name =
            (targeted.getAttribute("aria-label") || "").trim() ||
            (targeted.textContent || "").trim();
          if (name) return name;
        }
      }
      const label = (overlay.getAttribute("aria-label") || "").trim();
      if (label) return label;
      return overlay.tagName.toLowerCase();
    }

    const nearestRegion = (el: Element): string | null => {
      let node: Element | null = el.parentElement;
      while (node) {
        const role = node.getAttribute("role");
        const tag = node.tagName.toLowerCase();
        const landmark =
          (role &&
            [
              "navigation",
              "main",
              "complementary",
              "banner",
              "contentinfo",
              "region",
              "search",
              "form",
            ].includes(role) &&
            role) ||
          (tag === "nav" && "navigation") ||
          (tag === "main" && "main") ||
          (tag === "header" && "banner") ||
          (tag === "footer" && "contentinfo") ||
          (tag === "aside" && "complementary") ||
          (tag === "section" && "region") ||
          (tag === "form" && "form") ||
          null;
        if (landmark) {
          return (
            (node.getAttribute("aria-label") || "").trim() || landmark
          );
        }
        node = node.parentElement;
      }
      return null;
    };

    const nodes = [];
    const all = document.querySelectorAll(
      "a, button, input, select, textarea, h1, h2, h3, h4, h5, h6, article, li, [role], summary, dialog",
    );
    for (const el of Array.from(all)) {
      const role = roleFor(el);
      if (!role || !VISIBLE_ROLES.has(role)) continue;
      const rect = el.getBoundingClientRect();
      const visible = isVisible(el);
      const overlay = closedOverlayInfo(el);
      nodes.push({
        role,
        name: accessibleName(el),
        tag: el.tagName.toLowerCase(),
        testId:
          el.getAttribute("data-testid") ||
          el.getAttribute("data-test-id") ||
          null,
        label: labelFor(el),
        text: (el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160),
        visible,
        enabled: isEnabledElement(el),
        checked:
          el instanceof HTMLInputElement
            ? el.checked
            : el.getAttribute("aria-checked") === "true"
              ? true
              : el.getAttribute("aria-checked") === "false"
                ? false
                : null,
        selected: el.getAttribute("aria-selected") === "true" ? true : null,
        expanded:
          el.getAttribute("aria-expanded") === "true"
            ? true
            : el.getAttribute("aria-expanded") === "false"
              ? false
              : null,
        region: nearestRegion(el),
        box: visible ? boxOf(rect) : null,
        insideClosedOverlay: overlay.inside,
        closedOverlayTrigger: overlay.trigger,
      });
    }

    function labelFor(el: Element): string | null {
      const aria = el.getAttribute("aria-label");
      if (aria) return aria.trim();
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const t = document.getElementById(labelledBy);
        if (t) return (t.textContent || "").trim();
      }
      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) return (label.textContent || "").trim();
      }
      const parent = el.closest("label");
      if (parent) return (parent.textContent || "").trim();
      return null;
    }

    const regions = [];
    const landmarkEls = document.querySelectorAll(
      "main, nav, aside, header, footer, section, form, [role='navigation'], [role='main'], [role='complementary'], [role='banner'], [role='contentinfo'], [role='region'], [role='search'], [role='form']",
    );
    for (const el of Array.from(landmarkEls)) {
      const role =
        el.getAttribute("role") ||
        (el.tagName.toLowerCase() === "nav"
          ? "navigation"
          : el.tagName.toLowerCase() === "main"
            ? "main"
            : el.tagName.toLowerCase() === "aside"
              ? "complementary"
              : el.tagName.toLowerCase() === "header"
                ? "banner"
                : el.tagName.toLowerCase() === "footer"
                  ? "contentinfo"
                  : el.tagName.toLowerCase() === "section"
                    ? "region"
                    : el.tagName.toLowerCase() === "form"
                      ? "form"
                      : "region");
      regions.push({
        role,
        name: (el.getAttribute("aria-label") || "").trim(),
      });
    }

    const dpr = window.devicePixelRatio || 1;
    return {
      url: location.href,
      pathname: location.pathname,
      title: document.title || "",
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        deviceScaleFactor: dpr,
      },
      nodes,
      regions,
    };
  });

  return data;
}
