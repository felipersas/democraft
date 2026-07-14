/**
 * Single source of truth for the docs locale configuration.
 *
 * Every place that needs to know "what locales exist" imports from here:
 * `source.ts`, the `[lang]` layout, the `<LanguageSelect>`, the sitemap, the
 * middleware, the parity check script.
 *
 * Add a locale here and content/<locale>/ becomes live everywhere.
 */

export const languages = {
  en: "English",
  "pt-BR": "Português",
} as const;

export type Locale = keyof typeof languages;

/** Locales that should NOT be prefixed in the URL (root-locale strategy). */
export const rootLocale: Locale = "en";

export type Languages = typeof languages;

const i18n = {
  languages,
  defaultLanguage: "en" as const,
  /**
   * Returns the URL prefix for a locale.
   * Root locale (en) is served at `/` with no prefix; every other locale
   * gets `/<locale>/` (e.g. `/pt-BR/`).
   */
  prefixFor(locale: Locale): string {
    return locale === rootLocale ? "" : `/${locale}`;
  },
  /**
   * Map a URL path back to a locale. Returns `null` for unknown prefixes.
   */
  localeFromPath(pathname: string): Locale | null {
    const match = pathname.match(/^\/(pt-BR|en)(\/|$)/);
    if (match) {
      return match[1] as Locale;
    }
    // unprefixed path → root locale (en)
    return rootLocale;
  },
  /** Ordered list of locale codes. */
  locales: Object.keys(languages) as Locale[],
  /**
   * Localized UI strings used by Fumadocs components and our layout.
   * Fumadocs reads these via the loader's `i18n.translate` field.
   */
  translate(locale: Locale) {
    return translations[locale] ?? translations.en;
  },
};

export type I18n = typeof i18n;

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    "docs.search": "Search",
    "docs.search.no-result": "No results found.",
    "docs.toc": "On This Page",
    "docs.last-update": "Last updated",
    "docs.previousPage": "Previous",
    "docs.nextPage": "Next",
    "docs.sidebar.search": "Search documentation",
    "docs.theme.dark": "Dark",
    "docs.theme.light": "Light",
    "docs.theme.system": "System",
    "docs.code.copy": "Copy code",
    "docs.code.copied": "Copied",
    "docs.language": "Language",
    "docs.editOnGithub": "Edit on GitHub",
    "docs.footer": "Democraft documentation",
  },
  "pt-BR": {
    "docs.search": "Buscar",
    "docs.search.no-result": "Nenhum resultado encontrado.",
    "docs.toc": "Nesta página",
    "docs.last-update": "Última atualização",
    "docs.previousPage": "Anterior",
    "docs.nextPage": "Próximo",
    "docs.sidebar.search": "Buscar documentação",
    "docs.theme.dark": "Escuro",
    "docs.theme.light": "Claro",
    "docs.theme.system": "Sistema",
    "docs.code.copy": "Copiar código",
    "docs.code.copied": "Copiado",
    "docs.language": "Idioma",
    "docs.editOnGithub": "Editar no GitHub",
    "docs.footer": "Documentação do Democraft",
  },
};

export { i18n };
