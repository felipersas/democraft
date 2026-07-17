import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function startDemoServer(port = 4173): Promise<Server> {
  const html = await readFile(new URL("../public/index.html", import.meta.url));

  const server = createServer((request, response) => {
    if (request.url === "/private/login" && request.method === "POST") {
      response.writeHead(303, {
        location: "/private/dashboard",
        "set-cookie":
          "democraft-example-session=valid; Path=/; HttpOnly; SameSite=Lax",
      });
      response.end();
      return;
    }

    if (request.url === "/private/login") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        `<!doctype html><html><body><main><h1>Example sign in</h1><form method="post"><button type="submit">Sign in</button></form></main></body></html>`,
      );
      return;
    }

    if (request.url === "/private/dashboard") {
      if (
        !request.headers.cookie?.includes("democraft-example-session=valid")
      ) {
        response.writeHead(302, { location: "/private/login" });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        `<!doctype html><html><body><main data-testid="private-dashboard"><h1>Private dashboard</h1><p>The authentication profile restored this session.</p></main></body></html>`,
      );
      return;
    }

    if (request.url === "/" || request.url === "/dashboard") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT ?? 4173);
  await startDemoServer(port);
  process.stdout.write(`Demo app listening on http://localhost:${port}\n`);
}
