export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ParsedArgs = {
  command?: string;
  demoPath?: string;
  parseError?: string;
  helpRequested?: boolean;
  json: boolean;
  staticOnly: boolean;
  outputDir?: string;
  outputFile?: string;
  manifestPath?: string;
  timelinePath?: string;
  headless?: boolean;
  fps?: number;
  scale?: number;
  crf?: number;
  port?: number;
  noCapture?: boolean;
  entryPath?: string;
  /**
   * Path to a Playwright storageState file (cookies + localStorage) used during
   * capture so authenticated demos capture logged-in. Also fed to the capture
   * environment fingerprint so `studio --no-capture` can reuse an authenticated
   * capture made with the same storageState (otherwise the env hash diverges).
   */
  storageState?: string;
  authCommand?: "create" | "list" | "login" | "validate" | "remove" | "rename";
  profileId?: string;
  name?: string;
  origin?: string;
  validationUrl?: string;
  selector?: string;
  force?: boolean;
  /**
   * Render from the raw browser recording (webm) instead of the per-step
   * screenshots. Off by default: screenshots show the stable, post-settle
   * states captured for each step (no loading flash, no half-rendered frames),
   * which is what a polished demo needs. The recording is the unedited browser
   * capture — useful when you want to show real-time interaction, at the cost
   * of exposing page load transitions.
   */
  useRecording?: boolean;
  /** Positional URL for `democraft discover <url>`. */
  discoverUrl?: string;
  /** Repeated `--allow-origin` origins for discovery. */
  allowOrigins?: string[];
  /** URL for `democraft doctor --url` reachability check. */
  doctorUrl?: string;
  /** `democraft inspect --estimate`: return only the duration estimate. */
  estimate?: boolean;
};
