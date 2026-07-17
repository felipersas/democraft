import type { AuthenticationProfile } from "./domain";
import { AuthenticationError, sanitizeUrl } from "./errors";
import type {
  AuthenticationRepository,
  AuthenticationStateResolver,
  AuthenticationValidationBrowser,
  InteractiveAuthenticationBrowser,
  InteractiveAuthenticationPhase,
} from "./ports";
import { validateAuthenticationState } from "./validation";

export type InteractiveAuthenticationRequest = {
  completion: Promise<"complete" | "cancel">;
  signal?: AbortSignal;
  timeoutMs?: number;
  onPhase?: (phase: InteractiveAuthenticationPhase) => void;
};

export type InteractiveAuthenticationResult = {
  profile: AuthenticationProfile;
  reliability: "explicit" | "less-reliable";
  finalUrl: string;
};

export class InteractiveAuthenticationService {
  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly states: AuthenticationStateResolver,
    private readonly interactiveBrowser: InteractiveAuthenticationBrowser,
    private readonly validationBrowser: AuthenticationValidationBrowser,
    private readonly options: {
      timeoutMs?: number;
      validationTimeoutMs?: number;
      isCi?: boolean;
    } = {},
  ) {}

  login(
    profileId: string,
    request: InteractiveAuthenticationRequest,
  ): Promise<InteractiveAuthenticationResult> {
    return this.authenticate(profileId, request);
  }

  renew(
    profileId: string,
    request: InteractiveAuthenticationRequest,
  ): Promise<InteractiveAuthenticationResult> {
    return this.authenticate(profileId, request);
  }

  private async authenticate(
    profileId: string,
    request: InteractiveAuthenticationRequest,
  ): Promise<InteractiveAuthenticationResult> {
    if (this.options.isCi ?? Boolean(process.env.CI)) {
      throw new AuthenticationError(
        "AUTH_UNAVAILABLE_IN_CI",
        "Interactive authentication is unavailable in CI.",
        { profileId, stage: "availability" },
      );
    }
    const timeoutMs = clamp(
      request.timeoutMs ?? this.options.timeoutMs ?? 5 * 60_000,
      1_000,
      30 * 60_000,
    );
    let validation:
      Awaited<ReturnType<typeof validateAuthenticationState>> | undefined;
    const profile = await this.repository.authenticate(
      profileId,
      async (attempt) => {
        const initialState = attempt.previousState
          ? await this.states.resolve(attempt.previousState)
          : undefined;
        let state;
        try {
          state = await this.interactiveBrowser.capture({
            url: attempt.profile.origin,
            ...(initialState ? { initialState } : {}),
            completion: request.completion,
            timeoutMs,
            ...(request.signal ? { signal: request.signal } : {}),
            ...(request.onPhase ? { onPhase: request.onPhase } : {}),
          });
        } catch (error) {
          if (
            isInteractiveStop(error, "cancelled") ||
            isInteractiveStop(error, "aborted")
          ) {
            throw new AuthenticationError(
              "AUTH_OPERATION_FAILED",
              "Interactive authentication was cancelled.",
              { profileId, stage: "cancellation" },
            );
          }
          if (isInteractiveStop(error, "timeout")) {
            throw new AuthenticationError(
              "AUTH_OPERATION_FAILED",
              "Interactive authentication timed out.",
              { profileId, stage: "timeout" },
            );
          }
          throw new AuthenticationError(
            "AUTH_OPERATION_FAILED",
            `Could not complete interactive authentication for profile ${profileId}.`,
            { profileId, stage: "interactive-login" },
          );
        }
        request.onPhase?.("validating-session");
        validation = await validateAuthenticationState(
          attempt.profile,
          state,
          this.validationBrowser,
          this.options.validationTimeoutMs,
        );
        request.onPhase?.("saving-profile");
        return state;
      },
    );
    if (!validation) {
      throw new AuthenticationError(
        "AUTH_OPERATION_FAILED",
        "Authentication did not produce a validation result.",
        { profileId, stage: "validation" },
      );
    }
    return {
      profile,
      reliability: validation.reliability,
      finalUrl: sanitizeUrl(validation.finalUrl) ?? profile.origin,
    };
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isInteractiveStop(
  error: unknown,
  reason: "cancelled" | "aborted" | "timeout",
): boolean {
  return (
    error instanceof Error &&
    error.name === "InteractiveAuthenticationCancelledError" &&
    "reason" in error &&
    (error as { reason?: unknown }).reason === reason
  );
}
