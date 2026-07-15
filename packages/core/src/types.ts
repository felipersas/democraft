import type {
  Locator,
  SceneMetadata,
  TargetDefinition,
} from "@democraft/schema";

export type TargetInput =
  Omit<TargetDefinition, "id"> | TargetDefinition | Locator;
export type DefinedTargets<TTargets extends Record<string, TargetInput>> = {
  [TTargetId in keyof TTargets]: TargetDefinition;
};
export type TargetMap<TTargetId extends string = string> = Record<
  TTargetId,
  TargetDefinition
>;
export type TargetId<TTargets extends TargetMap> = Extract<
  keyof TTargets,
  string
>;

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

export type Duration = `${number}ms` | `${number}s`;

export type TransitionOptions = SceneStepOptions & {
  type?: "cut" | "crossfade";
  duration?: Duration;
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
  | { kind: "timeline.hold"; id?: string; duration: Duration }
  | {
      kind: "timeline.transition";
      id?: string;
      transition?: "cut" | "crossfade";
      duration?: Duration;
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

export type DemoScene<TTargetId extends string = string> = {
  goto(path: string, options?: SceneStepOptions): Promise<void>;
  click(target: TTargetId, options?: SceneStepOptions): Promise<void>;
  fill(
    target: TTargetId,
    value: string,
    options?: SceneStepOptions,
  ): Promise<void>;
  select(
    target: TTargetId,
    value: string,
    options?: SceneStepOptions,
  ): Promise<void>;
  expectVisible(target: TTargetId, options?: SceneStepOptions): Promise<void>;
  expectText(
    target: TTargetId,
    text: string,
    options?: SceneStepOptions,
  ): Promise<void>;
  expectUrl(path: string, options?: SceneStepOptions): Promise<void>;
  establish(target?: TTargetId, options?: SceneStepOptions): Promise<void>;
  focus(target: TTargetId, options?: FocusOptions): Promise<void>;
  hold(duration: Duration, options?: SceneStepOptions): Promise<void>;
  transition(options?: TransitionOptions): Promise<void>;
  caption(text: string, options?: CaptionOptions): Promise<void>;
  callout(target: TTargetId, options: CalloutOptions): Promise<void>;
  cue(name: string, options?: SceneStepOptions): Promise<void>;
};

export type DemoCapture<TTargetId extends string = string> = {
  scene(
    id: string,
    run: (scene: DemoScene<TTargetId>) => Promise<void> | void,
  ): Promise<void>;
  scene(
    id: string,
    metadata: SceneMetadata,
    run: (scene: DemoScene<TTargetId>) => Promise<void> | void,
  ): Promise<void>;
};

export type DemoInput<
  TTargets extends Record<string, TargetInput> = Record<string, TargetInput>,
> = {
  id: string;
  title: string;
  config?: DemoConfig;
  source: {
    baseUrl: string;
    initialPath?: string;
  };
  targets?: TTargets;
  run(args: {
    demo: DemoCapture<Extract<keyof TTargets, string>>;
  }): Promise<void> | void;
};

export type DemoDefinition<TTargets extends TargetMap = TargetMap> = Omit<
  DemoInput<TTargets>,
  "targets"
> & { targets: TTargets };
