import type { Locator } from "@democraft/schema";

export function byRole(role: string, options: { name?: string } = {}): Locator {
  return { kind: "role", role, name: options.name };
}

export function byLabel(text: string): Locator {
  return { kind: "label", text };
}

export function byTestId(id: string): Locator {
  return { kind: "testId", id };
}

export function byText(text: string): Locator {
  return { kind: "text", text };
}
