import type { DemoDefinition } from "@democraft/core";
import type { Diagnostic, Locator } from "@democraft/schema";

export function formatDiagnostics(
  diagnostics: Diagnostic[],
): string {
  if (diagnostics.length === 0) return "No diagnostics.";
  return diagnostics
    .map((diagnostic) => {
      const location = diagnostic.path ? ` at ${diagnostic.path}` : "";
      const suggestion = diagnostic.suggestion
        ? `\n  Suggestion: ${diagnostic.suggestion}`
        : "";
      return `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${location}: ${diagnostic.message}${suggestion}`;
    })
    .join("\n");
}

export function formatTargets(demo: DemoDefinition): string {
  const lines = [`${demo.id} targets`, ""];
  for (const target of formatTargetsJson(demo).targets) {
    lines.push(`- ${target.id}`);
    for (const locator of target.locators) {
      lines.push(`  ${formatLocator(locator)}`);
    }
  }
  return lines.join("\n").trimEnd();
}

export function formatTargetsJson(demo: DemoDefinition) {
  return {
    demoId: demo.id,
    targets: Object.values(demo.targets).map((target) => ({
      id: target.id,
      description: target.description,
      framing: target.framing,
      locators: target.locators,
    })),
  };
}

export function formatLocator(locator: Locator): string {
  switch (locator.kind) {
    case "role":
      return `role=${locator.role}${locator.name ? ` name="${locator.name}"` : ""}`;
    case "label":
      return `label="${locator.text}"`;
    case "testId":
      return `testId="${locator.id}"`;
    case "text":
      return `text="${locator.text}"`;
  }
}
