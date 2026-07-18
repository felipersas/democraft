/**
 * Page Discovery — the semantic map of a web page produced by
 * `democraft discover <url>`. Discovery turns a live page into a filtered,
 * agent-useful representation (regions, interactive elements, locator
 * candidates, repeated collections) WITHOUT dumping the DOM.
 *
 * Design rules (see docs/architecture/discovery.md + the AI Agents plan §5):
 * - Reuse the authoring vocabulary: `Locator`, `BoundingBox` from `./geometry`.
 *   Never invent a parallel locator format — every `LocatorCandidate.locator`
 *   must be convertible to the public authoring API (`byRole`/`byLabel`/…).
 * - Discovery artifacts are JSON-serializable and versioned independently of
 *   DemoIR. They are a separate artifact family (like capture/render
 *   metadata), NOT a second authoring DSL.
 * - No secrets, storage state, cookies, or auth headers ever appear here.
 *   Discovery is read-only and shareable.
 */
import type { BoundingBox, Locator } from "./geometry";

/**
 * Numeric schema version for the discovery artifact family. Matches the
 * `schemaVersion: 1` convention used by the capture/render artifact metadata
 * (`./artifacts.ts`), distinct from the string `"1"` carried by DemoIR /
 * manifest / timeline.
 */
export type DiscoverySchemaVersion = 1;

/**
 * Risk classification of an interactive element (plan §5.9). In the MVP only
 * `read-only` actions may be explored automatically; `unknown` is NEVER
 * treated as safe.
 */
export type InteractionRisk =
  | "read-only"
  | "reversible"
  | "state-changing"
  | "destructive"
  | "unknown";

/**
 * How durable a locator candidate is expected to be across small markup
 * changes. `high` = role+name on a unique element; `medium` = label/testId
 * or scoped text; `low` = fragile text match or CSS fallback (plan §5.6).
 */
export type LocatorStability = "high" | "medium" | "low";

/**
 * A single locator suggestion for a discovered element, with a deterministic
 * confidence score, stability class, uniqueness, match count, and human-
 * readable reasons/risks. The score MUST be a pure function of (role, name,
 * matchCount, visibility) so the same DOM always yields the same score.
 */
export type LocatorCandidate = {
  locator: Locator;
  /** Deterministic confidence in [0, 1]. */
  confidence: number;
  stability: LocatorStability;
  /** True when the locator resolves to exactly one element on the page. */
  unique: boolean;
  /** Number of elements the locator currently matches (1 when `unique`). */
  matchCount: number;
  /** Why this candidate received its score. */
  reasons: string[];
  /** Known fragility or risk factors (optional). */
  risks?: string[];
};

/**
 * ARIA landmark region discovered on the page. `kind` is the landmark role;
 * `id` is a stable, slug-derived identifier scoped to the page.
 */
export type DiscoveredRegion = {
  id: string;
  kind:
    | "navigation"
    | "main"
    | "complementary"
    | "banner"
    | "contentinfo"
    | "region"
    | "search"
    | "form";
  label?: string;
};

/**
 * Coarse kind taxonomy for discovered elements. `other` captures anything
 * interactive that doesn't fit a more specific kind. Kept deliberately small
 * so agents can reason about it; the precise ARIA role (when present) is in
 * `role`.
 */
export type DiscoveredElementKind =
  | "button"
  | "link"
  | "textbox"
  | "textarea"
  | "checkbox"
  | "radio"
  | "combobox"
  | "menuitem"
  | "tab"
  | "dialog"
  | "heading"
  | "card"
  | "listitem"
  | "other";

/**
 * A single interactive or narratively relevant element discovered on the page.
 * `locatorCandidates` is ordered best-first; `suggestedTargetId` is the
 * recommended semantic target id for a `demo.ts` target definition (may be
 * omitted when no stable candidate exists).
 */
