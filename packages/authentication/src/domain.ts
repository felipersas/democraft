export const authenticationStatuses = [
  "not-configured",
  "authenticating",
  "authenticated",
  "expired",
  "invalid",
  "error",
] as const;

export type AuthenticationStatus = (typeof authenticationStatuses)[number];
export type AuthenticationStrategy = { type: "interactive" };
export type AuthenticationValidation = {
  url: string;
  expect?: { selector: string; state?: "visible" } | { urlNotMatching: string };
};

export type AuthenticationProfile = {
  id: string;
  name: string;
  origin: string;
  strategy: AuthenticationStrategy;
  status: AuthenticationStatus;
  validation: AuthenticationValidation;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
};

export type AuthenticationProfileDto = AuthenticationProfile;
export type AuthenticationStateHandle = {
  readonly profileId: string;
  readonly revision: number;
  readonly stateSha256: string;
  readonly token: symbol;
};
export type LoadedAuthenticationProfile = {
  profile: AuthenticationProfile;
  state: AuthenticationStateHandle;
  revision: number;
};

export type StoredBrowserState = {
  cookies: unknown[];
  origins: unknown[];
};

export type AuthenticationProfileListEntry =
  | { available: true; profile: AuthenticationProfile }
  | {
      available: false;
      profileId: string;
      code: "AUTH_STATE_CORRUPT" | "AUTH_UNSUPPORTED_VERSION";
    };

export type CreateProfileInput = {
  name: string;
  origin: string;
  validation?: Partial<AuthenticationValidation>;
};

export function toProfileDto(
  profile: AuthenticationProfile,
): AuthenticationProfileDto {
  return {
    ...profile,
    strategy: { ...profile.strategy },
    validation: { ...profile.validation },
  };
}
