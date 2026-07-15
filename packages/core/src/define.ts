import type { DemoConfig, DemoDefinition } from "./types";

export function defineConfig(config: DemoConfig): DemoConfig {
  return config;
}

export function defineDemo<TTargets extends DemoDefinition["targets"]>(
  definition: DemoDefinition<TTargets>,
): DemoDefinition<TTargets> {
  return definition;
}
