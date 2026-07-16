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
      className="landing-container landing-section grid grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] gap-24 max-[800px]:grid-cols-1 max-[800px]:gap-10"
      id="how-it-works"
    >
      <div>
        <p className="landing-kicker mb-4">The pipeline</p>
        <h2 className="landing-heading">
          From product flow to a repeatable render.
        </h2>
      </div>
      <ol className="m-0 list-none border-t border-[var(--landing-border-subtle)] p-0">
        {steps.map(([title, description], index) => (
          <li
            className="group grid min-h-16 grid-cols-[32px_1fr_16px] gap-3 border-b border-[var(--landing-border-subtle)] py-4 transition-colors duration-[90ms] hover:bg-[var(--landing-surface-1)] max-[560px]:grid-cols-[24px_1fr]"
            key={title}
          >
            <span className="text-[13px] leading-[26px] font-medium text-[var(--landing-subtle)]">
              0{index + 1}
            </span>
            <div>
              <h3 className="mb-1 text-[18px] leading-[26px] font-medium">
                {title}
              </h3>
              <p className="landing-copy max-w-[58ch]">{description}</p>
            </div>
            <ArrowRight
              className="self-center text-[var(--landing-subtle)] transition-colors duration-[90ms] group-hover:text-[var(--landing-muted)] max-[560px]:hidden"
              size={14}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProductPrinciples() {
  return (
    <section className="landing-container landing-section" id="principles">
      <div className="mb-16 max-w-[680px]">
        <p className="landing-kicker mb-4">Why code</p>
        <h2 className="landing-heading">
          Video direction with an engineering memory.
        </h2>
      </div>
      <div className="grid grid-cols-2 max-[560px]:grid-cols-1">
        {principles.map(([title, description]) => (
          <article
            className="min-h-36 border-t border-[var(--landing-border-subtle)] py-6 pr-10 even:border-l even:border-l-[var(--landing-border-subtle)] even:pr-0 even:pl-10 max-[560px]:min-h-0 max-[560px]:px-0 max-[560px]:even:border-l-0"
            key={title}
          >
            <h3 className="mb-1 text-[18px] leading-[26px] font-medium">
              {title}
            </h3>
            <p className="landing-copy max-w-[58ch]">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Comparison() {
  return (
    <section className="landing-container landing-section grid grid-cols-[0.68fr_1.32fr] gap-20 max-[800px]:grid-cols-1 max-[800px]:gap-10">
      <div>
        <p className="landing-kicker mb-4">The comparison</p>
        <h2 className="landing-heading">
          Less take management. More product iteration.
        </h2>
      </div>
      <div className="border-t border-[var(--landing-border-subtle)] text-[15px] leading-6">
        <div className="grid min-h-10 grid-cols-[1.1fr_0.9fr_1.25fr] items-center gap-4 border-b border-[var(--landing-border-subtle)] py-2 text-[13px] leading-5 font-medium text-[var(--landing-muted)] max-[560px]:grid-cols-2">
          <span className="max-[560px]:hidden">Workflow</span>
          <span>Manual recording</span>
          <span>Democraft</span>
        </div>
        {rows.map(([label, manual, democraft]) => (
          <div
            className="grid min-h-10 grid-cols-[1.1fr_0.9fr_1.25fr] items-center gap-4 border-b border-[var(--landing-border-subtle)] py-2 transition-colors duration-[90ms] hover:bg-[var(--landing-surface-1)] max-[560px]:grid-cols-2 max-[560px]:py-3"
            key={label}
          >
            <strong className="font-medium max-[560px]:col-span-2">
              {label}
            </strong>
            <span className="text-[var(--landing-muted)]">{manual}</span>
            <span className="flex items-center gap-2 text-[var(--landing-foreground-secondary)]">
              <Check
                className="shrink-0 text-[var(--landing-accent)]"
                aria-hidden="true"
                size={14}
              />{" "}
              {democraft}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section className="landing-container landing-section grid grid-cols-[0.7fr_1.3fr] gap-20 max-[800px]:grid-cols-1 max-[800px]:gap-10">
      <div>
        <p className="landing-kicker mb-4">FAQ</p>
        <h2 className="landing-heading">Designed for a developer workflow.</h2>
      </div>
      <div className="border-t border-[var(--landing-border-subtle)]">
        {faqs.map(([question, answer]) => (
          <details
            className="group border-b border-[var(--landing-border-subtle)]"
            key={question}
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between py-3 text-[18px] leading-[26px] font-medium transition-colors duration-[90ms] hover:text-[var(--landing-foreground-secondary)] [&::-webkit-details-marker]:hidden">
              {question}
              <span
                className="text-[18px] leading-none font-light text-[var(--landing-muted)] transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="landing-copy mr-8 pb-4">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
