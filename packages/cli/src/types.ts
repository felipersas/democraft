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
   * Render from the raw browser recording (webm) instead of the per-step
   * screenshots. Off by default: screenshots show the stable, post-settle
   * states captured for each step (no loading flash, no half-rendered frames),
   * which is what a polished demo needs. The recording is the unedited browser
   * capture — useful when you want to show real-time interaction, at the cost
   * of exposing page load transitions.
   */
  useRecording?: boolean;
};
