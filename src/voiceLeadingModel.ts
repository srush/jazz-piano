export const TRAIL_MS = 520;

/** A stroke travels from the old key to the new key; its tail follows its head. */
export function voiceTrail(from: number, to: number, elapsed: number) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const headProgress = clamp(elapsed / 340);
  const tailProgress = clamp((elapsed - 110) / 410);
  return {
    tail: from + (to - from) * tailProgress,
    head: from + (to - from) * headProgress,
    direction: Math.sign(to - from),
    opacity: from === to ? 0 : clamp(elapsed / 45) * (1 - clamp((elapsed - 300) / 220)),
  };
}
