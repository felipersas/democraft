import { NextResponse } from "next/server";
import {
  authorizeStudioLoopbackRequest,
  authorizeStudioMutation,
} from "../../../../lib/request-security";
import { readJsonBodyLimited } from "../../../../lib/request-body";
import { authenticationErrorResponse } from "../../../../lib/authentication-route";
import {
  createStudioAuthenticationProfile,
  listStudioAuthenticationProfiles,
} from "../../../../lib/authentication-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeStudioLoopbackRequest(request);
  if (denied) return denied;
  try {
    return NextResponse.json({
      profiles: await listStudioAuthenticationProfiles(),
    });
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    const body = (await readJsonBodyLimited(request, 16_384)) as {
      name?: unknown;
      origin?: unknown;
      validationUrl?: unknown;
      selector?: unknown;
    };
    if (typeof body.name !== "string" || typeof body.origin !== "string")
      return NextResponse.json(
        {
          error: {
            code: "AUTH_OPERATION_FAILED",
            message: "Name and application URL are required.",
            actionRequired: "retry",
            stage: "configuration",
          },
        },
        { status: 400 },
      );
    const validationUrl =
      typeof body.validationUrl === "string" && body.validationUrl.trim()
        ? body.validationUrl
        : undefined;
    const selector =
      typeof body.selector === "string" && body.selector.trim()
        ? body.selector
        : undefined;
    const validation =
      validationUrl || selector
        ? {
            ...(validationUrl ? { url: validationUrl } : {}),
            ...(selector ? { expect: { selector } } : {}),
          }
        : undefined;
    const profile = await createStudioAuthenticationProfile({
      name: body.name,
      origin: body.origin,
      ...(validation ? { validation } : {}),
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
