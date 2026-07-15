import { NextResponse } from "next/server";
import { cancelJob } from "@/lib/render-queue";
import { authorizeStudioMutation } from "../../../../lib/request-security";
import {
  readJsonBodyLimited,
  RequestBodyTooLargeError,
} from "../../../../lib/request-body";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = authorizeStudioMutation(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await readJsonBodyLimited(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    body = {};
  }
  const jobId =
    body && typeof body === "object" && "jobId" in body
      ? (body as { jobId?: unknown }).jobId
      : undefined;
  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }
  const ok = cancelJob(jobId);
  return NextResponse.json({ ok });
}