export type DiscoveredElement = {
  id: string;
  kind: DiscoveredElementKind;
  /** ARIA role, when the element exposes one. */
  role?: string;
  /** Accessible name, when present. */
  name?: string;
  /** Normalized visible text, when present. */
  text?: string;
  visible: boolean;
  enabled: boolean;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  /** True when the element accepts user interaction (click/fill/toggle). */
  interactive: boolean;
  /** Region the element belongs to, when scoping is known. */
  regionId?: string;
  /** Viewport-relative box in CSS pixels, when measurable. */
  boundingBox?: BoundingBox;
  /**
   * True when the element lives inside a closed overlay (`<dialog>` without
   * `[open]`, `[hidden]`, or `<details>` without `[open]`). Such elements are
   * included in the map with `visible: false` so an agent can author them
   * ahead of opening the overlay — but a `DC408` warning fires naming the
   * trigger, since the element can't be captured until the overlay opens.
   */
  insideClosedOverlay?: boolean;
  /** Best-first locator suggestions; never empty for retained elements. */
  locatorCandidates: LocatorCandidate[];
  /** Suggested target id (kebab/camel) for authoring, when a stable one exists. */
  suggestedTargetId?: string;
  /** Interaction risk classification (plan §5.9). */
  risk?: InteractionRisk;
};

/**
 * Aggregation of a long repeated list (plan §5.7). Avoids dumping every item;
 * `sampleElementIds` references a small representative subset. Agents can
 * request more detail on a specific collection without re-fetching the page.
 */
export type DiscoveredCollection = {
  id: string;
  kind: "repeated-collection";
  label?: string;
  /** Total number of items in the collection. */
  count: number;
  /** Shared ARIA role of the items, when homogeneous. */
  itemRole?: string;
  /** Representative subset (typically the first few items). */
  sampleElementIds: string[];
};

/**
 * Severity for a discovery warning. Uses the diagnostic severity vocabulary so
 * discovery warnings map cleanly onto `Diagnostic` (plan §11).
 */
export type DiscoveryWarningSeverity = "info" | "warning" | "error";

/**
 * A non-fatal issue discovered while mapping a page: ambiguous locators, no
 * interactive elements, very large lists, etc. Fatal problems surface as
 * `Diagnostic`s and a non-zero exit code instead.
 */
export type DiscoveryWarning = {
  /** Stable `DCxxxx` code (see `./diagnostics.ts`). */
  code: string;
  severity: DiscoveryWarningSeverity;
  message: string;
  elementId?: string;
  regionId?: string;
};

/**
 * The top-level Page Discovery artifact (plan §5.5). Produced by
 * `democraft discover <url> --json` and persisted as
 * `.democraft/discovery/<application-id>/runs/<run-id>/application-map.json`.
 */
export type PageDiscovery = {
  schemaVersion: DiscoverySchemaVersion;
  generatedAt: string;
  page: {
    url: string;
    pathname: string;
    title?: string;
    viewport: {
      width: number;
      height: number;
      deviceScaleFactor: number;
    };
  };
  regions: DiscoveredRegion[];
  elements: DiscoveredElement[];
  collections: DiscoveredCollection[];
  warnings: DiscoveryWarning[];
};

/**
 * Run lifecycle state machine for a discovery run. Mirrors the capture
 * artifact status (`./artifacts.ts:38`) so tooling and tests reuse one mental
 * model.
 */
export type DiscoveryRunStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Environment captured for a discovery run. A trimmed view of the capture
 * environment — discovery does not record video, trace, or settle config.
 */
export type DiscoveryEnvironment = {
  headless: boolean;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  locale: string;
  timezone: string;
  timeoutMs: number;
};

/**
 * Hashes that fingerprint the discovered environment + page content, used to
 * decide whether a cached discovery run is still reusable. Mirrors the
 * capture-environment hash discipline.
 */
export type DiscoveryHashes = {
  environmentHash?: string;
  contentHash?: string;
};

/**
 * Persistent metadata for a single discovery run (plan §5.10). Written to
 * `.democraft/discovery/<application-id>/runs/<run-id>/metadata.json`. The
 * `latest.json` pointer only ever references a `completed` run.
 */
export type DiscoveryRunMetadata = {
  schemaVersion: DiscoverySchemaVersion;
  discoveryRunId: string;
  applicationId: string;
  origin: string;
  status: DiscoveryRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  paths: {
    applicationMap: "application-map.json";
    pages: "pages";
    screenshots: "screenshots";
  };
  environment: DiscoveryEnvironment;
  hashes: DiscoveryHashes;
  error?: { message: string };
};

/**
 * Pointer to the most recently completed discovery run for an application
 * (plan §5.10). Mirrors `LatestCapturePointer` (`./artifacts.ts:79`).
 */
export type LatestDiscoveryPointer = {
  schemaVersion: DiscoverySchemaVersion;
  applicationId: string;
  discoveryRunId: string;
  discoveryDirectory: string;
  completedAt: string;
};
