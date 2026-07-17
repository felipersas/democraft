import { NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  ArtifactValidationError,
  parseAudioOverrides,
} from "@democraft/schema";
import { authorizeStudioMutation } from "../../../lib/request-security";
import {
  readJsonBodyLimited,
  RequestBodyTooLargeError,
} from "../../../lib/request-body";
import { trustedDataDirectory } from "../../../lib/studio-path-authority";
import { writeFileContainedAtomic } from "../../../lib/safe-write";
import {
  resolveExistingPathWithin,
  resolveWritePathWithin,
} from "../../../lib/path-boundary";
import { publish } from "../../../lib/event-bus";

export const dynamic = "force-dynamic";

/**
 * Studio audio overrides: the full set of audio tracks (IR/ms form) that
 * replaces demo.ts `audioTracks` for preview + render. Mirrors the render route
 * security + body-parsing pattern. The file watcher fires `reload` when
 * audio-overrides.json changes (it matches `*.json`).
 */

/** Save (replace) the audio override set. */
export async function POST(req: Request) {
  const denied = authorizeStudioMutation(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await readJsonBodyLimited(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return validationResponse(
      new ArtifactValidationError("audio overrides", [
        { path: "$", message: "Invalid JSON", code: "invalid_json" },
      ]),
    );
  }

  try {
    const overrides = parseAudioOverrides(body);
    const dir = await trustedDataDirectory();
    const target = await resolveWritePathWithin(
      dir,
      path.join(dir, "audio-overrides.json"),
      "Audio overrides",
    );
    await writeFileContainedAtomic(
      dir,
      target,
      `${JSON.stringify(overrides, null, 2)}\n`,
      "Audio overrides",
    );
    // Nudge the file watcher in case it debounces too aggressively.
    publish("reload", {});
    return NextResponse.json({ ok: true, count: overrides.length });
  } catch (error) {
    if (error instanceof ArtifactValidationError) {
      return validationResponse(error);
    }
    throw error;
  }
}

/** Reset: delete the override file so demo.ts audio takes over again. */
export async function DELETE(req: Request) {
  const denied = authorizeStudioMutation(req);
  if (denied) return denied;

  const dir = await trustedDataDirectory();
  try {
    const file = await resolveExistingPathWithin(
      dir,
      path.join(dir, "audio-overrides.json"),
      "Audio overrides",
    );
    await rm(file, { force: true });
  } catch {
    // Already absent — treat as a successful reset.
  }
  publish("reload", {});
  return NextResponse.json({ ok: true });
}

function validationResponse(error: ArtifactValidationError) {
  return NextResponse.json(
    { error: error.message, kind: error.kind, issues: error.issues },
    { status: 400 },
  );
}
