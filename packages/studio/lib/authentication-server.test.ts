import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticationOperationTestHarness as harness,
  cancelStudioAuthenticationLogin,
  completeStudioAuthenticationLogin,
  subscribeStudioAuthenticationLogin,
} from "./authentication-server";

const profile = {
  id: "auth_01arz3ndektsv4rrffq69g5fav",
  name: "Admin",
  origin: "https://app.example",
  strategy: { type: "interactive" as const },
  status: "authenticated" as const,
  validation: { url: "https://app.example/dashboard" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const failure = {
  code: "AUTH_OPERATION_FAILED" as const,
  message: "Login failed.",
  actionRequired: "retry" as const,
  stage: "interactive-login",
};

afterEach(() => {
  harness.clear();
  vi.useRealTimers();
});

describe("Studio interactive operation registry", () => {
  it("replays completion that happened before subscription", () => {
    const id = harness.create();
    harness.complete(id, profile);
    const events: unknown[] = [];
    subscribeStudioAuthenticationLogin(id, (event) => events.push(event));
    expect(events).toEqual([
      expect.objectContaining({ type: "phase" }),
      expect.objectContaining({ type: "complete", profile }),
    ]);
    expect(() => completeStudioAuthenticationLogin(id)).toThrow(
      /already been completed/,
    );
    expect(() => cancelStudioAuthenticationLogin(id)).toThrow(
      /already been completed/,
    );
  });

  it("replays failure and expires terminal operations after the TTL", () => {
    vi.useFakeTimers();
    const id = harness.create();
    harness.fail(id, failure);
    const events: unknown[] = [];
    subscribeStudioAuthenticationLogin(id, (event) => events.push(event));
    expect(events.at(-1)).toEqual({ type: "error", error: failure });
    vi.advanceTimersByTime(60_001);
    expect(harness.has(id)).toBe(false);
  });

  it("removes disconnected listeners without affecting later subscribers", () => {
    const id = harness.create();
    const first = vi.fn();
    const unsubscribe = subscribeStudioAuthenticationLogin(id, first);
    unsubscribe();
    harness.complete(id, profile);
    expect(first).toHaveBeenCalledTimes(1);
    const second = vi.fn();
    subscribeStudioAuthenticationLogin(id, second);
    expect(second).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "complete" }),
    );
  });
});
