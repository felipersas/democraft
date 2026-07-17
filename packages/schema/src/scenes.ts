import type { AudioTrackIR } from "./audio";
import type { DemoStep } from "./steps";
import type { TargetDefinition } from "./geometry";
import type { schemaVersion } from "./version";

export type DemoSource = {
  baseUrl: string;
  initialPath?: string;
};

export type ScenePacing = "slow" | "normal" | "fast";
export type SceneImportance = "primary" | "secondary" | "supporting";

export type SceneMetadata = {
  purpose?: string;
  pacing?: ScenePacing;
  importance?: SceneImportance;
};

export type DemoSceneIR = {
  id: string;
  purpose?: string;
  pacing: ScenePacing;
  importance: SceneImportance;
  steps: DemoStep[];
};

export type DemoIR = {
  schemaVersion: typeof schemaVersion;
  id: string;
  /**
   * Versioned SHA-256 of the complete canonical author definition.
   * `id` remains the stable, human-authored demo identifier.
   */
  definitionHash?: string;
  /** Versioned hash of the subset that can affect capture artifacts. */
  captureHash?: string;
  title: string;
  source: DemoSource;
  authentication?: { profileId: string };
  targets: Record<string, TargetDefinition>;
  /** Visual IDs declared by the author module. Component functions stay out of IR. */
  visuals?: string[];
  /**
   * Audio tracks (presentation-only). Never affects `captureHash`; included in
   * `definitionHash`. Optional for back-compat with demos authored before audio.
   */
  audio?: AudioTrackIR[];
  scenes: DemoSceneIR[];
};
