import { AuthenticationError } from "./errors";
import type { AuthenticationRepository } from "./ports";

export type AuthenticationUsage = { demoId: string; selected: true };

export interface AuthenticationUsageResolver {
  usageFor(profileId: string): Promise<AuthenticationUsage[]>;
}

/** Applies association policy before delegating secret deletion to storage. */
export class AuthenticationProfileRemovalService {
  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly usages: AuthenticationUsageResolver,
  ) {}

  async remove(profileId: string, force = false): Promise<void> {
    const usage = await this.usages.usageFor(profileId);
    if (usage.length > 0 && !force) {
      throw new AuthenticationError(
        "AUTH_PROFILE_IN_USE",
        `Authentication profile ${profileId} is used by ${usage.length} demo${usage.length === 1 ? "" : "s"}: ${usage.map((item) => item.demoId).join(", ")}.`,
        {
          profileId,
          stage: "removal",
          usage: usage.map(({ demoId }) => ({ demoId })),
        },
      );
    }
    // `force` confirms associations only. Filesystem safety remains enforced.
    await this.repository.remove(profileId);
  }
}
