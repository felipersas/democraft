import type { ReactNode } from "react";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  run: () => void;
  /** Disabled commands are filtered out of results. */
  disabled?: boolean;
};
