import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
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
  // Audio formats served to the Studio preview player and rendered output.
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".flac": "audio/flac",
  ".weba": "audio/webm",
  ".opus": "audio/ogg",
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
  const { size } = await stat(safePath);
  const rangeHeader = request.headers.get("range");

  // Media files (audio/video) are served with HTTP Range support so Remotion
  // can seek them frame-by-frame. Without it, <Audio>/<OffthreadVideo> fail
  // with "cannot be seeked" and the Player stalls (non-seekable media forces
  // the renderer to reload on every seek, tanking FPS). Images/JSON ignore the
  // Range header and are returned whole.
  if (rangeHeader && isMediaMime(mime)) {
    return serveRange(safePath, size, rangeHeader, mime);
  }

  const { readFile } = await import("node:fs/promises");
  const body = await readFile(safePath);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": mime,
      // Advertise range support so media elements issue Range requests.
      "accept-ranges": "bytes",
      "content-length": String(size),
      "cache-control": "no-cache",
    },
  });
}

/** Serve a byte range (HTTP 206 Partial Content) for seekable media. */
function serveRange(
  filePath: string,
  size: number,
  rangeHeader: string,
  mime: string,
): NextResponse {
  // Parse "bytes=start-end" (end optional). Malformed → 416.
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return new NextResponse(null, {
      status: 416,
      headers: { "content-range": `bytes */${size}` },
    });
  }
  const start = match[1] ? Number(match[1]) : NaN;
  const end = match[2] ? Number(match[2]) : size - 1;

  if (
    !Number.isFinite(start) ||
    start < 0 ||
    end >= size ||
    start > end
  ) {
    return new NextResponse(null, {
      status: 416,
      headers: { "content-range": `bytes */${size}` },
    });
  }

  const chunkSize = end - start + 1;
  const stream = createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 206,
    headers: {
      "content-type": mime,
      "accept-ranges": "bytes",
      "content-length": String(chunkSize),
      "content-range": `bytes ${start}-${end}/${size}`,
      "cache-control": "no-cache",
    },
  });
}

/** True for audio/video MIME types that benefit from Range serving. */
function isMediaMime(mime: string): boolean {
  return mime.startsWith("audio/") || mime.startsWith("video/");
}
