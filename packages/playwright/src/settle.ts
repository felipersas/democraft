import type { PageLike, SettleStrategy } from "./types";

/**
 * Best-effort gate that waits for a page to settle before a screenshot.
 *
 * Modern web apps load in waves: HTML → hydration → data fetches → secondary
 * renders → animations. A screenshot taken the instant an action returns often
 * lands in a gap between waves — the DOM is momentarily quiet but a fetch is
 * in flight and will repaint a moment later. Waiting a fixed duration can't
 * adapt to this (too short mid-load, dead air when idle).
 *
 * Instead this gate waits for the page to be **actually** done by combining
 * three signals, each measuring a different kind of in-flight work:
 *
 * - `"dom"` — a `MutationObserver` counts DOM mutations; quiet when none occur
 *   for `idleWindowMs`. Catches structural rendering.
 * - `"visual"` — periodic low-res screenshots are hashed; quiet when two
 *   consecutive samples match. Catches pure-visual motion (fade-ins, CSS
 *   animations) that never touches the DOM.
 * - `"network"` — in-flight `fetch`/`XHR` requests are counted via injected
 *   wrappers; quiet when zero are active for `idleWindowMs`. **Critical** for
 *   the fetch-gap case: after a route change the skeleton renders (DOM quiet)
 *   while a data request is still pending — only the network signal reveals
 *   the page isn't done.
 *
 * `"both"` (default) runs all three; the page is settled only when every
 * active signal agrees it has been quiet. Never throws: if the page never
 * quiets, resolves at `timeoutMs` and captures anyway (best-effort), so a
 * pathological page (infinite animation, endless polling UI) can't stall
 * capture.
 *
 * Why not Playwright's `networkidle`? It waits for 500ms of zero network
 * connections and is officially discouraged — flaky with long-polling,
 * analytics, and SSE that keep connections alive even when fully rendered.
 * Counting `fetch`/`XHR` *calls* (not open connections) is precise for the
 * "is the app still fetching data?" question this gate needs to answer.
 */
export async function waitForSettled(
  page: PageLike,
  strategy: Required<SettleStrategy>,
): Promise<void> {
  const deadline = Date.now() + strategy.timeoutMs;

  const needDom = strategy.signal === "dom" || strategy.signal === "both";
  const needVisual = strategy.signal === "visual" || strategy.signal === "both";
  const needNetwork =
    strategy.signal === "network" || strategy.signal === "both";

  // Install the in-page monitors (DOM mutation counter + network activity
  // counter). Both are best-effort: if the page can't run evaluate (mock),
  // the gate falls back to whichever signals are available.
  const monitors = await installMonitors(page, {
    dom: needDom,
    network: needNetwork,
  });

  // Track the last time each signal observed activity. A signal is "quiet" when
  // idleWindowMs has elapsed since its last activity. Initialize to now so a
  // clean window is required from the start (don't assume quiet on entry).
  const quietSinceBySignal: Record<string, number> = {};
  const initSignal = (name: string) => {
    quietSinceBySignal[name] = Date.now();
  };
  if (needDom && monitors.dom) initSignal("dom");
  if (needVisual) initSignal("visual");
  if (needNetwork && monitors.network) initSignal("network");

  let lastVisualSignature: string | undefined;

  while (Date.now() < deadline) {
    const now = Date.now();

    if (monitors.dom) {
      // Each page call is guarded so a hung evaluate can't stall the whole
      // gate — it just yields no data for this sample.
      const mutations = await withFallback(readDomMutations(page), 0);
      if (mutations > 0) quietSinceBySignal["dom"] = Date.now();
    }

    if (needVisual) {
      const signature = await withFallback(visualSignature(page), undefined);
      if (signature !== undefined && signature !== lastVisualSignature) {
        lastVisualSignature = signature;
        quietSinceBySignal["visual"] = Date.now();
      }
    }

    if (monitors.network) {
      const active = await withFallback(readNetworkActivity(page), 0);
      if (active > 0) quietSinceBySignal["network"] = Date.now();
    }

    // Settled only when every active signal has been quiet past its window.
    const signals: boolean[] = [];
    if (needDom && monitors.dom) {
      signals.push(now - quietSinceBySignal["dom"] >= strategy.idleWindowMs);
    }
    if (needVisual) {
      signals.push(now - quietSinceBySignal["visual"] >= strategy.idleWindowMs);
    }
    if (needNetwork && monitors.network) {
      signals.push(
        now - quietSinceBySignal["network"] >= strategy.idleWindowMs,
      );
    }
    if (signals.length > 0 && signals.every(Boolean)) return;

    await sleep(Math.max(50, strategy.idleWindowMs / 2));
  }
  // Timed out — best effort, capture anyway (never throw).
}

