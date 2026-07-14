import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatTimecode(frame: number, fps: number): string {
  if (fps <= 0) return "0:00:00";
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.max(0, frame - Math.floor(totalSeconds) * fps);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${frames
    .toString()
    .padStart(2, "0")}`;
}

export function formatFrames(frame: number, total: number): string {
  return `${frame.toString().padStart(4, "0")} / ${total.toString().padStart(4, "0")}`;
}

/** Formats a millisecond duration as a compact "1m 23s" / "12s" / "980ms". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/** Truncates a filesystem path to its trailing segment(s) for compact UI. */
export function shortenPath(p: string, max = 42): string {
  if (p.length <= max) return p;
  const base = p.split("/").slice(-2).join("/");
  return "…" + base;
}

/** Clamps a frame index into the valid range [0, total-1] and rounds it. */
export function clampFrame(frame: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(frame)));
}

/** Truncates text to `max` chars, appending an ellipsis if cut. */
export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + "…";
}

