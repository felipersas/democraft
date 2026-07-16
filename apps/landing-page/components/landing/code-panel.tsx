import { codeToHtml } from "shiki";

const demo = `import { byText, defineDemo, defineTargets } from "@democraft/core";

const targets = defineTargets({
  dashboard: byText("Operação de recrutamento"),
  applications: byText("Candidaturas por mês"),
});

export default defineDemo({
  id: "talento-overview",
  source: { baseUrl: "http://localhost:3001" },
  targets,
  async run({ demo }) {
    await demo.scene("overview", async (scene) => {
      await scene.goto("/app/nimbus-tech");
      await scene.establish("dashboard");
      await scene.focus("applications");
      await scene.callout("applications", {
        title: "Hiring activity over time",
        renderer: "remocn.callout-dark",
      });
    });
  },
});`;

export async function CodePanel() {
  const highlighted = await codeToHtml(demo, {
    lang: "typescript",
    theme: "github-dark-default",
  });

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface-1)]"
      aria-label="TypeScript demo definition"
    >
      <div className="flex h-8 items-center border-b border-[var(--landing-border-subtle)] bg-[var(--landing-surface-2)] px-3">
        <span className="text-[11px] text-[var(--landing-muted)]">
          talento-saas / src
        </span>
      </div>
      <div
        className="flex h-8 items-end border-b border-[var(--landing-border-subtle)] bg-[var(--landing-surface-1)] px-2"
        role="presentation"
      >
        <span className="border-x border-t border-[var(--landing-border)] bg-[var(--landing-surface-2)] px-3 py-2 text-[11px] leading-none text-[var(--landing-foreground-secondary)]">
          demo.ts
        </span>
      </div>
      <div
        className="[&_pre]:m-0 [&_pre]:min-h-0 [&_pre]:overflow-auto [&_pre]:!bg-[#131416] [&_pre]:px-0 [&_pre]:py-4 [&_pre]:font-mono [&_pre]:text-[11px] [&_pre]:leading-[14px] [&_code]:block [&_code]:w-max [&_code]:min-w-full [&_code]:text-[0px] [&_code]:[counter-reset:code-line] [&_.line]:block [&_.line]:min-h-[14px] [&_.line]:pr-6 [&_.line]:text-[11px] [&_.line]:[counter-increment:code-line] [&_.line::before]:mr-4 [&_.line::before]:inline-block [&_.line::before]:w-10 [&_.line::before]:select-none [&_.line::before]:text-right [&_.line::before]:text-[var(--landing-subtle)] [&_.line::before]:content-[counter(code-line)]"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
