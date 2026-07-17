import type { AuthenticationProfile, StoredBrowserState } from "./domain";
import { AuthenticationError, sanitizeUrl } from "./errors";
import type {
  AuthenticationRepository,
  AuthenticationStateResolver,
  AuthenticationValidationBrowser,
} from "./ports";
import { resolveValidationUrl, validateSelector } from "./urls";

export type ValidateProfileResult = {
  profile: AuthenticationProfile;
  finalUrl: string;
  reliability: "explicit" | "less-reliable";
};
export type AuthenticationStateValidationResult = Omit<
  ValidateProfileResult,
  "profile"
>;

export class AuthenticationValidationService {
  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly states: AuthenticationStateResolver,
    private readonly browser: AuthenticationValidationBrowser,
    private readonly timeoutMs = 10_000,
  ) {}

  async validate(profileId: string): Promise<ValidateProfileResult> {
    const loaded = await this.repository.load(profileId);
    const state = await this.states.resolve(loaded.state);
    let result: AuthenticationStateValidationResult;
    try {
      result = await validateAuthenticationStateBytes(
        loaded.profile,
        state,
        this.browser,
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        if (error.public.code === "AUTH_SESSION_EXPIRED")
          await this.repository.markValidation(
            profileId,
            "expired",
            undefined,
            error.public.code,
          );
        else
          await this.repository.recordValidationFailure(
            profileId,
            error.public.code,
          );
        throw error;
      }
      await this.repository.recordValidationFailure(
        profileId,
        "AUTH_VALIDATION_FAILED",
      );
      throw new AuthenticationError(
        "AUTH_VALIDATION_FAILED",
        `Could not validate authentication profile ${profileId}.`,
        { profileId, status: loaded.profile.status, stage: "validation" },
      );
    }
    const profile = await this.repository.markValidation(
      profileId,
      "authenticated",
    );
    return {
      profile,
      finalUrl: sanitizeUrl(result.finalUrl) ?? loaded.profile.origin,
      reliability: result.reliability,
    };
  }
}

export async function validateAuthenticationState(
  profile: AuthenticationProfile,
  state: StoredBrowserState,
  browser: AuthenticationValidationBrowser,
  timeoutMs = 10_000,
): Promise<AuthenticationStateValidationResult> {
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, data: state }));
  return validateAuthenticationStateBytes(profile, bytes, browser, timeoutMs);
}

export async function validateAuthenticationStateBytes(
  profile: AuthenticationProfile,
  state: Uint8Array,
  browser: AuthenticationValidationBrowser,
  timeoutMs: number,
): Promise<AuthenticationStateValidationResult> {
  const timeout = Math.min(60_000, Math.max(1_000, timeoutMs));
  let finalUrl = profile.validation.url;
  try {
    await browser.withState(state, async (page) => {
      const target = resolveValidationUrl(
        profile.origin,
        profile.validation.url,
      );
      await page.goto(target, { timeout });
      finalUrl = page.url();
      assertFinalUrl(finalUrl, profile.id, profile.status);
      if (isLoginLike(finalUrl, profile.validation.expect)) {
        throw new AuthenticationError(
          "AUTH_SESSION_EXPIRED",
          `The session for profile ${profile.id} expired.`,
          {
            profileId: profile.id,
            status: "expired",
            stage: "validation",
            sanitizedUrl: sanitizeUrl(finalUrl),
          },
        );
      }
      const expect = profile.validation.expect;
      if (expect && "selector" in expect) {
        const selector = validateSelector(expect.selector);
        try {
          await page.waitForVisible(selector, timeout);
        } catch {
          throw new AuthenticationError(
            "AUTH_VALIDATION_FAILED",
            `The validation criterion for profile ${profile.id} was not satisfied.`,
            {
              profileId: profile.id,
              status: profile.status,
              stage: "validation",
              sanitizedUrl: sanitizeUrl(finalUrl),
              criterion: "expected-visible-selector",
            },
          );
        }
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError(
      "AUTH_VALIDATION_FAILED",
      `Could not validate authentication profile ${profile.id}.`,
      {
        profileId: profile.id,
        status: profile.status,
        stage: "validation",
        sanitizedUrl: sanitizeUrl(finalUrl),
      },
    );
  }
  return {
    finalUrl,
    reliability: profile.validation.expect ? "explicit" : "less-reliable",
  };
}

function assertFinalUrl(
  finalUrl: string,
  profileId: string,
  status: AuthenticationProfile["status"],
): void {
  let url: URL;
  try {
    url = new URL(finalUrl);
  } catch {
    throw new AuthenticationError(
      "AUTH_VALIDATION_FAILED",
      `Authentication profile ${profileId} returned an invalid document URL.`,
      { profileId, status, stage: "validation" },
    );
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname)
    throw new AuthenticationError(
      "AUTH_VALIDATION_FAILED",
      `Authentication profile ${profileId} returned an invalid document URL.`,
      { profileId, status, stage: "validation" },
    );
}

function isLoginLike(
  finalUrl: string,
  expect: AuthenticationProfile["validation"]["expect"],
): boolean {
  let url: URL;
  try {
    url = new URL(finalUrl);
  } catch {
    return false;
  }
  if (expect && "urlNotMatching" in expect) {
    try {
      return new RegExp(expect.urlNotMatching, "i").test(finalUrl);
    } catch {
      throw new AuthenticationError(
        "AUTH_VALIDATION_FAILED",
        "The configured login URL pattern is malformed.",
        { stage: "configuration", criterion: "url-not-matching" },
      );
    }
  }
  return /\/(?:login|signin|auth)(?:\/|$)/i.test(url.pathname);
}
