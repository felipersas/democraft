import {
  AuthenticationError,
  AuthenticationExecutionService,
  AuthenticationProfileRemovalService,
  AuthenticationPaths,
  AuthenticationValidationService,
  InteractiveAuthenticationService,
  LocalAuthenticationRepository,
  redact,
  toProfileDto,
  type AuthenticationProfile,
  type AuthenticationUsage,
  type CreateProfileInput,
  type PublicAuthenticationError,
} from "@democraft/authentication";
import {
  createAuthenticationValidationBrowser,
  createInteractiveAuthenticationBrowser,
  defaultBindings,
} from "@democraft/playwright";
import { compileDemoModuleIsolated } from "./compile-demo-isolated";
import { trustedDemoPath, trustedWorkspaceRoot } from "./studio-path-authority";

export type StudioAuthenticationProfile = AuthenticationProfile & {
  usage: AuthenticationUsage[];
};

type LoginOperation = {
  profileId: string;
  phase: string;
  startedAt: string;
  completion: (result: "complete" | "cancel") => void;
  abort: AbortController;
  listeners: Set<(event: LoginEvent) => void>;
  settled: boolean;
  signaled: boolean;
  terminal?: Extract<LoginEvent, { type: "complete" | "error" }>;
  deletionTimer?: ReturnType<typeof setTimeout>;
};

export type LoginEvent =
  | { type: "phase"; phase: string }
  | { type: "complete"; profile: AuthenticationProfile }
  | { type: "error"; error: PublicAuthenticationError };

const operations = new Map<string, LoginOperation>();
const TERMINAL_OPERATION_TTL_MS = 60_000;

async function composition() {
  const workspace = await trustedWorkspaceRoot();
  const paths = await AuthenticationPaths.fromWorkspace(workspace);
  const repository = new LocalAuthenticationRepository(paths);
  const validationBrowser =
    createAuthenticationValidationBrowser(defaultBindings);
  return {
    repository,
    validation: new AuthenticationValidationService(
      repository,
      repository,
      validationBrowser,
    ),
    interactive: new InteractiveAuthenticationService(
      repository,
      repository,
      createInteractiveAuthenticationBrowser(defaultBindings),
      validationBrowser,
    ),
  };
}

export async function createStudioAuthenticationExecution() {
  const { repository } = await composition();
  return new AuthenticationExecutionService(
    repository,
    repository,
    createAuthenticationValidationBrowser(defaultBindings),
  );
}

export async function listStudioAuthenticationProfiles(): Promise<
  StudioAuthenticationProfile[]
> {
  const [{ repository }, association] = await Promise.all([
    composition(),
    currentDemoAssociation(),
  ]);
  const entries = await repository.listEntries();
  return entries.map((entry) => {
    if (entry.available) {
      return {
        ...toProfileDto(entry.profile),
        usage:
          association.profileId === entry.profile.id
            ? [{ demoId: association.demoId, selected: true }]
            : [],
      };
    }
    const timestamp = new Date(0).toISOString();
    return {
      id: entry.profileId,
      name: "Unavailable profile",
      origin: "Unavailable",
      strategy: { type: "interactive" as const },
      status: "invalid" as const,
      validation: { url: "https://invalid.local" },
      createdAt: timestamp,
      updatedAt: timestamp,
      usage:
        association.profileId === entry.profileId
          ? [{ demoId: association.demoId, selected: true }]
          : [],
    };
  });
}

export async function createStudioAuthenticationProfile(
  input: CreateProfileInput,
) {
  const { repository } = await composition();
  return toProfileDto(await repository.create(input));
}

export async function renameStudioAuthenticationProfile(
  profileId: string,
  name: string,
) {
  const { repository } = await composition();
  return toProfileDto(await repository.rename(profileId, name));
}

export async function removeStudioAuthenticationProfile(
  profileId: string,
  force = false,
) {
  const { repository } = await composition();
  await new AuthenticationProfileRemovalService(repository, {
    usageFor,
  }).remove(profileId, force);
}

export async function validateStudioAuthenticationProfile(profileId: string) {
  const { validation } = await composition();
  const result = await validation.validate(profileId);
  return { ...result, profile: toProfileDto(result.profile) };
}

export async function startStudioAuthenticationLogin(
  profileId: string,
  renew = false,
) {
  const existing = [...operations.entries()].find(
    ([, value]) => value.profileId === profileId && !value.settled,
  );
  if (existing) {
    throw new AuthenticationError(
      "AUTH_PROFILE_BUSY",
      "Authentication is already in progress for this profile.",
      { profileId, stage: "interactive-login" },
    );
  }
  const { operationId, operation, completion } =
    registerLoginOperation(profileId);
  void composition()
    .then(({ interactive }) => {
      const request = {
        completion,
        signal: operation.abort.signal,
        onPhase: (phase: string) =>
          publish(operation, { type: "phase", phase }),
      };
      return renew
        ? interactive.renew(profileId, request)
        : interactive.login(profileId, request);
    })
    .then((result) => {
      operation.settled = true;
      finishOperation(operationId, operation, {
        type: "complete",
        profile: toProfileDto(result.profile),
      });
    })
    .catch((error) => {
      operation.settled = true;
      finishOperation(operationId, operation, {
        type: "error",
        error: publicAuthenticationError(error),
      });
    });
  return {
    operationId,
    profileId,
    phase: operation.phase,
    startedAt: operation.startedAt,
  };
}

