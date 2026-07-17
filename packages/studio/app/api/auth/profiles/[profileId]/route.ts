import { NextResponse } from "next/server";
import { authorizeStudioMutation } from "../../../../../lib/request-security";
import { readJsonBodyLimited } from "../../../../../lib/request-body";
import { authenticationErrorResponse } from "../../../../../lib/authentication-route";
import {
  removeStudioAuthenticationProfile,
  renameStudioAuthenticationProfile,
} from "../../../../../lib/authentication-server";

type Context = { params: Promise<{ profileId: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    const { profileId } = await context.params;
    const body = (await readJsonBodyLimited(request, 4096)) as {
      name?: unknown;
    };
    if (typeof body.name !== "string")
      return NextResponse.json(
        {
          error: {
            code: "AUTH_OPERATION_FAILED",
            message: "A profile name is required.",
            actionRequired: "retry",
            stage: "configuration",
          },
        },
        { status: 400 },
      );
    return NextResponse.json({
      profile: await renameStudioAuthenticationProfile(profileId, body.name),
    });
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    const { profileId } = await context.params;
    const force = new URL(request.url).searchParams.get("force") === "true";
    await removeStudioAuthenticationProfile(profileId, force);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
