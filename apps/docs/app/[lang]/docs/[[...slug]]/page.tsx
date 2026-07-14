import { source } from "@/source";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { i18n, translations, type Locale } from "@/lib/i18n";

/**
 * Docs page — handles every locale and every slug.
 *
 * URL shape: `/<lang>/docs/<...slug>`
 *   - `/en/docs/introduction`       English introduction page
 *   - `/pt-BR/docs/introducao`      Portuguese introduction page
 *
 * `lang` is a route param (validated against known locales). `slug` is the
 * content path within that locale. The source resolves pages by language
 * internally, so we pass the locale to `getPage`/`generateParams`.
 */
export const dynamicParams = false;

/** First content page for each locale — where `/<lang>/docs` redirects to. */
const localeLanding: Record<Locale, string> = {
  en: "introduction",
  "pt-BR": "introducao",
};

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}): Promise<Metadata> {
  const { lang, slug = [] } = await params;
  if (!i18n.locales.includes(lang as Locale)) return {};
  const page = source.getPage(slug, lang);
  if (!page) return {};
  return {
    title: page.data.title,
    description: page.data.description ?? undefined,
    openGraph: {
      title: page.data.title,
      description: page.data.description ?? undefined,
    },
    alternates: {
      canonical: `/${lang}/docs/${slug.join("/")}`,
      languages: buildHreflang(slug),
    },
  };
}

/**
 * hreflang alternates. Since the two locales use translated slugs, we can't
 * just swap the locale prefix — we look up the equivalent page in each locale
 * and fall back to that locale's landing page if no translation exists.
 */
function buildHreflang(slug: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const locale of i18n.locales) {
    result[locale] = `/${locale}/docs/${slug.join("/")}`;
  }
  return result;
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  const { lang, slug = [] } = await params;

  // Validate locale
  if (!i18n.locales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;

  // Locale root with no slug → redirect to the first page.
  if (slug.length === 0) {
    redirect(`/${locale}/docs/${localeLanding[locale]}`);
  }

  const page = source.getPage(slug, locale);
  if (!page) notFound();

  const t = translations[locale] ?? translations.en;
  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        header: t["docs.toc"],
      }}
      lastUpdate={page.data.lastModified}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}
