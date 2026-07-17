import {
  ArrowRight,
  AudioLines,
  CirclePlay,
  Code2,
  Film,
  KeyRound,
  PanelsTopLeft,
} from "lucide-react";
import { CodePanel } from "./code-panel";

type CapabilityWorkbenchProps = {
  docsHref: (path: string) => string;
};

const workflowCode = `import { byTestId, defineDemo } from "@democraft/core";

export default defineDemo({
  id: "publish-release",
  title: "Publish a release",
  source: { baseUrl: "http://localhost:3000" },
  targets: {
    release: byTestId("release-name"),
    publish: byTestId("publish-release"),
  },
  async run({ demo }) {
    await demo.scene("publish", async (scene) => {
      await scene.goto("/releases/new");
      await scene.fill("release", "Summer launch");
      await scene.click("publish");
      await scene.focus("publish");
      await scene.caption("The release is live.");
    });
  },
});`;

const audioCode = `audioTracks: [
  {
    id: "launch-score",
    src: "./assets/launch.mp3",
    kind: "music",
    volume: 0.24,
    loop: true,
    fadeIn: "800ms",
    fadeOut: "1s",
  },
  {
    id: "published",
    src: "./assets/chime.wav",
    kind: "sfx",
    startAt: "12.5s",
    volume: 0.7,
  },
],`;

const authCode = `authentication: {
  profileId: "auth_01arz3ndektsv4rrffq69g5fav",
},

// One-time local setup:
// democraft auth create --name "Demo admin" \\
//   --origin https://app.example.com \\
//   --validation-url /dashboard
// democraft auth login <profile-id>
// democraft auth validate <profile-id>`;

const visualCode = `visuals: {
  "local.launch-title": defineVisual(SoftBlurIn),
},
async run({ demo }) {
  await demo.scene("intro", async (scene) => {
    await scene.visual(
      "local.launch-title",
      { text: "Ready to ship", speed: 1.2 },
      { duration: "1.5s" },
    );
  });
}`;

