import { describe, expect, it, vi } from "vitest";
import {
  createInteractiveAuthenticationBrowser,
  InteractiveAuthenticationCancelledError,
} from "./authentication-interactive";
import type { PlaywrightBindings } from "./types";

function fixture(
  state = { cookies: [{ name: "session", value: "secret" }], origins: [] },
) {
  const contextClose = vi.fn(async () => undefined);
  const browserClose = vi.fn(async () => undefined);
  const goto = vi.fn(async () => undefined);
  const storageState = vi.fn(async () => state);
  const newContext = vi.fn(async () => ({
    close: contextClose,
    storageState,
    newPage: async () => ({
      goto,
      url: () => "https://app.test/",
      locator: () => {
        throw new Error("unused");
      },
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
  const launch = vi.fn(async () => ({ close: browserClose, newContext }));
  return {
    adapter: createInteractiveAuthenticationBrowser({
      chromium: { launch },
    } satisfies PlaywrightBindings),
    browserClose,
    contextClose,
    goto,
    launch,
    newContext,
    storageState,
  };
}

describe("createInteractiveAuthenticationBrowser", () => {
  it("opens headed Chromium, waits for trusted completion, captures state, and tears down", async () => {
    const value = fixture();
    const phases: string[] = [];
    const result = await value.adapter.capture({
      url: "https://app.test/",
      completion: Promise.resolve("complete"),
      timeoutMs: 2_000,
      onPhase: (phase) => phases.push(phase),
    });
    expect(result.cookies).toEqual([{ name: "session", value: "secret" }]);
    expect(value.launch).toHaveBeenCalledWith({ headless: false });
    expect(value.goto).toHaveBeenCalledWith("https://app.test/", {
      timeout: 2_000,
    });
    expect(phases).toEqual([
      "opening-browser",
      "waiting-for-login",
      "capturing-state",
    ]);
    expect(value.contextClose).toHaveBeenCalledOnce();
    expect(value.browserClose).toHaveBeenCalledOnce();
  });

  it("restores renewal state without exposing it and closes on explicit cancel", async () => {
    const value = fixture();
    const prior = {
      cookies: [{ name: "old", value: "prior-secret" }],
      origins: [],
    };
    await expect(
      value.adapter.capture({
        url: "https://app.test/",
        initialState: Buffer.from(
          JSON.stringify({ schemaVersion: 1, data: prior }),
        ),
        completion: Promise.resolve("cancel"),
        timeoutMs: 2_000,
      }),
    ).rejects.toEqual(new InteractiveAuthenticationCancelledError("cancelled"));
    expect(value.newContext).toHaveBeenCalledWith({ storageState: prior });
    expect(value.storageState).not.toHaveBeenCalled();
    expect(value.contextClose).toHaveBeenCalledOnce();
    expect(value.browserClose).toHaveBeenCalledOnce();
  });

  it("supports abort and timeout with deterministic cleanup", async () => {
    for (const mode of ["abort", "timeout"] as const) {
      const value = fixture();
      const controller = new AbortController();
      if (mode === "abort") controller.abort();
      await expect(
        value.adapter.capture({
          url: "https://app.test/",
          completion: new Promise(() => undefined),
          timeoutMs: mode === "timeout" ? 1 : 2_000,
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({
        name: "InteractiveAuthenticationCancelledError",
        reason: mode === "abort" ? "aborted" : "timeout",
      });
      expect(value.contextClose).toHaveBeenCalledOnce();
      expect(value.browserClose).toHaveBeenCalledOnce();
    }
  });

  it("closes the browser if context creation fails", async () => {
    const browserClose = vi.fn(async () => undefined);
    const adapter = createInteractiveAuthenticationBrowser({
      chromium: {
        launch: async () => ({
          close: browserClose,
          newContext: async () => {
            throw new Error("context failed");
          },
        }),
      },
    } satisfies PlaywrightBindings);
    await expect(
      adapter.capture({
        url: "https://app.test",
        completion: Promise.resolve("complete"),
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow("context failed");
    expect(browserClose).toHaveBeenCalledOnce();
  });
});
