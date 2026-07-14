import React from "react";
import { Composition, registerRoot } from "remotion";
import {
  ProductDemoVideo,
  compositionId,
  defaultProductDemoProps,
  type ProductDemoVideoProps,
} from "./composition";

function Root() {
  return React.createElement(Composition, {
    id: compositionId,
    component: ProductDemoVideo as React.FC<Record<string, unknown>>,
    width: 1920,
    height: 1080,
    fps: 60,
    durationInFrames: 1,
    defaultProps: defaultProductDemoProps,
    calculateMetadata: ({ props }: { props: Record<string, unknown> }) => ({
      ...metadataFromProps(props as ProductDemoVideoProps),
    }),
  });
}

function metadataFromProps(props: ProductDemoVideoProps) {
  return {
    durationInFrames: props.timeline.durationInFrames,
    fps: props.timeline.fps,
    width: props.width,
    height: props.height,
  };
}

registerRoot(Root);
