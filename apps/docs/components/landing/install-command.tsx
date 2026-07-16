"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

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
      className="absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-md border border-white/10 bg-[#111216] text-[#a0a1aa] transition-colors hover:border-white/20 hover:text-[#f7f8f8]"
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
      <CodeBlock
        allowCopy={false}
        className="m-0 border-white/10 bg-[#111216] text-[#dfe0e3]"
      >
        <Pre className="pr-12 text-[12px] leading-[1.5]">
          <code>{command}</code>
        </Pre>
      </CodeBlock>
      <CopyCommandButton command={command} />
    </div>
  );
}

export function InstallCommand() {
  const [manager, setManager] = useState<keyof typeof commands>("npm");

  return (
    <div className="max-w-full">
      <div className="flex gap-5 border-b border-white/10" role="tablist">
        {(Object.keys(commands) as Array<keyof typeof commands>).map((item) => (
          <button
            aria-selected={manager === item}
            className={`border-b py-2 text-sm font-medium transition-colors ${
              manager === item
                ? "border-white text-[#f7f8f8]"
                : "border-transparent text-[#8f9098] hover:text-[#f7f8f8]"
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
