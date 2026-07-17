import type { AuthenticationProfile } from "./domain";
import { AuthenticationError } from "./errors";
import type {
  AuthenticationRepository,
  AuthenticationStateResolver,
  AuthenticationValidationBrowser,
} from "./ports";
import { validateAuthenticationStateBytes } from "./validation";

export type PreparedAuthenticatedExecution = {
  readonly profile: AuthenticationProfile;
  readonly state: Uint8Array;
  readonly stateSha256: string;
};

/** Resolves and validates one immutable state generation for a capture. */
export class AuthenticationExecutionService {
  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly states: AuthenticationStateResolver,
    private readonly browser: AuthenticationValidationBrowser,
    private readonly timeoutMs = 10_000,
  ) {}

  async prepare(profileId: string): Promise<PreparedAuthenticatedExecution> {
    const loaded = await this.repository.load(profileId);
    if (loaded.profile.status === "not-configured") {
      throw new AuthenticationError(
        "AUTH_LOGIN_REQUIRED",
        `Authentication profile ${profileId} requires interactive login.`,
        {
          profileId,
          status: loaded.profile.status,
          stage: "capture-preflight",
        },
      );
    }
    const state = await this.states.resolve(loaded.state);
    try {
      await validateAuthenticationStateBytes(
        loaded.profile,
        state,
        this.browser,
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        if (error.public.code === "AUTH_SESSION_EXPIRED") {
          await this.repository.markValidation(
            profileId,
            "expired",
            undefined,
            error.public.code,
          );
        } else {
          await this.repository.recordValidationFailure(
            profileId,
            error.public.code,
          );
        }
      }
      throw error;
    }
    const profile = await this.repository.markValidation(
      profileId,
      "authenticated",
    );
    return { profile, state, stateSha256: loaded.state.stateSha256 };
  }
}
