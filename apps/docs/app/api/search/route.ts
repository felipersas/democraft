import { createSearchAPI } from "fumadocs-core/search/server";
import { source } from "@/source";
import { i18n } from "@/lib/i18n";
import type { StructuredData } from "fumadocs-core/mdx-plugins";

/**
 * Multilingual search endpoint.
 *
 * Builds the index by walking each locale's page list. With `parser: 'dir'`,
 * `source.getPages(locale)` returns the pages whose first path segment is the
 * locale directory. We tag each entry with its locale for client-side filtering.
 */
function buildIndexes() {
  const all: Array<{
    title: string;
    description: string;
    url: string;
    id: string;
    locale: string;
    structuredData: StructuredData;
  }> = [];

  for (const locale of i18n.locales) {
    const pages = source.getPages(locale);
    if (!Array.isArray(pages)) continue;
    for (const page of pages) {
      all.push({
        title: page.data.title ?? "",
        description: page.data.description ?? "",
        url: page.url,
        id: page.url,
        locale,
        structuredData: page.data.structuredData,
      });
    }
  }
  return all;
}

export const { GET } = createSearchAPI("advanced", {
  indexes: buildIndexes(),
});
