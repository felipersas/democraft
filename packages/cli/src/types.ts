export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ParsedArgs = {
  command?: string;
  demoPath?: string;
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
};
