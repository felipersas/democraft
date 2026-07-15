import {
  cancelRenderArtifact,
  completeRenderArtifact,
  failRenderArtifact,
  type RenderArtifact,
} from "@democraft/remotion/server";

export async function runRenderArtifactLifecycle<T>(options: {
  artifact: RenderArtifact;
  prepare: () => Promise<T>;
  render: (prepared: T) => Promise<void>;
  isCancelled: () => boolean;
}): Promise<void> {
  try {
    const prepared = await options.prepare();
    await options.render(prepared);
    await completeRenderArtifact(options.artifact);
  } catch (error) {
    if (options.isCancelled()) {
      await cancelRenderArtifact(options.artifact);
    } else {
      await failRenderArtifact(options.artifact, error);
    }
    throw error;
  }
}
