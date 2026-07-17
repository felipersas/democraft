import { NextResponse } from "next/server";
import {
  authenticationHttpStatus,
  publicAuthenticationError,
} from "./authentication-server";

export function authenticationErrorResponse(error: unknown) {
  const safe = publicAuthenticationError(error);
  return NextResponse.json(
    { error: safe },
    { status: authenticationHttpStatus(safe) },
  );
}
