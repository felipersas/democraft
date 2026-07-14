import type {
  Locator,
  SceneMetadata,
  TargetDefinition,
} from "@democraft/schema";

export type TargetInput =
  Omit<TargetDefinition, "id"> | TargetDefinition | Locator;
export type TargetMap = Record<string, TargetDefinition>;

/**
 * A Democraft adapter bundles optional extensions to the rendering pipeline.
 *
 * The type is intentionally minimal (name + optional visualRegistry) to avoid
 * a circular dependency on `@democraft/remotion`. The full adapter
 * implementation (e.g. `remocnAdapter()`) lives in `@democraft/remotion` and
 * returns a `DemocraftAdapter`-shaped object.
 */
export type DemocraftAdapter = {
  name: string;
  visualRegistry?: {
    captions: Record<string, unknown>;
    callouts: Record<string, unknown>;
  };
};

export type DemoConfig = {
  fps?: number;
  environment?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  adapters?: DemocraftAdapter[];
};

export type SceneStepOptions = {
  id?: string;
};

export type TransitionOptions = SceneStepOptions & {
  type?: "cut" | "crossfade";
  duration?: string;
};

export type CaptionOptions = SceneStepOptions & {
  renderer?: string;
};

export type CalloutOptions = SceneStepOptions & {
  title: string;
  description?: string;
  renderer?: string;
};

export type FocusOptions = SceneStepOptions & {
  padding?: number;
};

export type CapturedStep =
  | { kind: "browser.goto"; id?: string; path: string }
  | { kind: "browser.click"; id?: string; target: string }
  | { kind: "browser.fill"; id?: string; target: string; value: string }
  | { kind: "browser.select"; id?: string; target: string; value: string }
  | { kind: "assert.visible"; id?: string; target: string }
  | { kind: "assert.text"; id?: string; target: string; text: string }
  | { kind: "assert.url"; id?: string; path: string }
  | { kind: "camera.establish"; id?: string; target?: string }
  | { kind: "camera.focus"; id?: string; target: string; padding?: number }
  | { kind: "timeline.hold"; id?: string; duration: string }
  | {
      kind: "timeline.transition";
      id?: string;
      transition?: "cut" | "crossfade";
      duration?: string;
    }
  | { kind: "overlay.caption"; id?: string; text: string; renderer?: string }
  | {
      kind: "overlay.callout";
      id?: string;
      target: string;
      title: string;
      description?: string;
      renderer?: string;
    }
  | { kind: "cue"; id?: string; name: string };

export type DemoScene = {
  goto(path: string, options?: SceneStepOptions): Promise<void>;
  click(target: string, options?: SceneStepOptions): Promise<void>;
  fill(
    target: string,
    value: string,
    options?: SceneStepOptions,
  ): Promise<void>;
  select(
    target: string,
    value: string,
    options?: SceneStepOptions,
  ): Promise<void>;
  expectVisible(target: string, options?: SceneStepOptions): Promise<void>;
  expectText(
    target: string,
    text: string,
    options?: SceneStepOptions,
  ): Promise<void>;
  expectUrl(path: string, options?: SceneStepOptions): Promise<void>;
  establish(target?: string, options?: SceneStepOptions): Promise<void>;
  focus(target: string, options?: FocusOptions): Promise<void>;
  hold(duration: string, options?: SceneStepOptions): Promise<void>;
  transition(options?: TransitionOptions): Promise<void>;
  caption(text: string, options?: CaptionOptions): Promise<void>;
  callout(target: string, options: CalloutOptions): Promise<void>;
  cue(name: string, options?: SceneStepOptions): Promise<void>;
};

export type DemoCapture = {
  scene(
    id: string,
    run: (scene: DemoScene) => Promise<void> | void,
  ): Promise<void>;
  scene(
    id: string,
    metadata: SceneMetadata,
    run: (scene: DemoScene) => Promise<void> | void,
  ): Promise<void>;
};

export type DemoDefinition = {
  id: string;
  title: string;
  source: {
    baseUrl: string;
    initialPath?: string;
  };
  targets: TargetMap;
  run(args: { demo: DemoCapture }): Promise<void> | void;
};
