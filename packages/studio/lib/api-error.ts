export async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
      issues?: unknown;
    };
    const semanticMessage =
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : undefined;
    const message =
      typeof body.error === "string"
        ? body.error
        : (semanticMessage ?? fallback);
    const issue = Array.isArray(body.issues) ? body.issues[0] : undefined;
    if (
      issue &&
      typeof issue === "object" &&
      typeof issue.path === "string" &&
      typeof issue.message === "string" &&
      !message.includes(issue.path)
    ) {
      return `${message} (${issue.path}: ${issue.message})`;
    }
    return message;
  } catch {
    return fallback;
  }
}
