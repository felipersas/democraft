import { ArrowRight, Github } from "lucide-react";
import { BrandMark } from "@/components/landing/brand";
import { CodePanel } from "@/components/landing/code-panel";
import { InstallCommand } from "@/components/landing/install-command";
import { Silk } from "@/components/landing/silk";
import {
  Comparison,
  FAQ,
  HowItWorks,
  ProductPrinciples,
} from "@/components/landing/sections";

const docs = "/en/docs/introduction";
const github = "https://github.com/felipersas/democraft";

export function LandingPage() {
  return (
    <main className="bg-black min-h-screen overflow-hidden bg-[radial-gradient(circle_at_72%_8%,rgba(255,255,255,0.045),transparent_28%),#08090b] font-[family-name:var(--font-sans)] text-[#f7f8f8]">
      <header className="mx-auto flex h-[72px] w-[calc(100%_-_3rem)] tems-center justify-between border-b border-white/10 text-[13px] max-[800px]:h-16 max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px]">
        <a
          className="flex items-center gap-2.5 font-[650] text-[#f7f8f8] no-underline"
          href="#top"
        >
          <BrandMark />
          <span>Democraft</span>
        </a>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-[30px] max-[800px]:hidden"
        >
          <a
            className="text-[#a0a1aa] no-underline transition-colors duration-[160ms] hover:text-[#f7f8f8] motion-reduce:transition-none"
            href="#how-it-works"
          >
            How it works
          </a>
          <a
            className="text-[#a0a1aa] no-underline transition-colors duration-[160ms] hover:text-[#f7f8f8] motion-reduce:transition-none"
            href="#principles"
          >
            Why code
          </a>
          <a
            className="text-[#a0a1aa] no-underline transition-colors duration-[160ms] hover:text-[#f7f8f8] motion-reduce:transition-none"
            href={docs}
          >
            Documentation
          </a>
        </nav>
        <a
          className="flex items-center gap-1.5 text-[#a0a1aa] no-underline transition-colors duration-[160ms] hover:text-[#f7f8f8] motion-reduce:transition-none"
          href={github}
        >
          <Github size={15} /> GitHub
        </a>
      </header>

      <section className="relative isolate" id="top">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#08090b]">
          <Silk color="#a0a1aa" noiseIntensity={1.1} rotation={-0.16} scale={1.1} speed={3.6} />
          <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,9,11,0.8)_0%,rgba(8,9,11,0.58)_44%,rgba(8,9,11,0.3)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[#08090b]" />
        </div>
        <div className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1400px] grid-cols-[minmax(360px,0.82fr)_minmax(560px,1.18fr)] items-center gap-[clamp(42px,5vw,72px)] pt-[clamp(72px,7vw,96px)] pb-[clamp(82px,8vw,112px)] max-[1040px]:grid-cols-1 max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:py-16 max-[800px]:pb-[72px]">
        <div className="flex max-w-[520px] flex-col items-start max-[1040px]:max-w-[760px]">
          <p className="mb-5 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
            Open source · experimental
          </p>
          <h1 className="max-w-[620px] text-[clamp(3.15rem,5vw,4.75rem)] leading-[0.98] font-[640] tracking-[-0.035em] text-balance max-[560px]:text-[clamp(2.75rem,13vw,3.6rem)]">
            Product demos that behave like software.
          </h1>
          <p className="mt-7 max-w-[58ch] text-[16px] leading-[1.68] text-pretty text-[#a0a1aa]">
            Define the workflow in TypeScript. Playwright captures the real
            product. Remotion renders a repeatable video you can version,
            review, and regenerate. This preview is a real Talento SaaS
            workflow rendered by Democraft.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <a
              className="inline-flex min-h-[43px] items-center gap-2 rounded-[7px] bg-[#f7f8f8] px-4 text-[13px] font-[650] text-[#08090b] no-underline transition-[background-color,border-color,transform] duration-[160ms] hover:-translate-y-px hover:bg-[#dedfe3] motion-reduce:transition-none"
              href={docs}
            >
              Read the docs <ArrowRight size={16} />
            </a>
            <a
              className="inline-flex min-h-[43px] items-center gap-2 rounded-[7px] border border-white/10 px-4 text-[13px] font-[650] text-[#f7f8f8] no-underline transition-[background-color,border-color,transform] duration-[160ms] hover:-translate-y-px hover:border-white/20 motion-reduce:transition-none"
              href={github}
            >
              <Github size={16} /> View on GitHub
            </a>
          </div>
        </div>
        <figure className="m-0 min-w-0 max-[1040px]:mt-3 max-[1040px]:w-full">
          <video
            className="block aspect-video w-full rounded-[9px] bg-[#050507] object-cover saturate-[0.94] shadow-[0_0_0_1px_rgba(247,248,248,0.07)]"
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

      <section className="py-[clamp(80px,8vw,112px)]">
        <div className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1200px] grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)] items-center gap-[clamp(48px,6vw,80px)] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:grid-cols-1 max-[800px]:gap-10">
          <div>
            <p className="mb-4 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
              One file, one real workflow
            </p>
            <h2 className="max-w-[620px] text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.04] font-[610] tracking-[-0.03em] text-balance">
              Author the path—not the take.
            </h2>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.68] text-pretty text-[#a0a1aa]">
              Semantic targets, browser actions, camera direction, and overlays
              live together in TypeScript. The definition remains
              understandable long after the product changes.
            </p>
            <a
              className="mt-5 inline-flex items-center gap-[7px] text-[13px] font-semibold text-[#d7d7dc] no-underline transition-colors hover:text-white"
              href="/en/docs/sdk/define-demo"
            >
              Explore the authoring API <ArrowRight size={15} />
            </a>
          </div>
          <CodePanel />
        </div>
      </section>

      <HowItWorks />
      <ProductPrinciples />
      <Comparison />

      <section className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1200px] grid-cols-[0.68fr_1.32fr] gap-[clamp(52px,7vw,88px)] border-t border-white/10 py-[clamp(96px,10vw,144px)] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:grid-cols-1 max-[800px]:gap-[42px]">
        <div>
          <p className="mb-4 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
            Local workflow
          </p>
          <h2 className="max-w-[620px] text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.04] font-[610] tracking-[-0.03em] text-balance">
            Capture when the product is running. Iterate when it isn’t.
          </h2>
          <p className="mt-[18px] mb-6 max-w-[620px] text-[15px] leading-[1.72] text-pretty text-[#a0a1aa]">
            Compatible captures can be reused for presentation-only edits. The
            local Studio provides a frame-accurate preview and render workflow
            without turning the landing page into a fake interface.
          </p>
        </div>
        <InstallCommand />
      </section>

      <FAQ />

      <section className="mx-auto w-[calc(100%_-_3rem)] max-w-[1200px] border-t border-white/10 py-[clamp(94px,10vw,132px)] text-center max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px]">
        <h2 className="mx-auto max-w-[620px] text-[clamp(2.8rem,5.3vw,4.65rem)] leading-[0.98] font-[640] tracking-[-0.035em] text-balance">
          Stop re-recording demos.
        </h2>
        <p className="mx-auto mt-5 mb-7 text-[16px] text-[#a0a1aa]">
          Start versioning the experience that explains your product.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <a
            className="inline-flex min-h-[43px] items-center gap-2 rounded-[7px] bg-[#f7f8f8] px-4 text-[13px] font-[650] text-[#08090b] no-underline transition-[background-color,border-color,transform] duration-[160ms] hover:-translate-y-px hover:bg-[#dedfe3] motion-reduce:transition-none"
            href={docs}
          >
            Start with documentation <ArrowRight size={16} />
          </a>
          <a
            className="inline-flex min-h-[43px] items-center gap-2 rounded-[7px] border border-white/10 px-4 text-[13px] font-[650] text-[#f7f8f8] no-underline transition-[background-color,border-color,transform] duration-[160ms] hover:-translate-y-px hover:border-white/20 motion-reduce:transition-none"
            href={github}
          >
            <Github size={16} /> Open GitHub
          </a>
        </div>
      </section>

      <footer className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center gap-5 border-t border-white/10 py-[26px] text-[11px] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:grid-cols-1">
        <a
          className="flex items-center gap-2.5 font-[650] text-[#f7f8f8] no-underline"
          href="#top"
        >
          <BrandMark />
          <span>Democraft</span>
        </a>
        <div className="flex gap-[18px] max-[800px]:flex-wrap">
          <a className="text-[#a0a1aa] no-underline hover:text-[#f7f8f8]" href={docs}>Documentation</a>
          <a className="text-[#a0a1aa] no-underline hover:text-[#f7f8f8]" href="/en/docs/examples/basic">Example</a>
          <a className="text-[#a0a1aa] no-underline hover:text-[#f7f8f8]" href="/en/docs/contribute/development">Contribute</a>
          <a className="text-[#a0a1aa] no-underline hover:text-[#f7f8f8]" href={github}>GitHub</a>
        </div>
        <span className="justify-self-end text-[#a0a1aa] max-[800px]:justify-self-start">MIT License</span>
      </footer>
    </main>
  );
}
