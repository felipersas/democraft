export function parseDurationMs(duration: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(duration);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;

  return match[2] === "s" ? Math.round(value * 1000) : Math.round(value);
}
