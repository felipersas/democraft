import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for the Studio package.
 *
 * The repo previously relied on per-file `// @vitest-environment jsdom` pragmas
 * and module mocking to avoid resolving the `@/*` tsconfig path alias under
 * test. Component tests that render real source (e.g. the timeline playhead)
 * transitively import `@/...` modules, so we wire the alias here to mirror the
 * tsconfig `paths` mapping (`@/*` → `./*`).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Co-located tests live next to their source; pick up *.test.ts(x).
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", "dist", ".next"],
  },
});
