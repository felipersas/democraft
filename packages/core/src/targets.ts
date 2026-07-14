import type { TargetDefinition } from "@democraft/schema";
import type { TargetInput, TargetMap } from "./types";

export function defineTarget(target: TargetDefinition): TargetDefinition {
  return target;
}

export function defineTargets(targets: Record<string, TargetInput>): TargetMap {
  return Object.fromEntries(
    Object.entries(targets).map(([id, target]) => {
      if ("kind" in target) {
        return [id, { id, locators: [target] } satisfies TargetDefinition];
      }

      return [id, { ...target, id } satisfies TargetDefinition];
    }),
  );
}
