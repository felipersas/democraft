import { NextResponse } from "next/server";
import { readMeta } from "@/lib/staleness";
import { reResolveTimeline } from "@/lib/resolve-demo";
import { studioDataDir } from "@/lib/server-data";
import { publish } from "@/lib/event-bus";
import { authorizeStudioMutation } from "../../../lib/request-security";

export const dynamic = "force-dynamic";

/**
 * Re-resolves the timeline from demo.ts + the existing manifest, rewriting
 * timeline.json in place. The file-watcher picks up the change and pushes a
 * reload to the browser automatically. Returns whether the change was
 * structural (re-capture needed) vs. content-only (re-resolve sufficient).
 */
export async function POST(request: Request) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;

  const dataDir = studioDataDir();
  const meta = await readMeta(dataDir);
  if (!meta) {
    return NextResponse.json(
      { error: "No demo metadata found. Launch via `democraft studio` first." },
      { status: 404 },
    );
  }

  try {
    const result = await reResolveTimeline({ meta, dataDir });
    if (!result) {
      return NextResponse.json(
        { error: "No manifest found to resolve against." },
        { status: 404 },
      );
    }
    if (result.structural) {
      return NextResponse.json({
        structural: true,
        detail: result.detail,
      });
    }
    // The file-watcher fires `reload` when timeline.json changes; nudge it in
    // case the watcher debounces too aggressively for a manual trigger.
    publish("reload", {});
    return NextResponse.json({
      structural: false,
      durationInFrames: result.timeline.durationInFrames,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Re-resolve failed." },
      { status: 500 },
    );
  }
}
