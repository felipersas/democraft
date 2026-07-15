import { NextResponse } from "next/server";
import {
  authorizeStudioSessionBootstrap,
  studioSessionToken,
} from "../../../lib/request-security";
import type { StudioSessionResponse } from "../../../lib/studio-session-contract";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeStudioSessionBootstrap(request);
  if (denied) return denied;

  const token = studioSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "Studio session security is not configured." },
      { status: 503 },
    );
  }

  return NextResponse.json<StudioSessionResponse>(
    { token },
    { headers: { "cache-control": "no-store, private" } },
  );
}
