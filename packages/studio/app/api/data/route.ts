import { NextResponse } from "next/server";
import { loadStudioData, studioDataDir } from "@/lib/server-data";
import { existsDir } from "@/lib/fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const dir = studioDataDir();
  if (!(await existsDir(dir))) {
    return NextResponse.json(
      {
        error: `Studio data directory not found at ${dir}. Run \`democraft studio <demo.ts>\` first.`,
      },
      { status: 404 },
    );
  }
  const data = await loadStudioData();
  if (!data) {
    return NextResponse.json(
      {
        error: `Studio data not found. Missing manifest.json or timeline.json in ${dir}.`,
      },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}
