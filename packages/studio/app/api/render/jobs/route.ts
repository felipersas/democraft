import { NextResponse } from "next/server";
import { clearFinished, listJobs, serializeJob } from "@/lib/render-queue";

export const dynamic = "force-dynamic";

/** GET returns current queue snapshot. DELETE clears finished jobs. */
export async function GET() {
  return NextResponse.json({ jobs: listJobs().map(serializeJob) });
}

export async function DELETE() {
  clearFinished();
  return NextResponse.json({ ok: true });
}