/**
 * Race a page operation against a short timeout. Resolves to `fallback` if the
 * operation doesn't settle in time — this is the defense against a hung
 * `page.evaluate`/`page.screenshot` (e.g. page navigating mid-sample) freezing
 * the settle gate. The sample is simply skipped; the next loop iteration tries
 * again until the overall `timeoutMs` deadline.
 */
async function withFallback<T>(
  promise: Promise<T>,
  fallback: T,
  perCallMs = 2000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), perCallMs);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type InstalledMonitors = {
  dom: boolean;
  network: boolean;
};

/**
 * Inject the DOM mutation counter and/or the network activity counter into the
 * page. Idempotent: re-installing resets the counters. Returns which monitors
 * were actually installed (false when the page can't run `evaluate`).
 */
async function installMonitors(
  page: PageLike,
  need: { dom: boolean; network: boolean },
): Promise<InstalledMonitors> {
  if (!page.evaluate) return { dom: false, network: false };
  try {
    // Guard the install: if the page is mid-navigation and evaluate hangs, give
    // up rather than freeze the gate (falls back to visual-only settling).
    await withFallback(
      page.evaluate(() => {
        const w = window as unknown as {
          __democraftMutations?: number;
          __democraftObserver?: MutationObserver;
          __democraftFetchActive?: number;
          __democraftInstrumented?: boolean;
        };

        // --- DOM mutation counter ---
        w.__democraftMutations = 0;
        w.__democraftObserver?.disconnect();
        const observer = new MutationObserver(() => {
          w.__democraftMutations = (w.__democraftMutations ?? 0) + 1;
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
        w.__democraftObserver = observer;

        // --- Network activity counter (fetch + XHR) ---
        // Count in-flight requests so the settle gate can see a pending data
        // fetch even when the DOM is momentarily quiet. Instrument once per page.
        if (!w.__democraftInstrumented) {
          w.__democraftFetchActive = 0;
          const originalFetch = window.fetch;
          window.fetch = function democraftFetch(
            ...args: Parameters<typeof fetch>
          ) {
            w.__democraftFetchActive = (w.__democraftFetchActive ?? 0) + 1;
            return originalFetch.apply(this, args).finally(() => {
              w.__democraftFetchActive = Math.max(
                0,
                (w.__democraftFetchActive ?? 0) - 1,
              );
            });
          };

          const originalOpen = XMLHttpRequest.prototype.open;
          const originalSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open = function democraftXhrOpen(
            ...args: unknown[]
          ) {
            this.addEventListener("loadend", () => {
              w.__democraftFetchActive = Math.max(
                0,
                (w.__democraftFetchActive ?? 0) - 1,
              );
            });
            return originalOpen.apply(this, args as never);
          };
          XMLHttpRequest.prototype.send = function democraftXhrSend(
            ...args: unknown[]
          ) {
            w.__democraftFetchActive = (w.__democraftFetchActive ?? 0) + 1;
            return originalSend.apply(this, args as never);
          };
          w.__democraftInstrumented = true;
        } else {
          w.__democraftFetchActive = 0;
        }
      }),
      undefined,
    );
    return { dom: need.dom, network: need.network };
  } catch {
    return { dom: false, network: false };
  }
}

/**
 * Read and reset the DOM mutation counter. Returns mutations since last read.
 */
async function readDomMutations(page: PageLike): Promise<number> {
  return page.evaluate!(() => {
    const w = window as unknown as { __democraftMutations?: number };
    const count = w.__democraftMutations ?? 0;
    w.__democraftMutations = 0;
    return count;
  });
}

/**
 * Read the current number of in-flight network requests (fetch + XHR).
 */
async function readNetworkActivity(page: PageLike): Promise<number> {
  return page.evaluate!(() => {
    const w = window as unknown as { __democraftFetchActive?: number };
    return w.__democraftFetchActive ?? 0;
  });
}

/**
 * Cheap signature of the current visual frame for change detection: a low-res
 * screenshot hashed with FNV-1a. Two equal signatures ⇒ no visual change. We
 * don't need cryptographic strength — just a stable equality check that's fast
 * enough to sample several times per settle window. Returns `undefined` when
 * the page can't screenshot (mock).
 */
async function visualSignature(page: PageLike): Promise<string | undefined> {
  if (!page.screenshot) return undefined;
  try {
    const png = await page.screenshot({ type: "png" });
    return hashBuffer(png);
  } catch {
    return undefined;
  }
}

function hashBuffer(buf: Buffer): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < buf.length; i += 1) {
    hash ^= buf[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
