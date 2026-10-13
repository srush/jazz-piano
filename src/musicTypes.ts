export type Spelling = { letter: string; accidental: number };
export type Note = { midi: number; start: number; duration: number; spelling: Spelling; octave: number };
export type Relationship = { hand: 'melody' | 'left' | 'right'; note: Note; roles: string[]; bass: boolean };
export type Change = {
  start: number; duration: number; root: Spelling; quality: string; bass: Spelling | null;
  required: string[]; relationships: { tick: number; notes: Relationship[] }[];
  keyboardTones: { degree: number; label: string; letter: string; pitchClass: number }[];
};
export type PianoData = {
  schemaVersion: 1; ticksPerQuarter: number; title: string; length: number;
  melody: Note[]; left: Note[]; right: Note[]; changes: Change[];
};
export type HarmonyData = PianoData & { proof: string; checks: string[] };
