import { NextResponse } from "next/server";
import { redactCaptureErrorMessage, runDemo } from "@democraft/playwright";
import { readMeta } from "@/lib/staleness";
import {
  buildMetaAfterCapture,
  materializeStudioData,
} from "@/lib/materialize";
import { studioDataDir } from "@/lib/server-data";
import { publish } from "@/lib/event-bus";
import { resolveTimeline } from "@democraft/timeline";
import path from "node:path";
import {
  resolveExactWritePath,
  resolveWritePathWithin,
} from "../../../lib/path-boundary";
import { authorizeStudioMutation } from "../../../lib/request-security";
import {
  trustedCaptureHeadless,
  trustedDemoPath,
  trustedExplicitCaptureDirectory,
  trustedStorageState,
  trustedWorkspaceRoot,
} from "../../../lib/studio-path-authority";
import { mkdir } from "node:fs/promises";
import { compileDemoModuleIsolated } from "../../../lib/compile-demo-isolated";
import { createStudioAuthenticationExecution } from "../../../lib/authentication-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
let recaptureInFlight = false;

/**
 * Re-runs the Playwright capture for the demo the studio was launched with,
 * then materializes the fresh artifacts into studio-data. The file-watcher
 * picks up the rewritten files and pushes a `reload` to the browser, so the
 * studio hot-reloads automatically when the capture completes.
 *
 * Progress is published as `recapture-progress` events over SSE so the UI
 * can show a spinner/state.
 */
export async function POST(request: Request) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;

  if (recaptureInFlight) {
    return NextResponse.json(
      { error: "A re-capture is already running." },
      { status: 409 },
    );
  }
  recaptureInFlight = true;
  try {
    return await performRecapture();
  } finally {
    recaptureInFlight = false;
  }
}

async function performRecapture() {
  const dataDir = studioDataDir();
  const meta = await readMeta(dataDir);
  if (!meta) {
    return NextResponse.json(
      { error: "No demo metadata found. Launch via `democraft studio` first." },
      { status: 404 },
    );
  }

  publish("recapture-progress", { phase: "compiling" });
  let manifest;
  try {
    const demoPath = await trustedDemoPath();
    const workspaceRoot = await trustedWorkspaceRoot();
    const compilation = await compileDemoModuleIsolated(demoPath, {
      cwd: workspaceRoot,
    });
    const errors = compilation.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );
    if (errors.length > 0) {
      throw new Error(
        `Static validation failed: ${errors.map((error) => error.message).join("; ")}`,
      );
    }

    publish("recapture-progress", { phase: "capturing" });
    const managedCaptureRoot = await resolveWritePathWithin(
      workspaceRoot,
      path.join(workspaceRoot, ".democraft", "runs"),
      "Managed capture root",
    );
    const explicitOutput = trustedExplicitCaptureDirectory();
    if (!explicitOutput) await mkdir(managedCaptureRoot, { recursive: true });
    let captureDir = explicitOutput
      ? await resolveExactWritePath(
          explicitOutput,
          "Explicit capture directory",
        )
      : await resolveWritePathWithin(
          managedCaptureRoot,
          meta.captureDir,
          "Managed capture directory",
        );
    if (explicitOutput && captureDir !== path.resolve(explicitOutput)) {
      throw new Error(
        `Explicit capture directory changed after Studio startup: ${explicitOutput}`,
      );
    }
    manifest = await runDemo(compilation.ir, {
      outputDir: explicitOutput ? captureDir : undefined,
      captureRootDir: managedCaptureRoot,
      headless: trustedCaptureHeadless(),
      authentication: compilation.ir.authentication
        ? await createStudioAuthenticationExecution()
        : undefined,
      environment: (() => {
        const storageState = trustedStorageState();
        return storageState ? { storageState } : undefined;
      })(),
      onArtifactCreated: (artifact) => {
        captureDir = artifact.outputDir;
      },
    });

    publish("recapture-progress", { phase: "resolving" });
    const timeline = resolveTimeline(compilation.ir, manifest);

    publish("recapture-progress", { phase: "materializing" });
    await materializeStudioData({
      dataDir,
      captureDir,
      manifest,
      timeline,
      meta: buildMetaAfterCapture(
        meta,
        compilation.ir,
        captureDir,
        manifest.captureEnvironmentHash,
      ),
    });
  } catch (err) {
    const message = redactCaptureErrorMessage(
      err instanceof Error ? err : "Re-capture failed.",
    );
    publish("recapture-progress", {
      phase: "failed",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  publish("recapture-progress", { phase: "done" });
  // The file-watcher fires `reload` when studio-data changes; nudge in case
  // the debounce is slow for a user-triggered action.
  publish("reload", {});
  return NextResponse.json({ ok: true });
}
