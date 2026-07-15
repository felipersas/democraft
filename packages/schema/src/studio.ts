import type { schemaVersion } from "./version";

/**
 * Studio metadata. Persisted to `studio-data/meta.json` by the CLI when it
 * launches the studio, so the studio can locate the demo source for
 * re-capture, staleness detection, and auto re-resolve. See
 * docs/architecture/studio-roadmap.md "Workflow / DX".
 */
export type StudioMeta = {
  /** Present on newly written metadata; omitted by legacy v1 files. */
  schemaVersion?: typeof schemaVersion;
  /** Absolute path to the demo.ts module. */
  demoPath: string;
  /** Directory where raw captures are written (`.democraft/runs/<id>/`). */
  captureDir: string;
  /** True when --output-dir must remain the exact recapture destination. */
  captureOutputDirExplicit?: boolean;
  /** Monorepo workspace root. */
  workspaceRoot: string;
  /** Stable, human-authored demo id. */
  demoId: string;
  /** Complete author definition captured by the current manifest. */
  definitionHash?: string;
  /** Capture compatibility identity of the current manifest. */
  captureHash?: string;
  /** Epoch ms when the current capture was materialized. */
  capturedAt: number;
};

export type StudioRenderRequest = {
  width?: number;
  height?: number;
  scale?: number;
  crf?: number;
  frameRange?: [number, number];
  entryPath?: string;
  captionOverrides?: Record<string, string>;
};

/** Staleness signal for the current capture, surfaced to the studio UI. */
export type StalenessKind =
  | "fresh"
  | "content" // authoring changed but captureHash stayed compatible
  | "structural" // capture incompatible or unknown — re-capture needed
  | "failed"; // capture or current demo compilation failed

export type Staleness = {
  kind: StalenessKind;
  /** Human-readable detail for the badge tooltip. */
  detail?: string;
};
