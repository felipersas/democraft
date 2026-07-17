import { NextResponse } from "next/server";
import { authorizeStudioMutation } from "../../../../../../lib/request-security";
import { authenticationErrorResponse } from "../../../../../../lib/authentication-route";
import { completeStudioAuthenticationLogin } from "../../../../../../lib/authentication-server";
type Context = { params: Promise<{ operationId: string }> };
export async function POST(request: Request, context: Context) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  try {
    completeStudioAuthenticationLogin((await context.params).operationId);
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return authenticationErrorResponse(error);
  }
}
