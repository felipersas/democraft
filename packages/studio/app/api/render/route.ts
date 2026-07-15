import { NextResponse } from "next/server";
import { enqueue, listJobs, serializeJob } from "@/lib/render-queue";
import {
  ArtifactValidationError,
  parseStudioRenderRequest,
} from "@democraft/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationResponse(
      new ArtifactValidationError("studio render request", [
        { path: "$", message: "Invalid JSON", code: "invalid_json" },
      ]),
    );
  }

  try {
    const options = parseStudioRenderRequest(body);
    const job = enqueue(options);
    return NextResponse.json({ jobId: job.id, job: serializeJob(job) });
  } catch (error) {
    if (error instanceof ArtifactValidationError) {
      return validationResponse(error);
    }
    throw error;
  }
}

/** List current queue state (also pushed live over SSE). */
export async function GET() {
  return NextResponse.json({ jobs: listJobs().map(serializeJob) });
}

function validationResponse(error: ArtifactValidationError) {
  return NextResponse.json(
    { error: error.message, kind: error.kind, issues: error.issues },
    { status: 400 },
  );
}
