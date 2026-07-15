import { describe, expect, it } from "vitest";
import {
  assertCaptureCompatibility,
  compareCaptureCompatibility,
} from "./identity";

describe("capture identity", () => {
  it("distinguishes compatible, incompatible, and legacy identities", () => {
    expect(
      compareCaptureCompatibility(
        { demoId: "demo", captureHash: "capture-v1:sha256:same" },
        { demoId: "demo", captureHash: "capture-v1:sha256:same" },
      ),
    ).toBe("compatible");
    expect(
      compareCaptureCompatibility(
        { demoId: "demo", captureHash: "capture-v1:sha256:a" },
        { demoId: "demo", captureHash: "capture-v1:sha256:b" },
      ),
    ).toBe("incompatible");
    expect(
      compareCaptureCompatibility(
        { demoId: "demo", captureHash: "capture-v1:sha256:a" },
        { demoId: "demo" },
      ),
    ).toBe("unknown");
  });

  it("rejects demo and capture mismatches but accepts legacy artifacts", () => {
    expect(() =>
      assertCaptureCompatibility(
        { demoId: "first", captureHash: "same" },
        { demoId: "second", captureHash: "same" },
      ),
    ).toThrow("Demo artifact mismatch");
    expect(() =>
      assertCaptureCompatibility(
        { demoId: "demo", captureHash: "first" },
        { demoId: "demo", captureHash: "second" },
      ),
    ).toThrow("Capture artifact mismatch");
    expect(() =>
      assertCaptureCompatibility(
        { demoId: "demo", captureHash: "current" },
        { demoId: "demo" },
      ),
    ).not.toThrow();
  });

  it("requires matching environment hashes when either side knows the environment", () => {
    const base = { demoId: "demo", captureHash: "same" };
    expect(
      compareCaptureCompatibility(
        { ...base, captureEnvironmentHash: "environment-a" },
        base,
      ),
    ).toBe("unknown");
    expect(
      compareCaptureCompatibility(
        { ...base, captureEnvironmentHash: "environment-a" },
        { ...base, captureEnvironmentHash: "environment-b" },
      ),
    ).toBe("incompatible");
    expect(
      compareCaptureCompatibility(
        { ...base, captureEnvironmentHash: "environment-a" },
        { ...base, captureEnvironmentHash: "environment-a" },
      ),
    ).toBe("compatible");
  });
});
