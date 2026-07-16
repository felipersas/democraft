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
      className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0b0d11] shadow-[0_22px_70px_rgba(0,0,0,0.34)]"
      aria-label="TypeScript demo definition"
    >
      <div className="flex h-8 items-center border-b border-white/10 bg-[#111216] px-3.5">
        <span className="text-[10px] text-[#7d8590]">talento-saas / src</span>
      </div>
      <div
        className="flex h-8 items-end border-b border-white/10 bg-[#0d1117] px-2.5"
        role="presentation"
      >
        <span className="border-x border-t border-white/10 bg-[#0d1117] px-3 py-2 text-[10px] leading-none text-[#dfe0e3]">
          demo.ts
        </span>
      </div>
      <div
        className="[&_pre]:m-0 [&_pre]:min-h-0 [&_pre]:overflow-auto [&_pre]:!bg-[#0d1117] [&_pre]:px-0 [&_pre]:py-4 [&_pre]:font-mono [&_pre]:text-[10.75px] [&_pre]:leading-[1.45] [&_code]:block [&_code]:w-max [&_code]:min-w-full [&_code]:text-[0px] [&_code]:[counter-reset:code-line] [&_.line]:block [&_.line]:min-h-[1.45em] [&_.line]:pr-6 [&_.line]:text-[10.75px] [&_.line]:[counter-increment:code-line] [&_.line::before]:mr-4 [&_.line::before]:inline-block [&_.line::before]:w-10 [&_.line::before]:select-none [&_.line::before]:text-right [&_.line::before]:text-[#484f58] [&_.line::before]:content-[counter(code-line)]"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
