import { NextResponse } from "next/server";
import { authorizeStudioMutation } from "../../../../../../lib/request-security";
import { authenticationErrorResponse } from "../../../../../../lib/authentication-route";
import { startStudioAuthenticationLogin } from "../../../../../../lib/authentication-server";
type Context = { params: Promise<{ profileId: string }> };
export async function POST(request: Request, context: Context) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    const renew = new URL(request.url).searchParams.get("renew") === "true";
    return NextResponse.json(
      await startStudioAuthenticationLogin(
        (await context.params).profileId,
        renew,
      ),
      { status: 202 },
    );
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
