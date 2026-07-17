import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MUTATION_EXPORT = /export async function (?:POST|PUT|PATCH|DELETE)\b/;
const MUTATION_ROUTES = [
  "audio/route.ts",
  "auth/association/route.ts",
  "auth/login/[operationId]/cancel/route.ts",
  "auth/login/[operationId]/complete/route.ts",
  "auth/login/[operationId]/events/route.ts",
  "auth/profiles/[profileId]/login/route.ts",
  "auth/profiles/[profileId]/route.ts",
  "auth/profiles/[profileId]/validate/route.ts",
  "auth/profiles/route.ts",
  "open-folder/route.ts",
  "recapture/route.ts",
  "render/cancel/route.ts",
  "render/jobs/route.ts",
  "render/route.ts",
  "resolve/route.ts",
];

describe("Studio mutation route security contract", () => {
  it("authorizes every state-changing API route through the shared guard", async () => {
    const apiRoot = path.resolve(process.cwd(), "app/api");
    const routes = await routeFiles(apiRoot);
    const mutations: string[] = [];
    const unsecured: string[] = [];

    for (const route of routes) {
      const source = await readFile(route, "utf8");
      if (!MUTATION_EXPORT.test(source)) continue;
      mutations.push(path.relative(apiRoot, route));
      if (!source.includes("authorizeStudioMutation(")) {
        unsecured.push(path.relative(apiRoot, route));
      }
    }

    expect(mutations.sort()).toEqual(MUTATION_ROUTES);
    expect(unsecured).toEqual([]);
  });
});

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return routeFiles(target);
      return entry.name === "route.ts" ? [target] : [];
    }),
  );
  return files.flat();
}
