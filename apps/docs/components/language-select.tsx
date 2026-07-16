"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { i18n, type Locale } from "@/lib/i18n";

/**
 * Language switcher.
 *
 * Swaps the locale prefix in the URL (`/<locale>/docs/...`). Both locale files
 * use the same canonical pathname, so readers stay on the same page.
 *
 * - Keyboard accessible (Escape to close, focus returns to trigger).
 * - No flags: labels are the language name in its own language.
 */
export function LanguageSelect({ current }: { current: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Swap the locale segment at the start of the URL.
   * `/en/docs/introduction` → `/pt-BR/docs/introduction`.
   */
  function targetPath(target: Locale): string {
    // Match leading /<locale> at the start
    const match = pathname.match(/^\/(en|pt-BR)(\/.*)?$/);
    if (match) {
      return `/${target}${match[2] ?? "/docs"}`;
    }
    // No locale prefix — go to the target locale's docs root
    return `/${target}/docs`;
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className="inline-flex items-center gap-1.5 rounded-md border border-fd-border bg-fd-background px-2.5 py-1.5 text-sm text-fd-secondary-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        <Globe className="size-4" aria-hidden />
        <span className="hidden sm:inline">{i18n.languages[current]}</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-fd-border bg-fd-popover p-1 text-sm shadow-md"
        >
          {i18n.locales.map((locale) => (
            <li key={locale} role="option" aria-selected={locale === current}>
              <Link
                href={targetPath(locale)}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 transition-colors hover:bg-fd-accent ${
                  locale === current
                    ? "font-medium text-fd-foreground"
                    : "text-fd-secondary-foreground"
                }`}
              >
                <span>{i18n.languages[locale]}</span>
                {locale === current ? (
                  <span aria-hidden className="text-fd-muted-foreground">✓</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
