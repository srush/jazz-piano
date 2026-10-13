import type { Change, PianoData, Relationship } from './musicTypes';

export type ViewMode = 'head' | 'implementation';
export type PianoParts = 'melody' | 'melody-root' | 'full' | 'comping';

/** One selection rule for sound, key highlights, and movement trails. */
export function includesPart(r: Relationship, parts: PianoParts) {
  if (parts === 'comping') return r.hand !== 'melody' && !r.bass;
  return r.hand === 'melody' || parts === 'full' || (parts === 'melody-root' && r.bass && r.hand === 'left');
}
export type KeyColor = 'third' | 'fifth' | 'seventh' | 'ninth' | 'melody' | 'other';
export const COLORS: Record<KeyColor, string> = {
  third: '#2870b8', fifth: '#b97912', seventh: '#8454b3', ninth: '#c45270',
  melody: '#198573', other: '#52615d',
};
export const ROLE_NAMES: Record<KeyColor, string> = {
  third: '3rd', fifth: '5th', seventh: '7th', ninth: '9th', melody: 'Other melody', other: 'Other tone',
};
const family = (degree: number): KeyColor | undefined =>
  ({ 3: 'third', 5: 'fifth', 6: 'seventh', 7: 'seventh', 9: 'ninth', 11: 'ninth', 13: 'ninth' } as const)[degree as 3 | 5 | 6 | 7 | 9 | 11 | 13];

export const noteName = (n: Relationship['note']) => n.spelling.letter +
  (n.spelling.accidental > 0 ? '♯'.repeat(n.spelling.accidental) : '♭'.repeat(-n.spelling.accidental)) + n.octave;
export const isMutedBass = (r: Relationship) => r.hand === 'left' && r.bass;
export const currentChange = (data: PianoData, tick: number) =>
  data.changes.find(c => c.start <= tick && tick < c.start + c.duration)!;
export const atTick = (change: Change, tick: number) =>
  change.relationships.find(r => r.tick === tick)?.notes ?? [];

/** Reference keys are physical pitches; sounding notes also respect their spelling. */
export function keyRole(change: Change, midi: number, played?: Relationship) {
  const tone = change.keyboardTones.find(t => t.pitchClass === midi % 12 &&
    (!played || t.letter === played.note.spelling.letter));
  // A sixth replaces the seventh only on a sixth chord; otherwise it is color (13).
  const colorSixth = tone?.degree === 6 && !['major-sixth', 'minor-sixth'].includes(change.quality);
  return { color: tone ? family(colorSixth ? 13 : tone.degree) : undefined, label: colorSixth ? '13' : tone?.label };
}

export function referenceName(change: Change, midi: number) {
  const tone = change.keyboardTones.find(t => t.pitchClass === midi % 12);
  if (!tone) return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12] + (Math.floor(midi / 12) - 1);
  const natural = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[tone.letter];
  const accidental = ((midi % 12 - natural + 18) % 12) - 6;
  const octave = (midi - natural - accidental) / 12 - 1;
  return noteName({ midi, start: 0, duration: 1, spelling: { letter: tone.letter, accidental }, octave });
}

export type PlaybackEvent = { midi: number; start: number; duration: number; hand: Relationship['hand'] };

/** Clip a seek into held notes; never retrigger them at each visual tick/chord.
 * Silence only LH bass intervals, including a note that becomes bass mid-hold.
 */
export function playbackEvents(data: PianoData, mode: ViewMode, fromTick: number, includeBass = false, parts?: PianoParts, muteBass = false): PlaybackEvent[] {
  const result: PlaybackEvent[] = [];
  let live = new Map<string, PlaybackEvent>();
  for (let tick = fromTick; tick < data.length; tick++) {
    const next = new Map<string, PlaybackEvent>();
    for (const r of atTick(currentChange(data, tick), tick)) {
      if (muteBass && r.bass) continue;
      if (parts ? !includesPart(r, parts) : ((!includeBass && isMutedBass(r)) || (mode === 'head' && r.hand !== 'melody'))) continue;
      const id = `${r.hand}:${r.note.midi}:${r.note.start}:${r.note.duration}`;
      let event = live.get(id);
      if (!event) {
        event = { midi: r.note.midi, start: tick, duration: 0, hand: r.hand };
        result.push(event);
      }
      event.duration++;
      next.set(id, event);
    }
    live = next;
  }
  return result;
}

export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

/** Whole octaves around the study, capped to the actual 88-key piano. */
export function keyboardRange(data: PianoData) {
  const pitches = [...data.melody, ...data.left, ...data.right].map(n => n.midi);
  const low = Math.max(21, Math.floor(Math.min(60, ...pitches) / 12) * 12);
  const high = Math.min(108, Math.floor(Math.max(71, ...pitches) / 12) * 12 + 11);
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
