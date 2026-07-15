import type { TargetDefinition } from "@democraft/schema";
import type { TargetInput } from "./types";

export type DefinedTargets<TTargets extends Record<string, TargetInput>> = {
  [TTargetId in keyof TTargets]: TargetDefinition;
};

export function defineTarget(target: TargetDefinition): TargetDefinition {
  return target;
}

export function defineTargets<
  TTargets extends Record<string, TargetInput>,
>(targets: TTargets): DefinedTargets<TTargets> {
  return Object.fromEntries(
    Object.entries(targets).map(([id, target]) => {
      if ("kind" in target) {
        return [id, { id, locators: [target] } satisfies TargetDefinition];
      }

      return [id, { ...target, id } satisfies TargetDefinition];
    }),
  ) as DefinedTargets<TTargets>;
}
