import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { authorizeStudioLoopbackRequest } from "../../../lib/request-security";
import { resolveExistingPathWithin } from "../../../lib/path-boundary";
import { trustedDataDirectory } from "../../../lib/studio-path-authority";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const denied = authorizeStudioLoopbackRequest(request);
  if (denied) return denied;

  const { path: segments } = await ctx.params;
  const dir = await trustedDataDirectory();
  const candidate = path.resolve(dir, ...segments);
  const relative = path.relative(dir, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let safePath: string;
  try {
    safePath = await resolveExistingPathWithin(dir, candidate, "Studio asset");
  } catch {
    // Do not reveal whether an escaping symlink points at an existing target.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ext = path.extname(safePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const body = await readFile(safePath);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": mime,
      "cache-control": "no-cache",
    },
  });
}
