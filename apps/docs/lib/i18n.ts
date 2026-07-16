/**
 * Single source of truth for the docs locale configuration.
 *
 * Every place that needs to know "what locales exist" imports from here:
 * `source.ts`, the `[lang]` layout, the `<LanguageSelect>`, the sitemap, the
 * middleware, the parity check script.
 *
 * Add a locale here and create matching `content/<path>.<locale>.mdx` files.
 */

export const languages = {
  en: "English",
  "pt-BR": "Português",
} as const;

export type Locale = keyof typeof languages;

export type Languages = typeof languages;

const i18n = {
  languages,
  defaultLanguage: "en" as const,
  /** Ordered list of locale codes. */
  locales: Object.keys(languages) as Locale[],
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
