import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const beat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: beat\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);
      const unsubscribe = subscribe(send);
      send("ready", {});
      _req.signal.addEventListener("abort", () => {
        clearInterval(beat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
