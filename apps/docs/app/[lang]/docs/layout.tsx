import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/source";
import { i18n, type Locale } from "@/lib/i18n";
import { LanguageSelect } from "@/components/language-select";

/**
 * Docs layout — shared sidebar, navbar, and footer for every docs page.
 *
 * The `lang` route param selects which locale's page tree to render in the
 * sidebar, so navigation only shows pages in the current language. The language
 * switcher uses the shared navigation slot, shown in both desktop and mobile UI.
 *
 * `children` is passed directly to DocsLayout (no wrapper) so Fumadocs controls
 * the page centering and max-width.
 */
export async function generateMetadata() {
  return {
    title: {
      default: "Democraft Documentation",
      template: "%s · Democraft",
    },
  };
}

export default async function DocsLayoutRoute({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang as Locale;

  if (!i18n.locales.includes(locale)) {
    return <>{children}</>;
  }

  const navOptions = {
    title: "Democraft",
    url: `/${locale}/docs`,
    children: (
      <div className="ms-auto">
        <LanguageSelect current={locale} />
      </div>
    ),
  };

  const sidebarOptions: DocsLayoutProps["sidebar"] = {
    title: "Democraft",
    defaultOpenLevel: 1,
  };

  return (
    <DocsLayout
      nav={navOptions}
      sidebar={sidebarOptions}
      tree={source.pageTree[locale]}
    >
      {children}
    </DocsLayout>
  );
}
