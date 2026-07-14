/**
 * Generates a prefixed unique id using the timestamp + random recipe that was
 * duplicated in render-queue.nextJobId and render-presets.makePresetId.
 * Example: makeId("job") → "job_lr4k2p_a3f".
 */
export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
