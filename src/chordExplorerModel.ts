import type { Note, PianoData, Relationship, Spelling } from './musicTypes';

export const FIFTHS = [
  { name: 'C', letter: 'C', accidental: 0, pc: 0 },
  { name: 'G', letter: 'G', accidental: 0, pc: 7 },
  { name: 'D', letter: 'D', accidental: 0, pc: 2 },
  { name: 'A', letter: 'A', accidental: 0, pc: 9 },
  { name: 'E', letter: 'E', accidental: 0, pc: 4 },
  { name: 'B', letter: 'B', accidental: 0, pc: 11 },
  { name: 'F#', letter: 'F', accidental: 1, pc: 6 },
  { name: 'Db', letter: 'D', accidental: -1, pc: 1 },
  { name: 'Ab', letter: 'A', accidental: -1, pc: 8 },
  { name: 'Eb', letter: 'E', accidental: -1, pc: 3 },
  { name: 'Bb', letter: 'B', accidental: -1, pc: 10 },
  { name: 'F', letter: 'F', accidental: 0, pc: 5 },
] as const;
export type RootName = typeof FIFTHS[number]['name'];
export type ChordQuality = 'major' | 'dominant' | 'minor';
export type ChordSelection = { root: RootName; quality: ChordQuality; ninth: boolean };
export const DEFAULT_CHORD: ChordSelection = { root: 'C', quality: 'dominant', ninth: true };
export const QUALITIES = [
  { value: 'major', label: 'Major', third: 4, seventh: 11, suffix: 'maj' },
  { value: 'dominant', label: 'Dom', third: 4, seventh: 10, suffix: '' },
  { value: 'minor', label: 'Minor', third: 3, seventh: 10, suffix: 'm' },
] as const;
export const displayRoot = (name: string) => name.replace('#', '♯').replace('b', '♭');

/** Clockwise, with C at twelve o'clock. Used by mouse, pen, and touch. */
export function fifthsIndex(x: number, y: number): number {
  const angle = Math.atan2(x, -y);
  return ((Math.round(angle / (Math.PI / 6)) % 12) + 12) % 12;
}

/** Interactive study data, not a Lean certificate. Spelling follows degree
 * letters, including E# in F# major and Cb in Ab minor. No MIDI respelling table.
 */
export function buildChord(selection: ChordSelection): PianoData {
  const root = FIFTHS.find(r => r.name === selection.root);
  const quality = QUALITIES.find(q => q.value === selection.quality);
  if (!root || !quality) throw new RangeError('Unsupported chord root or quality');
  const rootPc = root.pc;
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  const rootIndex = letters.indexOf(root.letter);
  function tone(degree: number, semitones: number, label: string) {
    const index = (rootIndex + degree - 1) % 7;
    const pitchClass = (rootPc + semitones) % 12;
    const accidental = ((pitchClass - naturals[index] + 18) % 12) - 6;
    return { degree, semitones, label, letter: letters[index], pitchClass, accidental };
  }
  const tones = [tone(3, quality.third, quality.third === 3 ? 'b3' : '3'), tone(5, 7, '5'),
    tone(7, quality.seventh, quality.seventh === 10 ? 'b7' : '7'), tone(9, 14, '9')];
  const rootMidi = 36 + root.pc;
  // Keep the rootless 3–5–7–9 stack in the middle register, within one octave.
  const voicingRoot = 60 + root.pc - (root.pc > 5 ? 12 : 0);
  function note(midi: number, spelling: Spelling): Note {
    const natural = naturals[letters.indexOf(spelling.letter)];
    return { midi, spelling: { letter: spelling.letter, accidental: spelling.accidental },
      octave: (midi - natural - spelling.accidental) / 12 - 1,
      start: 0, duration: 8 };
  }
  const bass = note(rootMidi, { letter: root.letter, accidental: root.accidental });
  const third = note(voicingRoot + quality.third, tones[0]);
  const rightTones = tones.slice(1).filter(t => selection.ninth || t.degree !== 9);
  // Third, fifth, seventh, ninth form one compact ascending stack.
  const right = rightTones.map(t => note(voicingRoot + t.semitones, t));
  const relationships: Relationship[] = [
    { hand: 'left', note: bass, roles: ['1'], bass: true },
    { hand: 'left', note: third, roles: [tones[0].label], bass: false },
    ...right.map((n, i) => ({ hand: 'right' as const, note: n, roles: [rightTones[i].label], bass: false })),
  ];
  const suffix = quality.suffix + (selection.ninth ? '9' : '7');
  return {
    schemaVersion: 1, ticksPerQuarter: 2, title: displayRoot(root.name) + suffix,
    length: 8, melody: [], left: [bass, third], right,
    changes: [{ start: 0, duration: 8, root: { letter: root.letter, accidental: root.accidental },
      quality: suffix, bass: null, required: [tones[0].label, tones[2].label],
      keyboardTones: tones.map(({ degree, label, letter, pitchClass }) => ({ degree, label, letter, pitchClass })),
      relationships: Array.from({ length: 8 }, (_, tick) => ({ tick, notes: relationships })),
    }],
  };
}
