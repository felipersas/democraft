import { authorizeStudioMutation } from "../../../../../../lib/request-security";
import {
  publicAuthenticationError,
  subscribeStudioAuthenticationLogin,
} from "../../../../../../lib/authentication-server";
type Context = { params: Promise<{ operationId: string }> };
export async function POST(request: Request, context: Context) {
  const denied = authorizeStudioMutation(request);
  if (denied) return denied;
  const encoder = new TextEncoder();
  const operationId = (await context.params).operationId;
  let unsubscribe = () => {};
  const stream = new ReadableStream({
    start(controller) {
      try {
        unsubscribe = subscribeStudioAuthenticationLogin(
          operationId,
          (event) => {
            controller.enqueue(
              encoder.encode(
                `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
              ),
            );
            if (event.type === "complete" || event.type === "error") {
              unsubscribe();
              controller.close();
            }
          },
        );
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ type: "error", error: publicAuthenticationError(error) })}\n\n`,
          ),
        );
        controller.close();
      }
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    },
  });
}
