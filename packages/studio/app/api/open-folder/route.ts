import { NextResponse } from "next/server";
import { getJob } from "@/lib/render-queue";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { authorizeStudioMutation } from "../../../lib/request-security";

export const dynamic = "force-dynamic";

/**
 * Reveals a known render job's output file in the OS file manager.
 */
export async function POST(req: Request) {
  const denied = authorizeStudioMutation(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }
  const target = getJob(jobId)?.outputPath;
  if (!target || !existsSync(target)) {
    return NextResponse.json(
      { error: "Output file not found." },
      { status: 404 },
    );
  }

  revealInFileManager(target);
  return NextResponse.json({ ok: true });
}

function revealInFileManager(filePath: string): void {
  const dir = path.dirname(filePath);
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      // `-R` reveals the file in Finder (selects it).
      spawn("open", ["-R", filePath], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else if (platform === "win32") {
      spawn("explorer.exe", ["/select,", filePath], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else {
      // Linux: no universal "reveal" flag; open the containing directory.
      spawn("xdg-open", [dir], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    /* best-effort; the studio keeps working even if reveal fails. */
  }
}
