import { NextResponse } from "next/server";
import { authorizeStudioMutation } from "../../../../../../lib/request-security";
import { authenticationErrorResponse } from "../../../../../../lib/authentication-route";
import { validateStudioAuthenticationProfile } from "../../../../../../lib/authentication-server";
type Context = { params: Promise<{ profileId: string }> };
export async function POST(request: Request, context: Context) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    return NextResponse.json(
      await validateStudioAuthenticationProfile(
        (await context.params).profileId,
      ),
    );
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
