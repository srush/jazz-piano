/** Every sound source claims this lease before loading or starting audio. */
export function createPlaybackCoordinator() {
  let active: { stop: () => void } | undefined;
  return {
    claim(stop: () => void) {
      const previous = active;
      active = undefined;
      previous?.stop();
      const owner = { stop };
      active = owner;
      return () => { if (active === owner) active = undefined; };
    },
    stop() { const previous = active; active = undefined; previous?.stop(); },
  };
}
export const playback = createPlaybackCoordinator();
