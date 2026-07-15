import { defineTargets } from "./targets";
import type {
  DefinedTargets,
  DemoConfig,
  DemoDefinition,
  DemoInput,
  TargetInput,
  VisualDefinition,
  VisualMap,
} from "./types";

export function defineConfig(config: DemoConfig): DemoConfig {
  return config;
}

/** Declare a React/Remotion-compatible function component with inferred props. */
export function defineVisual<TProps>(
  component: (props: TProps) => unknown,
): VisualDefinition<TProps> {
  return { component };
}

export function defineDemo<
  TTargets extends Record<string, TargetInput> = Record<never, never>,
  TVisuals extends VisualMap = Record<never, never>,
>(
  definition: DemoInput<TTargets, TVisuals>,
): DemoDefinition<DefinedTargets<TTargets>, TVisuals> {
  const targets = definition.targets ?? ({} as TTargets);
  if (definition.targets && hasNormalizedTargets(targets)) {
    return definition as DemoDefinition<DefinedTargets<TTargets>, TVisuals>;
  }
  return { ...definition, targets: defineTargets(targets) };
}

function hasNormalizedTargets<TTargets extends Record<string, TargetInput>>(
  targets: TTargets,
): targets is TTargets & DefinedTargets<TTargets> {
  return Object.entries(targets).every(
    ([id, target]) =>
      !("kind" in target) &&
      "id" in target &&
      target.id === id &&
      Array.isArray(target.locators),
  );
}
