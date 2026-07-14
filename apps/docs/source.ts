import { docs } from "@.source";
import { loader } from "fumadocs-core/source";

/**
 * Single source tree with i18n.
 *
 * Content lives in `content/<path>.<locale>.mdx` (dot notation, e.g.
 * `content/concepts/demo.en.mdx`). Fumadocs parses the locale from the
 * filename suffix and generates URLs as `/<locale>/docs/<path>`.
 *
 * Each locale gets its own page tree (`source.pageTree` is a
 * `Record<locale, Root>`), so the sidebar only shows pages in the current
 * language. Adding a locale: add it to `languages` below and create
 * `content/<path>.<newlocale>.mdx` files.
 */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  i18n: {
    languages: ["en", "pt-BR"],
    defaultLanguage: "en",
  },
});
