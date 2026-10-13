import { useEffect, useRef, useState } from 'react';
import { TRAIL_MS, voiceTrail } from './voiceLeadingModel';

export type InnerVoice = { midi: number; x: number };

/** Voices follow low-to-high register across hands, not their changing chord roles. */
export function VoiceLeading({ voices, y }: { voices: InnerVoice[]; y: number }) {
  const signature = voices.map(v => `${v.midi}:${v.x}`).join('|');
  const previous = useRef(voices.map(v => v.x));
  const [motion, setMotion] = useState(() => voices.map(v => voiceTrail(v.x, v.x, 0)));
  useEffect(() => {
    const target = voices.map(v => v.x);
    const origin = target.map((x, i) => previous.current[i] ?? x);
    previous.current = target;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotion(target.map(x => voiceTrail(x, x, 0)));
      return;
    }
    let frame = 0;
    const start = performance.now();
    const update = (now: number) => {
      setMotion(target.map((x, i) => voiceTrail(origin[i], x, now - start)));
      if (now - start < TRAIL_MS) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
    // Melody ticks must not restart an inner voice's trail.
  }, [signature]);
  return <g className="jp-voice-leading" role="group" aria-label="Inner voices moving from previous keys to current keys">
    {voices.map((voice, i) => {
      const m = motion[i] ?? voiceTrail(voice.x, voice.x, 0);
      const row = y + i * 7;
      const arrow = Math.min(2, Math.abs(m.head - m.tail) / 2);
      return <g key={i} data-voice={i} data-pitch={voice.midi}>
        <path d={`M ${m.tail} ${row} L ${m.head} ${row} M ${m.head - m.direction * arrow} ${row - arrow} L ${m.head} ${row} L ${m.head - m.direction * arrow} ${row + arrow}`}
          fill="none" stroke="#596168" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round" opacity={m.opacity * .45} />
      </g>;
    })}
  </g>;
}
