import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { studioDataDir } from "@/lib/server-data";
import { existsFile } from "@/lib/fs";

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
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const dir = studioDataDir();
  const safePath = path.resolve(dir, ...segments);
  if (!safePath.startsWith(dir)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await existsFile(safePath))) {
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
