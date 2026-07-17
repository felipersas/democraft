import type {
  AuthenticationProfile,
  AuthenticationProfileListEntry,
  AuthenticationStateHandle,
  CreateProfileInput,
  LoadedAuthenticationProfile,
  StoredBrowserState,
} from "./domain";

export interface AuthenticationRepository {
  list(): Promise<AuthenticationProfile[]>;
  listEntries(): Promise<AuthenticationProfileListEntry[]>;
  create(input: CreateProfileInput): Promise<AuthenticationProfile>;
  rename(profileId: string, name: string): Promise<AuthenticationProfile>;
  load(profileId: string): Promise<LoadedAuthenticationProfile>;
  saveState(
    profileId: string,
    state: StoredBrowserState,
  ): Promise<AuthenticationProfile>;
  remove(profileId: string, options?: { force?: boolean }): Promise<void>;
  markValidation(
    profileId: string,
    status: AuthenticationProfile["status"],
    at?: Date,
    errorCode?: string,
  ): Promise<AuthenticationProfile>;
  recordValidationFailure(
    profileId: string,
    errorCode: string,
  ): Promise<AuthenticationProfile>;
  authenticate(
    profileId: string,
    operation: (attempt: AuthenticationAttempt) => Promise<StoredBrowserState>,
  ): Promise<AuthenticationProfile>;
}

export type AuthenticationAttempt = {
  profile: AuthenticationProfile;
  previousState?: AuthenticationStateHandle;
};

export interface AuthenticationStateResolver {
  resolve(handle: AuthenticationStateHandle): Promise<Uint8Array>;
}

export interface AuthenticationValidationPage {
  goto(url: string, options: { timeout: number }): Promise<void>;
  url(): string;
  waitForVisible(selector: string, timeout: number): Promise<void>;
}

export interface AuthenticationValidationBrowser {
  withState<T>(
    state: Uint8Array,
    operation: (page: AuthenticationValidationPage) => Promise<T>,
  ): Promise<T>;
}

export type InteractiveAuthenticationPhase =
  | "opening-browser"
  | "waiting-for-login"
  | "capturing-state"
  | "validating-session"
  | "saving-profile";

export interface InteractiveAuthenticationBrowser {
  capture(options: {
    url: string;
    initialState?: Uint8Array;
    completion: Promise<"complete" | "cancel">;
    timeoutMs: number;
    signal?: AbortSignal;
    onPhase?: (phase: InteractiveAuthenticationPhase) => void;
  }): Promise<StoredBrowserState>;
}
