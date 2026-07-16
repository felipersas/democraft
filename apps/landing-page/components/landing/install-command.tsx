"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

const commands = {
  npm: "npx democraft studio examples/demo-app/src/demo.ts",
  pnpm: "pnpm exec democraft studio examples/demo-app/src/demo.ts",
  yarn: "yarn democraft studio examples/demo-app/src/demo.ts",
};

function CopyCommandButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function copyWithFallback() {
    const textarea = document.createElement("textarea");
    textarea.value = command;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  async function copyCommand() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(command);
      } else {
        copyWithFallback();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        copyWithFallback();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopied(false);
      }
    }
  }

  return (
    <button
      aria-label={copied ? "Command copied" : "Copy command"}
      title={copied ? "Command copied" : "Copy command"}
      className="absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-md border border-[var(--landing-border)] bg-[var(--landing-surface-2)] text-[var(--landing-muted)] transition-colors duration-[90ms] hover:bg-[var(--landing-hover)] hover:text-[var(--landing-foreground)]"
      onClick={copyCommand}
      type="button"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="relative">
      <pre className="m-0 overflow-x-auto rounded-md border border-[var(--landing-border)] bg-[var(--landing-surface-1)] px-3 py-3 pr-12 text-[12px] leading-[18px] text-[var(--landing-foreground-secondary)]">
        <code>{command}</code>
      </pre>
      <CopyCommandButton command={command} />
    </div>
  );
}

export function InstallCommand() {
  const [manager, setManager] = useState<keyof typeof commands>("npm");

  return (
    <div className="max-w-full">
      <div
        className="flex gap-1 border-b border-[var(--landing-border-subtle)]"
        role="tablist"
      >
        {(Object.keys(commands) as Array<keyof typeof commands>).map((item) => (
          <button
            aria-selected={manager === item}
            className={`min-h-8 border-b px-2 py-1 text-[12px] font-medium transition-colors duration-[90ms] ${
              manager === item
                ? "border-[var(--landing-accent)] text-[var(--landing-foreground)]"
                : "border-transparent text-[var(--landing-muted)] hover:bg-[var(--landing-hover)] hover:text-[var(--landing-foreground-secondary)]"
            }`}
            key={item}
            onClick={() => setManager(item)}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <div className="pt-4" role="tabpanel">
        <CommandBlock command={commands[manager]} />
      </div>
    </div>
  );
}
