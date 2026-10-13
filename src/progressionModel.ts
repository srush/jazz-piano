import { buildHandVoicing, FIFTHS, displayRoot, type RootName, type ChordSelection } from './chordExplorerModel';
import type { Note, PianoData } from './musicTypes';

export const PROGRESSION = [
  { label: 'Dm7', roman: 'ii', root: 'D', quality: 'minor', pitches: [53, 60, 64, 69], displayRoot: 38 },
  { label: 'G7', roman: 'V', root: 'G', quality: 'dominant', pitches: [53, 59, 62, 69], displayRoot: 43 },
  { label: 'Cmaj7', roman: 'I', root: 'C', quality: 'major', pitches: [52, 59, 62, 67], displayRoot: 36 },
] as const;

/** Choose the ii root; the next two roots move counterclockwise by fifths. */
export function progressionSteps(startRoot: RootName = 'D') {
  const index = FIFTHS.findIndex(r => r.name === startRoot);
  if (index < 0) throw new RangeError('Unsupported progression root');
  const shift = ((FIFTHS[index].pc - 2 + 18) % 12) - 6;
  return PROGRESSION.map((step, i) => {
    const root = FIFTHS[(index - i + 12) % 12].name;
    return { ...step, root, label: displayRoot(root) + ['m7', '7', 'maj7'][i],
      pitches: step.pitches.map(p => p + shift), displayRoot: 36 + FIFTHS[(index - i + 12) % 12].pc,
      start:i*8, duration:8 };
  });
}

/** Split hands: A (3–7 / 9–5), B (7–3 / 5–9), then A.
 * Retain common tones and move each voice by at most two semitones.
 */
export function buildProgression(startRoot: RootName = 'D'): PianoData {
  const result: PianoData = { schemaVersion: 1, ticksPerQuarter: 2, title: 'ii–V–I',
    length: 24, melody: [], left: [], right: [], changes: [] };
  progressionSteps(startRoot).forEach((step, i) => {
    const chord = buildHandVoicing({ root: step.root, quality: step.quality, ninth: true } as ChordSelection, i === 1 ? 2 : 1);
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
