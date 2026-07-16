import { ArrowRight, Check } from "lucide-react";

const steps = [
  [
    "Define",
    "Declare targets and scenes in the TypeScript file that belongs with your product.",
  ],
  [
    "Capture",
    "Playwright runs the real flow and records screenshots, a video, a trace, and environment metadata.",
  ],
  [
    "Direct",
    "Democraft resolves the capture into a timeline for camera, cursor, transitions, captions, callouts, and visuals.",
  ],
  [
    "Render",
    "Remotion turns that resolved timeline and its captured assets into a repeatable MP4.",
  ],
];

const principles = [
  [
    "Real browser evidence",
    "The application is exercised in Playwright instead of recreated for a recording.",
  ],
  [
    "Capture once",
    "Compatible captured artifacts stay useful while the presentation changes.",
  ],
  [
    "Typed, semantic targets",
    "Targets use roles, labels, text, and test IDs—not an anonymous pile of selectors.",
  ],
  [
    "Reviewable production",
    "A demo is ordinary source code: diffable, versioned, and inspectable by people or agents.",
  ],
];

const faqs = [
  [
    "Is Democraft a screen recorder?",
    "No. It executes a declared browser workflow, keeps the resulting capture as evidence, and renders the presentation from that result.",
  ],
  [
    "How does Remotion fit in?",
    "Remotion renders the resolved timeline into MP4, including captured media, camera motion, cursor, captions, callouts, and custom visuals.",
  ],
  [
    "Can presentation changes reuse a capture?",
    "Yes, when the capture remains compatible with the definition. This is why capture and rendering are separate stages.",
  ],
  [
    "Can AI agents author demos?",
    "Yes. The public API is typed TypeScript, designed to be generated, validated, read, and reviewed by both agents and developers.",
  ],
];

const rows = [
  ["Source of truth", "A recorded take", "A typed demo definition"],
  ["Browser state", "Replayed by hand", "Executed by Playwright"],
  ["Presentation edits", "Record or edit again", "Reuse compatible captures"],
  ["Review", "Watch the output", "Review the workflow in code"],
  ["Automation", "Manual orchestration", "CLI capture and render"],
];

export function HowItWorks() {
  return (
    <section
      className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1200px] grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] gap-[clamp(54px,8vw,102px)] border-t border-white/10 py-[clamp(96px,10vw,144px)] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:grid-cols-1 max-[800px]:gap-[42px]"
      id="how-it-works"
    >
      <div>
        <p className="mb-4 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
          The pipeline
        </p>
        <h2 className="max-w-[620px] text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.04] font-[610] tracking-[-0.03em] text-balance">
          From product flow to a repeatable render.
        </h2>
      </div>
      <ol className="m-0 list-none border-t border-white/10 p-0">
        {steps.map(([title, description], index) => (
          <li
            className="grid grid-cols-[42px_1fr_18px] gap-3.5 border-b border-white/10 py-[23px]"
            key={title}
          >
            <span className="text-[11px] leading-[1.5] font-[650] text-[#8f9098]">
              0{index + 1}
            </span>
            <div>
              <h3 className="mb-[7px] text-[15px] font-[650]">{title}</h3>
              <p className="max-w-[58ch] text-[13px] leading-[1.6] text-[#a0a1aa]">
                {description}
              </p>
            </div>
            <ArrowRight className="self-center text-[#8f9098]" size={17} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProductPrinciples() {
  return (
    <section
      className="mx-auto w-[calc(100%_-_3rem)] max-w-[1200px] border-t border-white/10 py-[clamp(96px,10vw,144px)] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px]"
      id="principles"
    >
      <div className="mb-[58px] max-w-[680px]">
        <p className="mb-4 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
          Why code
        </p>
        <h2 className="max-w-[620px] text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.04] font-[610] tracking-[-0.03em] text-balance">
          Video direction with an engineering memory.
        </h2>
      </div>
      <div className="grid grid-cols-2 max-[560px]:grid-cols-1">
        {principles.map(([title, description]) => (
          <article
            className="min-h-[150px] border-t border-white/10 py-7 pr-[38px] even:border-l even:border-l-white/10 even:pr-0 even:pl-[38px] max-[560px]:min-h-0 max-[560px]:px-0 max-[560px]:py-6 max-[560px]:even:border-l-0 max-[560px]:even:px-0"
            key={title}
          >
            <h3 className="mb-[7px] text-[15px] font-[650]">{title}</h3>
            <p className="max-w-[58ch] text-[13px] leading-[1.6] text-[#a0a1aa]">
              {description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Comparison() {
  return (
    <section className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1200px] grid-cols-[0.68fr_1.32fr] gap-[clamp(52px,7vw,88px)] border-t border-white/10 py-[clamp(96px,10vw,144px)] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:grid-cols-1 max-[800px]:gap-[42px]">
      <div>
        <p className="mb-4 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
          The comparison
        </p>
        <h2 className="max-w-[620px] text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.04] font-[610] tracking-[-0.03em] text-balance">
          Less take management. More product iteration.
        </h2>
      </div>
      <div className="border-t border-white/10 text-[12px]">
        <div className="grid grid-cols-[1.1fr_0.9fr_1.25fr] items-center gap-4 border-b border-white/10 py-4 text-[11px] leading-[1.4] font-semibold text-[#a0a1aa] max-[560px]:grid-cols-2">
          <span className="max-[560px]:hidden">Workflow</span>
          <span>Manual recording</span>
          <span>Democraft</span>
        </div>
        {rows.map(([label, manual, democraft]) => (
          <div
            className="grid grid-cols-[1.1fr_0.9fr_1.25fr] items-center gap-4 border-b border-white/10 py-4 max-[560px]:grid-cols-2"
            key={label}
          >
            <strong className="font-[620] max-[560px]:col-span-2">{label}</strong>
            <span className="text-[#a0a1aa]">{manual}</span>
            <span className="flex items-center gap-[7px] text-[#d9dade]">
              <Check className="shrink-0 text-[#aeb0b7]" size={15} /> {democraft}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section className="mx-auto grid w-[calc(100%_-_3rem)] max-w-[1200px] grid-cols-[0.7fr_1.3fr] gap-[clamp(52px,7vw,88px)] py-[clamp(96px,10vw,144px)] max-[800px]:w-[calc(100%_-_2rem)] max-[800px]:max-w-[640px] max-[800px]:grid-cols-1 max-[800px]:gap-[42px]">
      <div>
        <p className="mb-4 text-[12px] leading-[1.4] font-semibold tracking-[-0.01em] text-[#8f9098]">
          FAQ
        </p>
        <h2 className="max-w-[620px] text-[clamp(2.25rem,4.1vw,3.5rem)] leading-[1.04] font-[610] tracking-[-0.03em] text-balance">
          Designed for a developer workflow.
        </h2>
      </div>
      <div className="border-t border-white/10">
        {faqs.map(([question, answer]) => (
          <details className="group border-b border-white/10 py-5" key={question}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-[620] [&::-webkit-details-marker]:hidden">
              {question}
              <span className="text-[19px] leading-[0.8] font-light text-[#aeb0b7] transition-transform duration-[160ms] group-open:rotate-45 motion-reduce:transition-none">
                +
              </span>
            </summary>
            <p className="mt-3.5 mr-[30px] max-w-[68ch] text-[13px] leading-[1.68] text-[#a0a1aa]">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
