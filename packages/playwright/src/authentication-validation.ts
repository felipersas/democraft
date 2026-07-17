import type { PlaywrightBindings } from "./types";

type ValidationPage = {
  goto(url: string, options: { timeout: number }): Promise<void>;
  url(): string;
  waitForVisible(selector: string, timeout: number): Promise<void>;
};

export type AuthenticationValidationBrowserAdapter = {
  withState<T>(
    state: Uint8Array,
    operation: (page: ValidationPage) => Promise<T>,
  ): Promise<T>;
};

export function createAuthenticationValidationBrowser(
  bindings: PlaywrightBindings,
): AuthenticationValidationBrowserAdapter {
  return {
    async withState(state, operation) {
      const browser = await bindings.chromium.launch({ headless: true });
      let context;
      try {
        const parsed = JSON.parse(Buffer.from(state).toString("utf8")) as {
          schemaVersion?: unknown;
          data?: unknown;
        };
        if (parsed.schemaVersion !== 1 || !parsed.data) {
          throw new Error("Malformed authentication state envelope.");
        }
        context = await browser.newContext({ storageState: parsed.data });
        const page = await context.newPage();
        return await operation({
          async goto(url, options) {
            await page.goto(url, { timeout: options.timeout });
          },
          url: () => page.url(),
          async waitForVisible(selector, timeout) {
            const locator = page.locator(selector);
            if (!locator.waitFor)
              throw new Error(
                "Browser binding does not support visibility waits.",
              );
            await locator.waitFor({ state: "visible", timeout });
          },
        });
      } finally {
        await context?.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
      }
    },
  };
}
