import { NextResponse } from "next/server";
import {
  authorizeStudioLoopbackRequest,
  authorizeStudioMutation,
} from "../../../../lib/request-security";
import { readJsonBodyLimited } from "../../../../lib/request-body";
import { authenticationErrorResponse } from "../../../../lib/authentication-route";
import {
  assertStudioAuthenticationProfileAvailable,
  currentDemoAssociation,
} from "../../../../lib/authentication-server";
import { setCurrentDemoAuthentication } from "../../../../lib/demo-authentication-source";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = authorizeStudioLoopbackRequest(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await currentDemoAssociation());
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
export async function PUT(request: Request) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    const body = (await readJsonBodyLimited(request, 4096)) as {
      profileId?: unknown;
    };
    if (
      body.profileId !== undefined &&
      body.profileId !== null &&
      typeof body.profileId !== "string"
    )
      return NextResponse.json(
        {
          error: {
            code: "AUTH_OPERATION_FAILED",
            message: "Select a valid authentication profile.",
            actionRequired: "retry",
            stage: "association",
          },
        },
        { status: 400 },
      );
    const profileId =
      typeof body.profileId === "string" ? body.profileId : undefined;
    if (profileId) await assertStudioAuthenticationProfileAvailable(profileId);
    return NextResponse.json(await setCurrentDemoAuthentication(profileId));
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
