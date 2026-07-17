import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "ghost" | "outline" | "primary";
type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--studio-surface-3)] text-[var(--studio-fg)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border-strong)]",
  ghost:
    "bg-transparent text-[var(--studio-fg-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]",
  outline:
    "bg-transparent text-[var(--studio-fg)] border border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)]",
  primary:
    "bg-[var(--studio-accent)] text-[#09090b] hover:bg-[var(--studio-accent-hover)] font-semibold",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs rounded-md",
  md: "h-10 px-3.5 text-sm rounded-md",
  icon: "h-8 w-8 rounded-md grid place-items-center",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 transition-colors duration-100 disabled:opacity-50 disabled:pointer-events-none select-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