export async function CapabilityWorkbench({
  docsHref,
}: CapabilityWorkbenchProps) {
  return (
    <section
      className="landing-container landing-section"
      id="capabilities"
      aria-labelledby="capability-heading"
    >
      <div className="mb-12 grid grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)] gap-20 max-[800px]:grid-cols-1 max-[800px]:gap-5">
        <div>
          <p className="landing-kicker mb-4">How the pieces work together</p>
          <h2 className="landing-heading" id="capability-heading">
            One demo definition controls the entire video.
          </h2>
        </div>
        <p className="landing-copy self-end">
          Start with the browser actions a user should see. Add authentication,
          audio, and React visuals to that same definition. Democraft keeps the
          browser capture separate from presentation, so you can change the edit
          without repeating the product flow.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--landing-border)]">
        <ol className="grid list-none grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch border-b border-[var(--landing-border-subtle)] p-0 max-[800px]:grid-cols-1">
          <PipelineStep
            icon={<Code2 size={15} />}
            label="Define"
            title="Describe the user journey in demo.ts"
            detail="Targets, scenes, auth, audio, and visuals stay reviewable in source control."
          />
          <PipelineArrow />
          <PipelineStep
            icon={<CirclePlay size={15} />}
            label="Capture"
            title="Playwright runs your real application"
            detail="It restores the session, performs the flow, and records reusable browser evidence."
          />
          <PipelineArrow />
          <PipelineStep
            icon={<Film size={15} />}
            label="Render"
            title="Remotion produces the final MP4"
            detail="Camera, cursor, captions, sound, and React overlays become a repeatable video."
          />
        </ol>

        <div className="grid grid-cols-[1.25fr_0.75fr] max-[1000px]:grid-cols-2 max-[800px]:grid-cols-1">
          <div className="flex min-w-0 flex-col border-r border-[var(--landing-border-subtle)] max-[800px]:border-r-0">
            <article className="min-w-0 p-6 max-[560px]:p-4">
              <CapabilityHeader
                label="demo.ts / workflow"
                title="Describe exactly what the viewer should see"
                detail="Tell Democraft which app to open and which user actions to perform. Each scene becomes a readable, version-controlled part of the demo."
                href={docsHref("/en/docs/sdk/define-demo")}
              />
              <div className="mt-5">
                <CodePanel
                  code={workflowCode}
                  path="acme-app / demos"
                  filename="release.demo.ts"
                  label="A complete TypeScript demo workflow"
                  compact
                />
              </div>
            </article>

            <article className="min-w-0 border-t border-[var(--landing-border-subtle)] p-6 max-[560px]:p-4">
              <CapabilityHeader
                label="demo.ts / authentication"
                icon={<KeyRound size={15} />}
                title="Open private pages without putting secrets in code"
                detail="Attach a local profile ID to the same demo. Democraft validates the saved browser session before capture; passwords, tokens, and cookies never enter demo.ts."
                href={docsHref("/en/docs/guides/authentication")}
              />
              <div className="mt-5">
                <CodePanel
                  code={authCode}
                  path="demo.ts + terminal"
                  filename="authentication"
                  label="Authentication profile lifecycle"
                  compact
                />
              </div>
            </article>
          </div>

          <div className="flex min-w-0 flex-col max-[800px]:border-t max-[800px]:border-[var(--landing-border-subtle)]">
            <article className="min-w-0 p-6 max-[560px]:p-4">
              <CapabilityHeader
                label="demo.ts / audioTracks"
                icon={<AudioLines size={15} />}
                title="Mix music and sound without re-running the app"
                detail="Add audio tracks to the same definition. Sound is composed during render, so timing, volume, loops, and fades can change while the browser capture stays reusable."
                href={docsHref("/en/docs/guides/audio")}
              />
              <div className="mt-5">
                <CodePanel
                  code={audioCode}
                  path="demo.ts"
                  filename="audioTracks"
                  label="Audio track configuration"
                  compact
                />
              </div>
            </article>

            <article className="min-w-0 border-t border-[var(--landing-border-subtle)] p-6 max-[560px]:p-4">
              <CapabilityHeader
                label="demo.ts / visuals"
                icon={<PanelsTopLeft size={15} />}
                title="Place type-safe React visuals on the timeline"
                detail="Register a Remotion-compatible component once, then call it from a scene. TypeScript checks the renderer ID and props before the video is rendered."
                href={docsHref("/en/docs/concepts/components")}
              />
              <div className="mt-5">
                <CodePanel
                  code={visualCode}
                  path="acme-app / src"
                  filename="launch.demo.ts"
                  label="Typed custom React visual"
                  compact
                />
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilityHeader({
  label,
  icon,
  title,
  detail,
  href,
}: {
  label: string;
  icon?: React.ReactNode;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--landing-muted)]">
        <span>{label}</span>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <h3 className="text-[18px] leading-[25px] font-medium text-[var(--landing-foreground)]">
        {title}
      </h3>
      <p className="mt-2 max-w-[56ch] text-[14px] leading-[22px] text-[var(--landing-foreground-secondary)]">
        {detail}
      </p>
      <a className="landing-link mt-3 text-[13px]" href={href}>
        Read the guide <ArrowRight size={13} />
      </a>
    </div>
  );
}

function PipelineStep({
  icon,
  label,
  title,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="min-w-0 p-5 max-[560px]:p-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--landing-muted)]">
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <strong className="block text-[15px] leading-5 font-medium text-[var(--landing-foreground)]">
        {title}
      </strong>
      <p className="mt-2 text-[13px] leading-5 text-[var(--landing-muted)]">
        {detail}
      </p>
    </li>
  );
}

function PipelineArrow() {
  return (
    <li
      className="flex w-10 items-center justify-center text-[var(--landing-subtle)] max-[800px]:h-8 max-[800px]:w-full"
      aria-hidden="true"
    >
      <ArrowRight className="max-[800px]:rotate-90" size={14} />
    </li>
  );
}
