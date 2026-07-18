/**
 * Deterministic locator candidate scoring for Discovery.
 *
 * Pure functions, no Playwright, no I/O — so scoring is trivially unit-testable
 * and guaranteed stable: the same input ALWAYS yields the same confidence and
 * stability (plan §5.6). No opaque heuristics, no randomness, no clock.
 *
 * Inputs (role, name, matchCount, visibility) are the same signals
 * `createLocator` (`./locator.ts:81`) uses to resolve a target at capture
 * time, so a high-confidence discovery candidate is guaranteed to resolve to
 * the same element when the agent authors it into `demo.ts`.
 */
import type {
  BoundingBox,
  DiscoveredElement,
  DiscoveredElementKind,
  Locator,
  LocatorCandidate,
  LocatorStability,
} from "@democraft/schema";

export type ScoringInput = {
  role?: string;
  name?: string;
  text?: string;
  testId?: string;
  label?: string;
  visible: boolean;
  enabled: boolean;
  /** How many elements on the page match the role+name locator. */
  roleMatchCount: number;
  /** How many elements match the label locator (if a label is known). */
  labelMatchCount: number;
  /** How many elements carry this test id (if known). */
  testIdMatchCount: number;
  /** How many elements match the visible text (if known). */
  textMatchCount: number;
};

/** Stability class derived from locator kind + uniqueness (plan §5.6). */
function classifyStability(
  kind: Locator["kind"],
  unique: boolean,
): LocatorStability {
  if (!unique) return "low";
  if (kind === "role" || kind === "label" || kind === "testId") return "high";
  return "medium";
}

/**
 * Build the best-first ordered list of locator candidates for an element.
 * Ordering follows the house preference (plan §5.6):
 *   role+name > label > testId > text.
 *
 * Determinism contract: identical `ScoringInput` → identical candidates
 * (order, confidence, stability, reasons). Tested in discovery-scoring.test.ts.
 */
export function scoreLocatorCandidates(
  input: ScoringInput,
): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];

  if (input.role && input.name && input.roleMatchCount >= 1) {
    const locator: Locator = { kind: "role", role: input.role, name: input.name };
    const unique = input.roleMatchCount === 1;
    const confidence = roleNameConfidence(
      input.roleMatchCount,
      input.visible,
      input.enabled,
    );
    const reasons = [
      unique
        ? "Unique accessible role and name"
        : `Accessible role and name matches ${input.roleMatchCount} elements`,
      input.visible ? "Element is visible" : "Element is not visible",
    ];
    candidates.push({
      locator,
      confidence,
      stability: classifyStability("role", unique),
      unique,
      matchCount: input.roleMatchCount,
      reasons,
      risks: unique ? undefined : ["Ambiguous: resolve by region or text"],
    });
  }

  if (input.label && input.labelMatchCount >= 1) {
    const locator: Locator = { kind: "label", text: input.label };
    const unique = input.labelMatchCount === 1;
    candidates.push({
      locator,
      confidence: baseConfidence(unique, input.visible, 0.9),
      stability: classifyStability("label", unique),
      unique,
      matchCount: input.labelMatchCount,
      reasons: [
        unique
          ? "Unique associated label"
          : `Label matches ${input.labelMatchCount} elements`,
      ],
      risks: unique ? undefined : ["Ambiguous label"],
    });
  }

  if (input.testId && input.testIdMatchCount >= 1) {
    const locator: Locator = { kind: "testId", id: input.testId };
    const unique = input.testIdMatchCount === 1;
    candidates.push({
      locator,
      confidence: baseConfidence(unique, input.visible, 0.85),
      stability: classifyStability("testId", unique),
      unique,
      matchCount: input.testIdMatchCount,
      reasons: [unique ? "Unique test id" : `Test id shared by ${input.testIdMatchCount} elements`],
      risks: ["Test ids are author-controlled and may change"],
    });
  }

  if (input.text && input.textMatchCount >= 1) {
    const locator: Locator = { kind: "text", text: input.text };
    const unique = input.textMatchCount === 1;
    candidates.push({
      locator,
      confidence: baseConfidence(unique, input.visible, 0.6),
      stability: classifyStability("text", unique),
      unique,
      matchCount: input.textMatchCount,
      reasons: [unique ? "Unique visible text" : `Text matches ${input.textMatchCount} elements`],
      risks: ["Text is the most fragile locator; prefer role or label"],
    });
  }

  // Highest confidence first; tiebreak on stability rank then matchCount.
  const stabilityRank: Record<LocatorStability, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  return candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (stabilityRank[b.stability] !== stabilityRank[a.stability]) {
      return stabilityRank[b.stability] - stabilityRank[a.stability];
    }
    return a.matchCount - b.matchCount;
  });
}

function baseConfidence(
  unique: boolean,
  visible: boolean,
  peak: number,
): number {
  let score = peak;
  if (!unique) score -= 0.3;
  if (!visible) score -= 0.15;
  return roundConfidence(clamp01(score));
}

function roleNameConfidence(
  matchCount: number,
  visible: boolean,
  enabled: boolean,
): number {
  let score = 0.99;
  if (matchCount > 1) score -= 0.3 + Math.min(0.3, (matchCount - 1) * 0.02);
  if (!visible) score -= 0.15;
  if (!enabled) score -= 0.05;
  return roundConfidence(clamp01(score));
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Suggest a stable target id for an element. Prefers the accessible name
 * (camelCased), falls back to role, finally to a stable positional id.
 * Mirrors the slug style of compiler step ids (`compiler/src/normalize.ts`).
 */
export function suggestTargetId(
  kind: DiscoveredElementKind,
  role: string | undefined,
  name: string | undefined,
  fallbackId: string,
): string {
  const source = (name ?? role ?? kind).trim();
  if (!source) return fallbackId;
  const camel = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_match, _space, ch: string) => ch.toUpperCase())
    .replace(/^([A-Z])/, (ch: string) => ch.toLowerCase());
  return camel || fallbackId;
}

/**
 * Heuristic for whether an element is "interactive" for demo purposes — i.e.
 * something a user can click, fill, or toggle. Headings, list items, cards and
 * regions are narratively useful but not interactive.
 */
export function isInteractiveKind(kind: DiscoveredElementKind): boolean {
  switch (kind) {
    case "button":
    case "link":
    case "textbox":
    case "textarea":
    case "checkbox":
    case "radio":
    case "combobox":
    case "menuitem":
    case "tab":
      return true;
    case "dialog":
    case "heading":
    case "card":
    case "listitem":
    case "other":
      return false;
  }
}

/** Whether a discovered element should be retained in the page map (plan §5.4). */
export function shouldRetainElement(
  element: Pick<DiscoveredElement, "visible" | "interactive" | "boundingBox">,
  minInteractiveArea = 12 * 12,
): boolean {
  if (!element.visible) return false;
  const box = element.boundingBox as BoundingBox | undefined;
  // Drop tiny non-interactive elements (decorative icons, 1px spacers).
  if (!element.interactive && box) {
    if (box.width * box.height < minInteractiveArea) return false;
  }
  return true;
}
