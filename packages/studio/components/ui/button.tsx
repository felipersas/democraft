import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "ghost" | "outline" | "primary";
type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--color-bg-panel)] text-[var(--color-fg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)]",
  ghost:
    "bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-fg)]",
  outline:
    "bg-transparent text-[var(--color-fg)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]",
  primary:
    "bg-[var(--color-accent)] text-[#062019] hover:bg-[var(--color-accent-strong)] font-medium",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs rounded-md",
  md: "h-9 px-3 text-sm rounded-md",
  icon: "h-8 w-8 rounded-md grid place-items-center",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-muted)] select-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
