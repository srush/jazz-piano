import { buildChord, type ChordSelection } from './chordExplorerModel';
import type { Note, PianoData } from './musicTypes';

export const PROGRESSION = [
  { label: 'Dm7', roman: 'ii', root: 'D', quality: 'minor', pitches: [65, 69, 72, 76], displayRoot: 62 },
  { label: 'G7', roman: 'V', root: 'G', quality: 'dominant', pitches: [65, 69, 71, 74], displayRoot: 55 },
  { label: 'Cmaj7', roman: 'I', root: 'C', quality: 'major', pitches: [64, 67, 71, 74], displayRoot: 60 },
] as const;

/** Original ii–V–I study: retain common tones, move the other voices by <= 2 semitones.
 * G7 is inverted (7–9–3–5) to connect the two 3–5–7–9 voicings smoothly.
 */
export function buildProgression(): PianoData {
  const result: PianoData = { schemaVersion: 1, ticksPerQuarter: 2, title: 'ii–V–I',
    length: 24, melody: [], left: [], right: [], changes: [] };
  PROGRESSION.forEach((step, i) => {
    const chord = buildChord({ root: step.root, quality: step.quality, ninth: true } as ChordSelection);
    const start = i * 8;
    const shift = (n: Note, bass: boolean): Note => {
      const midi = bass ? n.midi : step.pitches.find(p => p % 12 === n.midi % 12)!;
      return { ...n, midi, octave: n.octave + (midi - n.midi) / 12, start };
    };
    const notes = chord.changes[0].relationships[0].notes.map(r => ({ ...r, note: shift(r.note, r.bass) }));
    result.left.push(...notes.filter(r => r.hand === 'left').map(r => r.note));
    result.right.push(...notes.filter(r => r.hand === 'right').map(r => r.note));
    result.changes.push({ ...chord.changes[0], start,
      relationships: Array.from({ length: 8 }, (_, t) => ({ tick: start + t, notes })) });
  });
  return result;
}
