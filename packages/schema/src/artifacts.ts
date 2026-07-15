export type RenderArtifactStatus =
  "rendering" | "completed" | "failed" | "cancelled";

export type RenderArtifactMetadata = {
  schemaVersion: 1;
  renderId: string;
  demoId: string;
  definitionHash?: string;
  captureHash?: string;
  captureEnvironmentHash?: string;
  status: RenderArtifactStatus;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  output: {
    video: "video.mp4";
  };
  render: {
    fps: number;
    durationInFrames: number;
    mediaMode: "screenshots" | "recording";
    width?: number;
    height?: number;
    scale?: number;
    crf?: number;
    frameRange?: [number, number];
  };
  source?: {
    manifestPath?: string;
    timelinePath?: string;
  };
  error?: {
    message: string;
  };
};

export type CaptureArtifactStatus =
  "created" | "running" | "completed" | "failed" | "cancelled";

export type CaptureArtifactMetadata = {
  schemaVersion: 1;
  captureRunId: string;
  demoId: string;
  definitionHash?: string;
  captureHash?: string;
  captureEnvironmentHash?: string;
  status: CaptureArtifactStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  paths: {
    manifest: "manifest.json";
    screenshots: "screenshots";
    trace?: "trace.zip";
    recording?: string;
  };
  environment: {
    headless: boolean;
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    locale: string;
    timezone: string;
    settle:
      | false
      | {
          idleWindowMs: number;
          timeoutMs: number;
          signal: "dom" | "visual" | "network" | "both";
        };
    timeoutMs: number;
  };
  error?: {
    message: string;
  };
};

export type LatestCapturePointer = {
  schemaVersion: 1;
  demoId: string;
  captureRunId: string;
  captureDirectory: string;
  completedAt: string;
};
