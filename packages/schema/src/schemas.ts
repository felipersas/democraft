import { z } from "zod";
import type { Diagnostic } from "./diagnostics";
import type { Locator, TargetDefinition } from "./geometry";

export const locatorSchema: z.ZodType<Locator> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("role"),
    role: z.string(),
    name: z.string().optional(),
  }),
  z.object({ kind: z.literal("label"), text: z.string() }),
  z.object({ kind: z.literal("testId"), id: z.string() }),
  z.object({ kind: z.literal("text"), text: z.string() }),
]);

export const targetDefinitionSchema: z.ZodType<TargetDefinition> = z.object({
  id: z.string().min(1),
  locators: z.array(locatorSchema).min(1),
  description: z.string().optional(),
  framing: z
    .object({
      preferredPadding: z.number().nonnegative().optional(),
      safeArea: z.enum(["center", "top", "bottom", "left", "right"]).optional(),
    })
    .optional(),
});

export const diagnosticSchema: z.ZodType<Diagnostic> = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
  demoId: z.string().optional(),
  sceneId: z.string().optional(),
  stepId: z.string().optional(),
  targetId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
