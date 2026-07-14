import {
  defineDocs,
  defineConfig,
} from "fumadocs-mdx/config";

/**
 * Source configuration for fumadocs-mdx.
 *
 * `defineDocs` declares the default `docs` + `meta` collections backed by the
 * `content/` directory. The generated index is consumed by `source.ts`.
 *
 * Only collection definitions may be exported from this file (fumadocs-mdx
 * enforces this). Project-wide options go in `defineConfig`.
 */
export const docs = defineDocs({
  dir: "content",
});

export default defineConfig({
  // lastUpdated: true,  // enable git-based last-updated timestamps
});
