import { NextResponse } from "next/server";
import { getJob } from "@/lib/render-queue";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Reveals a render output file in the OS file manager. GET ?jobId=... maps to
 * the job's outputPath; GET ?path=... reveals an arbitrary path under the
 * renders dir (used by the "open folder" link in done toasts).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const explicitPath = url.searchParams.get("path");

  let target: string | undefined;
  if (explicitPath) {
    target = explicitPath;
  } else if (jobId) {
    target = getJob(jobId)?.outputPath;
  }
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
      spawn("open", ["-R", filePath], { detached: true, stdio: "ignore" }).unref();
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
