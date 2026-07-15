import type { DemoIR, Locator, TargetSnapshot } from "@democraft/schema";
import type { LocatorLike, PageLike } from "./types";

export async function resolveTarget(
  ir: DemoIR,
  page: PageLike,
  targetId: string,
  timeoutMs = 5000,
): Promise<{ locator?: LocatorLike; snapshot: TargetSnapshot }> {
  const startedAtMs = Date.now();
  const target = ir.targets[targetId];
  const attemptedLocators: TargetSnapshot["attemptedLocators"] = [];

  if (!target) {
    return {
      snapshot: {
        targetId,
        attemptedLocators,
        visible: false,
        resolutionDurationMs: Date.now() - startedAtMs,
      },
    };
  }

  for (const locatorDefinition of target.locators) {
    const locator = createLocator(page, locatorDefinition);

    try {
      let visible = await locator.isVisible({ timeout: timeoutMs });

      // SPA views (Next App Router, React Router) mount a frame after the
      // route change: an element can be absent/not-yet-visible the instant
      // navigation settles, then appear milliseconds later. `isVisible` reports
      // the *current* state, so poll via `waitFor` when available — it resolves
      // the moment the element becomes visible, or throws on timeout.
      if (!visible && locator.waitFor) {
        try {
          await locator.waitFor({ state: "visible", timeout: timeoutMs });
          visible = true;
        } catch {
          visible = false;
        }
      }

      const boundingBox =
        (await locator.boundingBox({ timeout: timeoutMs })) ?? undefined;
      attemptedLocators.push({ locator: locatorDefinition, success: visible });

      if (visible) {
        return {
          locator,
          snapshot: {
            targetId,
            attemptedLocators,
            successfulLocator: locatorDefinition,
            boundingBox,
            visible,
            resolutionDurationMs: Date.now() - startedAtMs,
          },
        };
      }
    } catch (error) {
      attemptedLocators.push({
        locator: locatorDefinition,
        success: false,
        error: error instanceof Error ? error.message : "Locator failed.",
      });
    }
  }

  return {
    snapshot: {
      targetId,
      attemptedLocators,
      visible: false,
      resolutionDurationMs: Date.now() - startedAtMs,
    },
  };
}

export function createLocator(page: PageLike, locator: Locator): LocatorLike {
  switch (locator.kind) {
    case "role":
      return page.getByRole(locator.role, { name: locator.name });
    case "label":
      return page.getByLabel(locator.text);
    case "testId":
      return page.getByTestId(locator.id);
    case "text":
      return page.getByText(locator.text);
  }
}

export function resolveUrl(ir: DemoIR, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, ir.source.baseUrl).toString();
}
