export type CaptureIdentity = {
  demoId: string;
  captureHash?: string;
  captureEnvironmentHash?: string;
};

export type CaptureCompatibility = "compatible" | "incompatible" | "unknown";

export function compareCaptureCompatibility(
  current: CaptureIdentity,
  captured: CaptureIdentity,
): CaptureCompatibility {
  if (current.demoId !== captured.demoId) return "incompatible";
  if (!current.captureHash || !captured.captureHash) return "unknown";
  if (current.captureHash !== captured.captureHash) return "incompatible";
  if (
    Boolean(current.captureEnvironmentHash) !==
    Boolean(captured.captureEnvironmentHash)
  ) {
    return "unknown";
  }
  if (
    current.captureEnvironmentHash &&
    current.captureEnvironmentHash !== captured.captureEnvironmentHash
  ) {
    return "incompatible";
  }
  return "compatible";
}

/**
 * Rejects known-incompatible artifacts while allowing legacy artifacts whose
 * capture compatibility cannot be established.
 */
export function assertCaptureCompatibility(
  current: CaptureIdentity,
  captured: CaptureIdentity,
): void {
  if (current.demoId !== captured.demoId) {
    throw new Error(
      `Demo artifact mismatch: "${current.demoId}" does not match "${captured.demoId}".`,
    );
  }
  if (
    current.captureHash &&
    captured.captureHash &&
    current.captureHash !== captured.captureHash
  ) {
    throw new Error(
      `Capture artifact mismatch for demo "${current.demoId}": screenshots must be captured again.`,
    );
  }
  if (
    current.captureEnvironmentHash &&
    captured.captureEnvironmentHash &&
    current.captureEnvironmentHash !== captured.captureEnvironmentHash
  ) {
    throw new Error(
      `Capture environment mismatch for demo "${current.demoId}": screenshots must be captured again.`,
    );
  }
}
