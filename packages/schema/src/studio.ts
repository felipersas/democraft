/**
 * Studio metadata. Persisted to `studio-data/meta.json` by the CLI when it
 * launches the studio, so the studio can locate the demo source for
 * re-capture, staleness detection, and auto re-resolve. See
 * docs/architecture/studio-roadmap.md "Workflow / DX".
 */
export type StudioMeta = {
  /** Absolute path to the demo.ts module. */
  demoPath: string;
  /** Directory where raw captures are written (`.democraft/runs/<id>/`). */
  captureDir: string;
  /** Monorepo workspace root. */
  workspaceRoot: string;
  /** Content-derived demo id (hash of the compiled IR). */
  demoId: string;
  /** Epoch ms when the current capture was materialized. */
  capturedAt: number;
};

/** Staleness signal for the current capture, surfaced to the studio UI. */
export type StalenessKind =
  | "fresh"
  | "content" // demo.ts changed but IR is identical (whitespace, comments)
  | "structural" // demo.ts changed structurally — re-capture needed
  | "failed"; // capture produced chrome-error:// pages (app was down)

export type Staleness = {
  kind: StalenessKind;
  /** Human-readable detail for the badge tooltip. */
  detail?: string;
};
