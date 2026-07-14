import { NextResponse } from "next/server";
import { cancelJob } from "@/lib/render-queue";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) {
    return NextResponse.json(
      { error: "jobId is required." },
      { status: 400 },
    );
  }
  const ok = cancelJob(jobId);
  return NextResponse.json({ ok });
}
