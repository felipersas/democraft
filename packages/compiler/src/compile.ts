import type { CapturedStep, DemoDefinition, DemoScene } from "@democraft/core";
import {
  diagnosticDocsUrl,
  type DemoIR,
  type Diagnostic,
  schemaVersion,
} from "@democraft/schema";
import { createSceneCapture } from "./capture";
import { normalizeAudioTracks } from "./normalize-audio";
import { normalizeScene } from "./normalize";
import type {
  CapturedScene,
  CompilationOperationResult,
  CompilationResult,
} from "./types";
import { validateIR } from "./validation";
import { createCaptureHash, createDefinitionHash } from "./definition-hash";

export async function compileDemo(
  definition: DemoDefinition,
): Promise<CompilationResult> {
  const diagnostics: Diagnostic[] = [];
  const capturedScenes: CapturedScene[] = [];
  const fps = definition.config?.fps;
  const hasValidFps = fps === undefined || (Number.isFinite(fps) && fps > 0);

  if (!hasValidFps) {
    diagnostics.push({
      code: "DC001",
      severity: "error",
      message: "Config fps must be a finite number greater than 0.",
      path: "config.fps",
      suggestion: "Use a positive FPS such as 30 or 60.",
      docsUrl: diagnosticDocsUrl("DC001"),
      demoId: definition.id,
    });
  }

  const demo = {
    async scene(
      id: string,
      metadataOrRun:
        | ((scene: DemoScene) => Promise<void> | void)
        | Omit<CapturedScene, "id" | "steps">,
      maybeRun?: (scene: DemoScene) => Promise<void> | void,
    ) {
      const metadata = typeof metadataOrRun === "function" ? {} : metadataOrRun;
      const run =
        typeof metadataOrRun === "function" ? metadataOrRun : maybeRun;
      const steps: CapturedStep[] = [];

      if (!run) {
        diagnostics.push({
          code: "DC103",
          severity: "error",
          message: `Scene "${id}" is missing a run callback.`,
          path: `scenes.${id}`,
          suggestion: "Pass a scene callback as the final argument.",
          docsUrl: diagnosticDocsUrl("DC103"),
          demoId: definition.id,
          sceneId: id,
        });
        return;
      }

      await run(createSceneCapture(steps));
      capturedScenes.push({ id, ...metadata, steps });
    },
  };

  try {
    await definition.run({ demo });
  } catch (error) {
    diagnostics.push({
      code: "DC003",
      severity: "error",
      message: error instanceof Error ? error.message : "Demo capture failed.",
      path: "run",
      suggestion: "Fix the exception thrown by the demo run callback.",
      docsUrl: diagnosticDocsUrl("DC003"),
      demoId: definition.id,
    });
  }

  const ir: DemoIR = {
    schemaVersion,
    id: definition.id,
    title: definition.title,
    source: definition.source,
    ...(definition.authentication
      ? { authentication: { ...definition.authentication } }
      : {}),
    targets: definition.targets,
    visuals: Object.keys(definition.visuals ?? {}),
    audio: normalizeAudioTracks(
      definition.id,
      definition.audioTracks,
      diagnostics,
    ),
    scenes: capturedScenes.map((scene) =>
      normalizeScene(definition.id, scene, diagnostics),
    ),
  };
  const validationDiagnostics = validateIR(ir);
  diagnostics.push(...validationDiagnostics);
  if (
    !validationDiagnostics.some((diagnostic) => diagnostic.code === "DC108")
  ) {
    ir.definitionHash = createDefinitionHash(ir);
  }
  ir.captureHash = createCaptureHash(ir);

  return {
    ir,
    config: fps === undefined || !hasValidFps ? {} : { fps },
    diagnostics,
  };
}

export async function compileDemoResult(
  definition: DemoDefinition,
): Promise<CompilationOperationResult> {
  const { ir, config, diagnostics } = await compileDemo(definition);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }
  return { ok: true, value: { ir, config }, diagnostics };
}
