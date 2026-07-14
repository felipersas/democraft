export type RuntimeEnvironment = {
  viewport?: {
    width: number;
    height: number;
  };
  /**
   * Device pixel ratio for screenshot capture. Higher values produce sharper
   * screenshots (more device pixels per CSS pixel). Defaults to 2, which
   * captures at 2× resolution — e.g. a 1920×1080 viewport yields 3840×2160
   * PNGs. This gives the Remotion renderer enough pixel density for camera
   * zoom without pixelation.
   */
  deviceScaleFactor?: number;
  locale?: string;
  timezone?: string;
  storageState?: string;
};

export type RunDemoOptions = {
  outputDir?: string;
  headless?: boolean;
  environment?: RuntimeEnvironment;
  timeoutMs?: number;
};

export type BrowserLike = {
  close(): Promise<void>;
  newContext(options?: Record<string, unknown>): Promise<BrowserContextLike>;
};

export type BrowserContextLike = {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
  tracing?: {
    start(options?: Record<string, unknown>): Promise<void>;
    stop(options?: Record<string, unknown>): Promise<void>;
  };
};

export type PageLike = {
  goto(url: string): Promise<unknown>;
  url(): string;
  getByRole(role: string, options?: { name?: string }): LocatorLike;
  getByLabel(text: string): LocatorLike;
  getByTestId(id: string): LocatorLike;
  getByText(text: string): LocatorLike;
  video?(): { path(): Promise<string> } | null;
  screenshot?(options?: Record<string, unknown>): Promise<Buffer>;
  waitForTimeout?(durationMs: number): Promise<void>;
};

export type LocatorLike = {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  selectOption(value: string): Promise<unknown>;
  boundingBox(options?: {
    timeout?: number;
  }): Promise<{ x: number; y: number; width: number; height: number } | null>;
  isVisible(options?: { timeout?: number }): Promise<boolean>;
  textContent(): Promise<string | null>;
};

export type PlaywrightBindings = {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<BrowserLike>;
  };
};
