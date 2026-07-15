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
  /**
   * How the capture runtime decides a page is "ready" before taking each
   * screenshot. When omitted, the runtime uses sensible defaults
   * (`DEFAULT_SETTLE_STRATEGY`) so demos are captured after the page settles
   * without any author configuration. Pass `false` to disable settling and
   * fall back to a fixed hold before each screenshot.
   *
   * See {@link SettleStrategy} for the tunables (idle window, timeout, signal).
   */
  settle?: SettleStrategy | false;
};

/**
 * Strategy for detecting that a page has settled before a screenshot is taken.
 *
 * Modern web apps keep loading content after the DOM is ready — data fetches,
 * hydration, animations, lazy images. A screenshot taken the instant an action
 * returns often captures a half-rendered view, so downstream captions/callouts
 * narrate something the screen isn't showing yet.
 *
 * Rather than wait a fixed duration (too short for slow pages, dead air for
 * fast ones), the settle gate waits for the page to **stop changing**. Two
 * signals detect that, chosen because they measure what the viewer actually
 * sees (not network activity, which `networkidle` relies on and is flaky with
 * polling/analytics/SSE — officially discouraged by Playwright):
 *
 * - `"dom"` — a `MutationObserver` counts DOM mutations; idle when none occur
 *   for `idleWindowMs`.
 * - `"visual"` — periodic low-resolution screenshots are compared; idle when
 *   two consecutive samples are identical within `idleWindowMs`. Catches
 *   pure-visual motion (CSS animations, fade-ins) that doesn't touch the DOM.
 * - `"both"` (default) — idle only when both signals agree. Most robust.
 *
 * Settling is best-effort: if the page never quiets down, the gate gives up at
 * `timeoutMs` and captures anyway (never throws), so a pathological page can't
 * stall the whole capture.
 */
export type SettleStrategy = {
  /**
   * How long the page must stay quiet (no DOM mutations and/or no visual
   * changes, per `signal`) before it's considered settled. Shorter is more
   * responsive; longer is more conservative. Default 350ms.
   */
  idleWindowMs?: number;
  /**
   * Maximum time to wait for the page to settle before capturing anyway
   * (best-effort). Should be long enough for real loads but bounded so a
   * misbehaving page (infinite animation, endless polling UI) can't stall the
   * capture. Default 4000ms.
   */
  timeoutMs?: number;
  /**
   * Which signal(s) to use to detect "quiet".
   * - `"dom"` — DOM mutations only (structural rendering).
   * - `"visual"` — screenshot diffing only (pure-visual motion).
   * - `"network"` — in-flight fetch/XHR only (pending data requests).
   * - `"both"` (default) — all three; settled only when every signal agrees.
   *   Most robust, since each catches a different kind of in-flight work
   *   (e.g. the network signal reveals a pending data fetch even when the DOM
   *   is momentarily quiet).
   */
  signal?: "dom" | "visual" | "network" | "both";
};

/**
 * Default settle strategy: both signals, 350ms idle window, 4s timeout. Tuned
 * for typical SaaS apps (App Router / SPA with hydration + data fetch).
 */
export const DEFAULT_SETTLE_STRATEGY: Required<SettleStrategy> = {
  idleWindowMs: 350,
  timeoutMs: 4000,
  signal: "both",
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
  /**
   * Optional navigation gate. SPAs (Next.js App Router, React Router) resolve
   * client-side navigation AFTER `<a>`/`<Link>` click resolves, so a click
   * that changes the route returns before the new view is mounted. When
   * present, the runtime races this against a short timeout after a click so
   * the next step sees the navigated page — without stalling on clicks that
   * don't navigate (dialogs, toggles).
   */
  waitForLoadState?(state?: string): Promise<void>;
  waitForURL?(
    url: string | RegExp,
    options?: { timeout?: number },
  ): Promise<void>;
  /**
   * Evaluate a function in the page context. Used by the settle gate to
   * install/read a MutationObserver for DOM-idle detection. Absent in
   * lightweight mocks (settle falls back to the visual signal only).
   */
  evaluate?<T>(fn: () => T | Promise<T>): Promise<T>;
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
  /**
   * Optional auto-polling visibility gate. Unlike `isVisible` (which reports
   * the *current* state), `waitFor({ state: "visible" })` blocks until the
   * element is visible or the timeout elapses — the right primitive for SPA
   * views that mount a frame after navigation. Absent in lightweight mocks.
   */
  waitFor?(state: { state: "visible"; timeout?: number }): Promise<unknown>;
};

export type PlaywrightBindings = {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<BrowserLike>;
  };
};
