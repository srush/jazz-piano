import { PIANO_PALETTE } from './palette';
import { FIFTHS, type RootName } from './chordExplorerModel';

export const SCALE_COLORS = { ...PIANO_PALETTE, pale: '#fff' };
export function majorScale(rootName: RootName) {
  const root = FIFTHS.find(r => r.name === rootName);
  if (!root) throw new RangeError('Unsupported scale root');
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  return [0, 2, 4, 5, 7, 9, 11].map((interval, i) => {
    const index = (letters.indexOf(root.letter) + i) % 7;
    const pc = (root.pc + interval) % 12;
    const accidental = (pc - naturals[index] + 18) % 12 - 6;
    const degree = i + 1;
    const color = degree === 1 ? 'root' : [3, 7].includes(degree) ? 'dark' : [2, 5].includes(degree) ? 'light' : 'pale';
    return { pc, degree, name: letters[index] + '♯'.repeat(Math.max(0, accidental)) + '♭'.repeat(Math.max(0, -accidental)), color } as const;
  });
}

/** Ascending tonic-to-tonic pitches, including the upper octave tonic. */
export function majorScaleOctave(rootName: RootName) {
  const tones = majorScale(rootName);
  return [...tones, tones[0]].map((tone, i) => ({
    ...tone, midi: 60 + tones[0].pc + [0, 2, 4, 5, 7, 9, 11, 12][i],
  }));
}
