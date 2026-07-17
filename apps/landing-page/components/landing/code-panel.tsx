import { codeToHtml } from "shiki";

type CodePanelProps = {
  /** The TypeScript source to syntax-highlight. */
  code: string;
  /** Path-bar text (e.g. "talento-saas / src"). */
  path: string;
  /** Filename-tab text (e.g. "demo.ts"). */
  filename: string;
  /** Accessible label for the panel. */
  label: string;
  /** Tighter editor chrome for code embedded in the capability workbench. */
  compact?: boolean;
};

export async function CodePanel({
  code,
  path,
  filename,
  label,
  compact = false,
}: CodePanelProps) {
  const highlighted = await codeToHtml(code, {
    lang: "typescript",
    theme: "github-dark-default",
  });

  return (
    <div
      className={`min-w-0 overflow-hidden border border-[var(--landing-border)] bg-[var(--landing-surface-1)] ${compact ? "rounded-lg" : "rounded-xl"}`}
      aria-label={label}
    >
      <div className="flex h-8 items-center border-b border-[var(--landing-border-subtle)] bg-[var(--landing-surface-2)] px-3">
        <span className="text-[11px] text-[var(--landing-muted)]">{path}</span>
      </div>
      <div
        className="flex h-8 items-end border-b border-[var(--landing-border-subtle)] bg-[var(--landing-surface-1)] px-2"
        role="presentation"
      >
        <span className="border-x border-t border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-3 py-2 text-[11px] leading-none text-[var(--landing-foreground-secondary)]">
          {filename}
        </span>
      </div>
      <div
        className={`[&_pre]:m-0 [&_pre]:min-h-0 [&_pre]:overflow-auto [&_pre]:!bg-[#131416] [&_pre]:px-0 [&_pre]:font-mono [&_code]:block [&_code]:w-max [&_code]:min-w-full [&_code]:text-[0px] [&_code]:[counter-reset:code-line] [&_.line]:block [&_.line]:pr-6 [&_.line]:[counter-increment:code-line] [&_.line::before]:inline-block [&_.line::before]:select-none [&_.line::before]:text-right [&_.line::before]:text-[var(--landing-subtle)] [&_.line::before]:content-[counter(code-line)] ${compact ? "[&_pre]:py-3 [&_pre]:text-[10px] [&_pre]:leading-[8px] [&_.line]:min-h-[13px] [&_.line]:text-[10px] [&_.line::before]:mr-3 [&_.line::before]:w-8" : "[&_pre]:py-4 [&_pre]:text-[11px] [&_pre]:leading-[14px] [&_.line]:min-h-[14px] [&_.line]:text-[11px] [&_.line::before]:mr-4 [&_.line::before]:w-10"}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
