import { ArrowRight, Github } from "lucide-react";
import { BrandMark } from "@/components/landing/brand";
import { CapabilityWorkbench } from "@/components/landing/capability-workbench";
import { HeroAurora } from "@/components/landing/hero-aurora";
import { InstallCommand } from "@/components/landing/install-command";
import { Comparison, FAQ, HowItWorks } from "@/components/landing/sections";

const docsBase = (
  process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.democraft.dev"
).replace(/\/$/, "");
const docsHref = (path: string) => `${docsBase}${path}`;
const docs = docsHref("/en/docs/introduction");
const github = "https://github.com/felipersas/democraft";

export function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="sticky top-0 z-20 border-b border-[var(--landing-border-subtle)] bg-[rgba(15,16,18,0.94)]">
        <div className="landing-container flex h-16 items-center justify-between">
          <a
            className="landing-link gap-2 text-[15px] text-[var(--landing-foreground)]"
            href="#top"
          >
            <BrandMark />
            <span>Democraft</span>
          </a>
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-1 max-[720px]:hidden"
          >
            <a
              className="rounded-md px-2 py-1 text-[14px] text-[var(--landing-muted)] no-underline transition-colors duration-[90ms] hover:bg-[var(--landing-hover)] hover:text-[var(--landing-foreground-secondary)]"
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className="rounded-md px-2 py-1 text-[14px] text-[var(--landing-muted)] no-underline transition-colors duration-[90ms] hover:bg-[var(--landing-hover)] hover:text-[var(--landing-foreground-secondary)]"
              href="#capabilities"
            >
              Capabilities
            </a>
            <a
              className="rounded-md px-2 py-1 text-[14px] text-[var(--landing-muted)] no-underline transition-colors duration-[90ms] hover:bg-[var(--landing-hover)] hover:text-[var(--landing-foreground-secondary)]"
              href={docs}
            >
              Documentation
            </a>
          </nav>
          <a
            className="landing-button landing-button-secondary h-8"
            href={github}
          >
            <Github size={14} /> GitHub
          </a>
        </div>
      </header>

      <section
        className="relative isolate min-h-[90svh] overflow-hidden border-b border-[var(--landing-border-subtle)]"
        id="top"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <HeroAurora />
        </div>
        <div className="landing-container relative z-10 grid min-h-[90svh] grid-cols-[minmax(320px,0.78fr)_minmax(520px,1.22fr)] items-center gap-12 py-[clamp(80px,9vw,128px)] max-[1000px]:grid-cols-1 max-[800px]:py-20">
          <div className="flex max-w-[590px] flex-col items-start max-[1000px]:max-w-[720px]">
            <p className="landing-kicker mb-4">Open-source demos as code</p>
            <h1 className="max-w-[680px] text-[clamp(46px,5vw,68px)] leading-[1.02] font-[550] tracking-[-0.035em] text-balance max-[560px]:text-[clamp(40px,12vw,56px)]">
              Turn real product workflows into repeatable demo videos.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[18px] leading-7 text-pretty text-[var(--landing-foreground-secondary)]">
              Write the flow once in TypeScript. Democraft runs it against your
              real app with Playwright, captures every step, then uses Remotion
              to render a polished MP4 with camera direction, captions, audio,
              authenticated sessions, and React visuals.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <a className="landing-button landing-button-primary" href={docs}>
                Build your first demo <ArrowRight size={14} />
              </a>
              <a
                className="landing-button landing-button-secondary"
                href={github}
              >
                <Github size={14} /> See the source
              </a>
            </div>
          </div>
          <figure className="m-0 min-w-0 overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface-1)]">
            <video
              className="block aspect-video w-full bg-[var(--landing-surface-1)] object-cover saturate-[0.92]"
              aria-label="A Democraft-rendered walkthrough of the Talento recruiting product"
              autoPlay
              controls
              loop
              muted
              playsInline
              poster="/demos/talento-pipeline-poster.webp"
              preload="metadata"
            >
              <source src="/demos/talento-pipeline.mp4" type="video/mp4" />
            </video>
          </figure>
        </div>
      </section>

      <CapabilityWorkbench docsHref={docsHref} />

      <HowItWorks />

      <Comparison />

      <section className="landing-container landing-section grid grid-cols-[0.68fr_1.32fr] gap-20 max-[800px]:grid-cols-1 max-[800px]:gap-10">
        <div>
          <p className="landing-kicker mb-4">Local workflow</p>
          <h2 className="landing-heading">
            Capture when the product is running. Iterate when it isn’t.
          </h2>
          <p className="landing-copy mt-5">
            Compatible captures can be reused for presentation-only edits. The
            local Studio provides a frame-accurate preview and render workflow
            without turning the landing page into a fake interface.
          </p>
        </div>
        <InstallCommand />
      </section>

      <FAQ />

      <section className="landing-container landing-section text-center">
        <h2 className="landing-heading mx-auto">Stop re-recording demos.</h2>
        <p className="mx-auto mt-4 mb-6 text-[16px] leading-[26px] text-[var(--landing-foreground-secondary)]">
          Start versioning the experience that explains your product.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <a className="landing-button landing-button-primary" href={docs}>
            Start with documentation <ArrowRight size={14} />
          </a>
          <a className="landing-button landing-button-secondary" href={github}>
            <Github size={14} /> Open GitHub
          </a>
        </div>
      </section>

      <footer className="landing-container grid grid-cols-[1fr_auto_1fr] items-center gap-5 border-t border-[var(--landing-border-subtle)] py-6 text-[13px] max-[800px]:grid-cols-1">
        <a
          className="landing-link text-[var(--landing-foreground)]"
          href="#top"
        >
          <BrandMark />
          <span>Democraft</span>
        </a>
        <div className="flex gap-4 max-[800px]:flex-wrap">
          <a
            className="landing-link text-[13px] text-[var(--landing-muted)]"
            href={docs}
          >
            Documentation
          </a>
          <a
            className="landing-link text-[13px] text-[var(--landing-muted)]"
            href={docsHref("/en/docs/examples/basic")}
          >
            Example
          </a>
          <a
            className="landing-link text-[13px] text-[var(--landing-muted)]"
            href={docsHref("/en/docs/contribute/development")}
          >
            Contribute
          </a>
          <a
            className="landing-link text-[13px] text-[var(--landing-muted)]"
            href={github}
          >
            GitHub
          </a>
        </div>
        <span className="justify-self-end text-[var(--landing-muted)] max-[800px]:justify-self-start">
          MIT License
        </span>
      </footer>
    </main>
  );
}