export function completeStudioAuthenticationLogin(operationId: string) {
  const operation = requireOperation(operationId);
  assertOperationPending(operation);
  operation.signaled = true;
  operation.completion("complete");
}

export function cancelStudioAuthenticationLogin(operationId: string) {
  const operation = requireOperation(operationId);
  assertOperationPending(operation);
  operation.signaled = true;
  operation.completion("cancel");
}

export function subscribeStudioAuthenticationLogin(
  operationId: string,
  listener: (event: LoginEvent) => void,
) {
  const operation = requireOperation(operationId);
  listener({ type: "phase", phase: operation.phase });
  if (operation.terminal) {
    listener(operation.terminal);
    return () => undefined;
  }
  operation.listeners.add(listener);
  return () => operation.listeners.delete(listener);
}

export async function usageFor(
  profileId: string,
): Promise<AuthenticationUsage[]> {
  const association = await currentDemoAssociation();
  return association.profileId === profileId
    ? [{ demoId: association.demoId, selected: true }]
    : [];
}

export async function assertStudioAuthenticationProfileAvailable(
  profileId: string,
) {
  const { repository } = await composition();
  const entry = (await repository.listEntries()).find((item) =>
    item.available
      ? item.profile.id === profileId
      : item.profileId === profileId,
  );
  if (!entry)
    throw new AuthenticationError(
      "AUTH_PROFILE_NOT_FOUND",
      `Authentication profile ${profileId} was not found.`,
      { profileId, stage: "association" },
    );
  if (!entry.available)
    throw new AuthenticationError(
      entry.code,
      "Authentication profile is unavailable and must be repaired before association.",
      { profileId, stage: "association" },
    );
}

export async function currentDemoAssociation() {
  const compilation = await compileDemoModuleIsolated(await trustedDemoPath(), {
    cwd: await trustedWorkspaceRoot(),
  });
  return {
    demoId: compilation.ir.id,
    profileId: compilation.ir.authentication?.profileId,
  };
}

export function publicAuthenticationError(
  error: unknown,
): PublicAuthenticationError {
  if (error instanceof AuthenticationError) return error.public;
  return {
    code: "AUTH_OPERATION_FAILED",
    actionRequired: "retry",
    message: redact(
      error instanceof Error
        ? error.message
        : "Authentication operation failed.",
    ),
    stage: "studio",
  };
}

export function authenticationHttpStatus(
  error: PublicAuthenticationError,
): number {
  if (error.code === "AUTH_PROFILE_NOT_FOUND") return 404;
  if (
    error.code === "AUTH_STATE_CORRUPT" ||
    error.code === "AUTH_UNSUPPORTED_VERSION" ||
    error.code === "AUTH_VALIDATION_FAILED"
  )
    return 422;
  if (error.code === "AUTH_OPERATION_FAILED") return 500;
  return 409;
}

function requireOperation(operationId: string) {
  const operation = operations.get(operationId);
  if (!operation)
    throw new AuthenticationError(
      "AUTH_PROFILE_NOT_FOUND",
      "Authentication operation was not found.",
      { stage: "interactive-login" },
    );
  return operation;
}

function publish(operation: LoginOperation, event: LoginEvent) {
  if (event.type === "phase") operation.phase = event.phase;
  for (const listener of operation.listeners) listener(event);
}

function finishOperation(
  operationId: string,
  operation: LoginOperation,
  event: Extract<LoginEvent, { type: "complete" | "error" }>,
) {
  operation.terminal = event;
  publish(operation, event);
  operation.listeners.clear();
  operation.deletionTimer = setTimeout(
    () => operations.delete(operationId),
    TERMINAL_OPERATION_TTL_MS,
  );
  operation.deletionTimer.unref?.();
}

function assertOperationPending(operation: LoginOperation) {
  if (operation.settled || operation.signaled) {
    throw new AuthenticationError(
      "AUTH_PROFILE_BUSY",
      "Authentication operation has already been completed or cancelled.",
      { profileId: operation.profileId, stage: "interactive-login" },
    );
  }
}

function registerLoginOperation(profileId: string) {
  const operationId = crypto.randomUUID();
  let complete!: (value: "complete" | "cancel") => void;
  const completion = new Promise<"complete" | "cancel">((resolve) => {
    complete = resolve;
  });
  const operation: LoginOperation = {
    profileId,
    phase: "opening-browser",
    startedAt: new Date().toISOString(),
    completion: complete,
    abort: new AbortController(),
    listeners: new Set(),
    settled: false,
    signaled: false,
  };
  operations.set(operationId, operation);
  return { operationId, operation, completion };
}

/** Internal lifecycle harness; no browser state is accepted or exposed. */
export const authenticationOperationTestHarness = {
  create(profileId = "auth_01arz3ndektsv4rrffq69g5fav") {
    return registerLoginOperation(profileId).operationId;
  },
  complete(operationId: string, profile: AuthenticationProfile) {
    const operation = requireOperation(operationId);
    operation.settled = true;
    finishOperation(operationId, operation, { type: "complete", profile });
  },
  fail(operationId: string, error: PublicAuthenticationError) {
    const operation = requireOperation(operationId);
    operation.settled = true;
    finishOperation(operationId, operation, { type: "error", error });
  },
  has(operationId: string) {
    return operations.has(operationId);
  },
  clear() {
    for (const operation of operations.values())
      if (operation.deletionTimer) clearTimeout(operation.deletionTimer);
    operations.clear();
  },
};
