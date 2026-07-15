export type RenderArtifactStatus =
  "rendering" | "completed" | "failed" | "cancelled";

export type RenderArtifactMetadata = {
  schemaVersion: 1;
  renderId: string;
  demoId: string;
  definitionHash?: string;
  captureHash?: string;
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
