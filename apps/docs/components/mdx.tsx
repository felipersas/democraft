import type { ComponentProps } from "react";
import defaultComponents from "fumadocs-ui/mdx";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

export function getMDXComponents() {
  return {
    ...defaultComponents,
    pre: (props: ComponentProps<"pre">) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
  };
}
