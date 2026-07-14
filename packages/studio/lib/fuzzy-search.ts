import type { Command } from "@/components/command-palette/types";

/**
 * Lightweight fuzzy filter: matches if every query char appears in order in
 * the label (subsequence match), case-insensitive. Results are ranked by how
 * tightly they match (earlier consecutive matches score higher).
 */
export function fuzzySearch(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const scored: { cmd: Command; score: number }[] = [];
  for (const cmd of commands) {
    const score = subsequenceScore(cmd.label.toLowerCase(), q);
    if (score >= 0) scored.push({ cmd, score: score + matchBoost(cmd, q) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.cmd);
}

export function subsequenceScore(text: string, query: string): number {
  let ti = 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  while (ti < text.length && qi < query.length) {
    if (text[ti] === query[qi]) {
      consecutive += 1;
      score += consecutive; // reward runs of consecutive chars
      qi += 1;
    } else {
      consecutive = 0;
    }
    ti += 1;
  }
  return qi === query.length ? score : -1;
}

export function matchBoost(cmd: Command, query: string): number {
  // Boost commands whose label *starts* with the query or whose group matches.
  let boost = 0;
  if (cmd.label.toLowerCase().startsWith(query)) boost += 50;
  if (cmd.group.toLowerCase().includes(query)) boost += 10;
  return boost;
}
