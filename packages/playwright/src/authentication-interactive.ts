import type { PlaywrightBindings } from "./types";

export class InteractiveAuthenticationCancelledError extends Error {
  constructor(readonly reason: "cancelled" | "aborted" | "timeout") {
    super(`Interactive authentication ${reason}.`);
    this.name = "InteractiveAuthenticationCancelledError";
  }
}

export type InteractiveAuthenticationBrowserAdapter = {
  capture(options: {
    url: string;
    initialState?: Uint8Array;
    completion: Promise<"complete" | "cancel">;
    timeoutMs: number;
    signal?: AbortSignal;
    onPhase?: (
      phase: "opening-browser" | "waiting-for-login" | "capturing-state",
    ) => void;
  }): Promise<{ cookies: unknown[]; origins: unknown[] }>;
};

export function createInteractiveAuthenticationBrowser(
  bindings: PlaywrightBindings,
): InteractiveAuthenticationBrowserAdapter {
  return {
    async capture(options) {
      options.onPhase?.("opening-browser");
      const browser = await bindings.chromium.launch({ headless: false });
      let context;
      try {
        const storageState = options.initialState
          ? parseState(options.initialState)
          : undefined;
        context = await browser.newContext(
          storageState ? { storageState } : undefined,
        );
        const page = await context.newPage();
        await page.goto(options.url, {
          timeout: Math.min(options.timeoutMs, 60_000),
        });
        options.onPhase?.("waiting-for-login");
        const outcome = await waitForCompletion(
          options.completion,
          options.timeoutMs,
          options.signal,
        );
        if (outcome === "cancel")
          throw new InteractiveAuthenticationCancelledError("cancelled");
        options.onPhase?.("capturing-state");
        if (!context.storageState)
          throw new Error(
            "Browser binding does not support storage state capture.",
          );
        const state = await context.storageState();
        if (
          !state ||
          !Array.isArray(state.cookies) ||
          !Array.isArray(state.origins)
        ) {
          throw new Error("Browser returned malformed storage state.");
        }
        return state;
      } finally {
        await context?.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
      }
    },
  };
}

function parseState(bytes: Uint8Array): {
  cookies: unknown[];
  origins: unknown[];
} {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as {
    schemaVersion?: unknown;
    data?: { cookies?: unknown; origins?: unknown };
  };
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.data?.cookies) ||
    !Array.isArray(value.data.origins)
  ) {
    throw new Error("Malformed authentication state envelope.");
  }
  return { cookies: value.data.cookies, origins: value.data.origins };
}

function waitForCompletion(
  completion: Promise<"complete" | "cancel">,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<"complete" | "cancel"> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      operation();
    };
    const onAbort = () =>
      finish(() =>
        reject(new InteractiveAuthenticationCancelledError("aborted")),
      );
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(new InteractiveAuthenticationCancelledError("timeout")),
        ),
      timeoutMs,
    );
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    completion.then(
      (result) => finish(() => resolve(result)),
      () =>
        finish(() =>
          reject(new Error("Interactive completion signal failed.")),
        ),
    );
  });
}
