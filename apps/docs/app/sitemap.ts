import type { MetadataRoute } from "next";
import { source } from "@/source";
import { i18n, type Locale } from "@/lib/i18n";

export const dynamic = "force-static";

/**
 * Sitemap covering every docs page in every locale.
 * Each URL gets an `alternates.languages` map so search engines understand the
 * hreflang relationship between translations.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of i18n.locales) {
    const pages = source.getPages(locale);
    if (!Array.isArray(pages)) continue;
    for (const page of pages) {
      const slugs = page.slugs;
      entries.push({
        url: `https://docs.democraft.dev/${locale}/docs/${slugs.join("/")}`,
        lastModified: page.data.lastModified ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }
  }

  return entries;
}

// silence unused
export type _L = Locale;
