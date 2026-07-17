import type {
  AudioKind,
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
    visuals?: Record<string, unknown>;
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

/**
 * An audio track declared on a demo. Times use the project's `Duration` string
 * convention (`"250ms"`, `"1s"`) so authoring stays fps-independent — the
 * compiler converts them to milliseconds, the timeline to frames. Audio is
 * presentation-only: it never affects Playwright capture.
 *
 * @example
 * ```ts
 * defineDemo({
 *   audioTracks: [
 *     {
 *       id: "background-music",
 *       src: "./assets/music.mp3",
 *       kind: "music",
 *       volume: 0.25,
 *       loop: true,
 *       fadeIn: "500ms",
 *       fadeOut: "500ms",
 *     },
 *   ],
 *   // ...
 * });
 * ```
 */
export type AudioTrackInput = {
  /** Stable, demo-unique id. Used by the Studio and diagnostics. */
  id: string;
  /**
   * Path (workspace-relative or absolute), URL, or `staticFile("…")` reference
   * to the audio file. Resolved at render time; not checked at compile time.
   */
  src: string;
  label?: string;
  kind?: AudioKind;
  /** When the track starts on the composition timeline. Defaults to `"0ms"`. */
  startAt?: Duration;
  /** Inclusive end on the timeline. Omit to play to composition end. */
  endAt?: Duration;
  /** 0..1. Defaults to 1. */
  volume?: number;
  muted?: boolean;
  loop?: boolean;
  /** Fade-in duration. Defaults to `"0ms"`. */
  fadeIn?: Duration;
  /** Fade-out duration. Defaults to `"0ms"`. */
  fadeOut?: Duration;
};

/** A renderer-owned component whose props are inferred without coupling core to React. */
export type VisualDefinition<TProps = unknown> = {
  readonly component: unknown;
  /** Type-only marker used by `scene.visual`; never read at runtime. */
  readonly __visualProps?: (props: TProps) => TProps;
};

export type VisualMap = Record<string, { readonly component: unknown }>;
export type VisualProps<TVisual> =
  TVisual extends VisualDefinition<infer TProps> ? TProps : never;

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

export type VisualOptions = SceneStepOptions & {
  duration?: Duration;
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
  | {
      kind: "overlay.visual";
      id?: string;
      visual: string;
      props: unknown;
      duration?: Duration;
    }
  | { kind: "cue"; id?: string; name: string };

export type DemoScene<
  TTargetId extends string = string,
  TVisuals extends VisualMap = VisualMap,
> = {
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
  visual<TVisualId extends Extract<keyof TVisuals, string>>(
    visual: TVisualId,
    props: VisualProps<TVisuals[TVisualId]>,
    options?: VisualOptions,
  ): Promise<void>;
  cue(name: string, options?: SceneStepOptions): Promise<void>;
};

export type DemoCapture<
  TTargetId extends string = string,
  TVisuals extends VisualMap = VisualMap,
> = {
  scene(
    id: string,
    run: (scene: DemoScene<TTargetId, TVisuals>) => Promise<void> | void,
  ): Promise<void>;
  scene(
    id: string,
    metadata: SceneMetadata,
    run: (scene: DemoScene<TTargetId, TVisuals>) => Promise<void> | void,
  ): Promise<void>;
};

export type DemoInput<
  TTargets extends Record<string, TargetInput> = Record<string, TargetInput>,
  TVisuals extends VisualMap = Record<never, never>,
> = {
  id: string;
  title: string;
  config?: DemoConfig;
  source: {
    baseUrl: string;
    initialPath?: string;
  };
  /** Stable local profile reference. Sensitive browser state never enters source. */
  authentication?: { profileId: string };
  targets?: TTargets;
  visuals?: TVisuals;
  /** Optional background music, narration, sound effects, and ambient tracks. */
  audioTracks?: AudioTrackInput[];
  run(args: {
    demo: DemoCapture<Extract<keyof TTargets, string>, TVisuals>;
  }): Promise<void> | void;
};

export type DemoDefinition<
  TTargets extends TargetMap = TargetMap,
  TVisuals extends VisualMap = VisualMap,
> = Omit<DemoInput<TTargets, TVisuals>, "targets"> & { targets: TTargets };
