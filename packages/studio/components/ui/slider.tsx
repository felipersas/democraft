"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onValueChange?: (value: number) => void;
  trackClassName?: string;
  rangeClassName?: string;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    { className, trackClassName, rangeClassName, value, onValueChange, ...props },
    ref,
  ) => {
    const min = Number(props.min ?? 0);
    const max = Number(props.max ?? 100);
    const pct = ((Number(value ?? 0) - min) / (max - min)) * 100;
    return (
      <div
        className={cn(
          "relative flex items-center w-full h-4 group",
          trackClassName,
        )}
      >
        <div
          className="absolute inset-x-0 h-1 rounded-full bg-[var(--color-border)]"
          aria-hidden
        />
        <div
          className={cn(
            "absolute h-1 rounded-full bg-[var(--color-accent)] pointer-events-none",
            rangeClassName,
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        <input
          ref={ref}
          type="range"
          value={value ?? 0}
          onChange={(e) => onValueChange?.(Number(e.target.value))}
          className={cn(
            `relative z-10 w-full appearance-none bg-transparent cursor-pointer h-4
             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow
             [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
             [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
             [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0`,
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";
