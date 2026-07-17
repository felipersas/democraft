import { describe, expect, it, vi } from "vitest";
import { createAuthenticationValidationBrowser } from "./authentication-validation";
import type { PlaywrightBindings } from "./types";

describe("createAuthenticationValidationBrowser", () => {
  it("restores the state in an isolated context and closes all resources", async () => {
    const waitFor = vi.fn(async () => undefined);
    const contextClose = vi.fn(async () => undefined);
    const browserClose = vi.fn(async () => undefined);
    const newContext = vi.fn(async () => ({
      close: contextClose,
      newPage: async () => ({
        goto: vi.fn(async () => undefined),
        url: () => "https://app.test/private",
        locator: () => ({
          waitFor,
          click: async () => undefined,
          fill: async () => undefined,
          selectOption: async () => undefined,
          boundingBox: async () => null,
          isVisible: async () => true,
          textContent: async () => null,
        }),
        getByRole: () => {
          throw new Error("unused");
        },
        getByLabel: () => {
          throw new Error("unused");
        },
        getByTestId: () => {
          throw new Error("unused");
        },
        getByText: () => {
          throw new Error("unused");
        },
      }),
    }));
    const bindings = {
      chromium: { launch: async () => ({ close: browserClose, newContext }) },
    } satisfies PlaywrightBindings;
    const adapter = createAuthenticationValidationBrowser(bindings);
    const state = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        data: { cookies: [{ value: "secret" }], origins: [] },
      }),
    );
    const result = await adapter.withState(state, async (page) => {
      await page.goto("https://app.test/private", { timeout: 1234 });
      await page.waitForVisible("#user", 1234);
      return page.url();
    });
    expect(result).toBe("https://app.test/private");
    expect(newContext).toHaveBeenCalledWith({
      storageState: { cookies: [{ value: "secret" }], origins: [] },
    });
    expect(waitFor).toHaveBeenCalledWith({ state: "visible", timeout: 1234 });
    expect(contextClose).toHaveBeenCalledOnce();
    expect(browserClose).toHaveBeenCalledOnce();
  });

  it("closes context and browser when page creation fails", async () => {
    const contextClose = vi.fn(async () => undefined);
    const browserClose = vi.fn(async () => undefined);
    const bindings = {
      chromium: {
        launch: async () => ({
          close: browserClose,
          newContext: async () => ({
            close: contextClose,
            newPage: async () => {
              throw new Error("page failed");
            },
          }),
        }),
      },
    } satisfies PlaywrightBindings;
    const adapter = createAuthenticationValidationBrowser(bindings);
    await expect(
      adapter.withState(
        Buffer.from(
          JSON.stringify({
            schemaVersion: 1,
            data: { cookies: [], origins: [] },
          }),
        ),
        async () => undefined,
      ),
    ).rejects.toThrow("page failed");
    expect(contextClose).toHaveBeenCalledOnce();
    expect(browserClose).toHaveBeenCalledOnce();
  });
});
