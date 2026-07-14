import { NextResponse } from "next/server";
import { enqueue, listJobs, serializeJob } from "@/lib/render-queue";
import type { RenderOptions } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const options = (await req.json().catch(() => ({}))) as RenderOptions;
  const job = enqueue({
    width: options.width,
    height: options.height,
    scale: options.scale,
    crf: options.crf,
    frameRange: options.frameRange,
    entryPath: options.entryPath,
    captionOverrides: options.captionOverrides,
  });
  return NextResponse.json({ jobId: job.id, job: serializeJob(job) });
}

/** List current queue state (also pushed live over SSE). */
export async function GET() {
  return NextResponse.json({ jobs: listJobs().map(serializeJob) });
}
