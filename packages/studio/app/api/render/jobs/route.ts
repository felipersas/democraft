import { NextResponse } from "next/server";
import {
  clearFinished,
  listJobs,
  refreshRenderHistory,
  serializeJob,
} from "@/lib/render-queue";
import {
  authorizeStudioLoopbackRequest,
  authorizeStudioMutation,
} from "../../../../lib/request-security";

export const dynamic = "force-dynamic";

/** GET returns current queue snapshot. DELETE clears finished jobs. */
export async function GET(request: Request) {
  const denied = authorizeStudioLoopbackRequest(request);
  if (denied) return denied;

  await refreshRenderHistory();
  return NextResponse.json({ jobs: listJobs().map(serializeJob) });
}

export async function DELETE(request: Request) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;

  clearFinished();
  return NextResponse.json({ ok: true });
}
