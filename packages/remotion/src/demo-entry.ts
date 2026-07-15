import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Build the browser entry that wires visual definitions from a demo module. */
export function createDemoEntrySource(demoPath: string): string {
  const demoImport = path.resolve(demoPath).replaceAll("\\", "/");
  return `import React from "react";
import {Composition, registerRoot} from "remotion";
import demo from ${JSON.stringify(demoImport)};
import {
  ProductDemoVideo,
  compositionId,
  defaultProductDemoProps,
  visualRegistryFromDefinitions,
} from "@democraft/remotion/client";

const registry = visualRegistryFromDefinitions(demo.visuals);
const DemoVideo = (props) => React.createElement(ProductDemoVideo, {...props, registry});

function Root() {
  return React.createElement(Composition, {
    id: compositionId,
    component: DemoVideo,
    width: 1920,
    height: 1080,
    fps: 60,
    durationInFrames: 1,
    defaultProps: defaultProductDemoProps,
    calculateMetadata: ({props}) => ({
      durationInFrames: props.timeline.durationInFrames,
      fps: props.timeline.fps,
      width: props.width,
      height: props.height,
    }),
  });
}

registerRoot(Root);
`;
}

/** Materialize a deterministic generated entry beside the demo module. */
export async function materializeDemoEntry(
  demoPath: string,
): Promise<string> {
  const absoluteDemoPath = path.resolve(demoPath);
  const directory = path.join(
    path.dirname(absoluteDemoPath),
    ".democraft",
    "entries",
  );
  const digest = createHash("sha256")
    .update(absoluteDemoPath)
    .digest("hex")
    .slice(0, 16);
  const entryPath = path.join(directory, `demo-${digest}.tsx`);
  await mkdir(directory, { recursive: true });
  await writeFile(entryPath, createDemoEntrySource(absoluteDemoPath), "utf8");
  return entryPath;
}
