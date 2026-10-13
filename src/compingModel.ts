import type { AnimatedStudy } from './ProgressionDemo';
import { isBlack } from './pianoModel';
import type { Change, Note, PianoData, Relationship } from './musicTypes';

export type HandOrder = '3-7' | '7-3';
const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function tone(change: Change, degree: number, interval: number, midi: number): Note {
  const letter = letters[(letters.indexOf(change.root.letter) + degree - 1) % 7];
  const pc = (natural[change.root.letter] + change.root.accidental + interval + 12) % 12;
  const accidental = (pc - natural[letter] + 18) % 12 - 6;
  return { midi, start: change.start, duration: change.duration, spelling: { letter, accidental },
    octave: (midi - natural[letter] - accidental) / 12 - 1 };
}

/** Teaching arrangement: rootless 3/7 in LH, 5/9 in RH, without melody.
 * Major triads/sixths are explicitly extended to maj7/9 for this demonstration.
 */
export function buildComping(study: AnimatedStudy, order: HandOrder): AnimatedStudy {
  const data: PianoData = { ...study.data, melody: [], left: [], right: [], changes: [] };
  let previous: number[] | undefined;
  const steps = study.steps.map(step => ({ ...step }));
  for (const [index, change] of study.data.changes.entries()) {
    const minor = /minor|diminished/.test(change.quality);
    const major = change.quality.startsWith('major');
    const intervals = [minor ? 3 : 4, major || change.quality === 'minor-major-seventh' ? 11 : change.quality === 'diminished-seventh' ? 9 : 10,
      change.quality.includes('diminished') ? 6 : 7, change.quality === 'dominant-flat-ninth' ? 1 : 2];
    const degrees = [3, 7, 5, 9];
    const root = (natural[change.root.letter] + change.root.accidental + 12) % 12;
    const pcs = intervals.map(n => (root + n) % 12);
    const lowIndex = order === '3-7' ? 0 : 1;
    const highIndex = 1 - lowIndex;
    const options: { pitches: number[]; cost: number }[] = [];
    for (let low = 48; low <= 64; low++) {
      if (low % 12 !== pcs[lowIndex]) continue;
      const high = low + ((pcs[highIndex] - low % 12 + 12) % 12);
      for (let fifth = high + 1; fifth <= high + 12; fifth++) {
        if (fifth % 12 !== pcs[2]) continue;
        const ninth = fifth + ((pcs[3] - fifth % 12 + 12) % 12);
        const pitches = [0, 0, fifth, ninth];
        pitches[lowIndex] = low; pitches[highIndex] = high;
        options.push({ pitches, cost: Math.abs(low - 55) + Math.max(0, ninth - 81) * 4 +
          (previous ? pitches.reduce((sum, p, i) => sum + Math.abs(p - previous![i]), 0) * 2 : 0) });
      }
    }
    options.sort((a, b) => a.cost - b.cost);
    if (!options.length) throw new Error('No playable comping register');
    previous = options[0].pitches;
    const notes = previous.map((midi, i) => tone(change, degrees[i], intervals[i], midi));
    const relationships: Relationship[] = notes.map((note, i) => ({ note, hand: i < 2 ? 'left' : 'right',
      roles: [i === 2 && intervals[i] === 6 ? 'b5' : i === 3 && intervals[i] === 1 ? 'b9' : String(degrees[i])], bass: false }));
    data.left.push(...notes.slice(0, 2)); data.right.push(...notes.slice(2));
    data.changes.push({ ...change, bass: null, keyboardTones: notes.map((n, i) => ({ degree: degrees[i],
      label: relationships[i].roles[0], letter: n.spelling.letter, pitchClass: n.midi % 12 })),
      relationships: Array.from({ length: change.duration }, (_, t) => ({ tick: change.start + t, notes: relationships })) });
    if (['major-sixth', 'major-triad'].includes(change.quality)) {
      steps[index].label = change.root.letter + (change.root.accidental < 0 ? '♭'.repeat(-change.root.accidental) : '♯'.repeat(change.root.accidental)) + 'maj9';
    }
  }
  const pitches = [...data.left, ...data.right].map(n => n.midi);
  let low = Math.min(...pitches) - 2, high = Math.max(...pitches) + 2;
  while (isBlack(low)) low--;
  while (isBlack(high)) high++;
  return { ...study, data, steps, keyRange: [low, high], arrangementNote: undefined };
}

/** Hear the actual chord root, even when the saved solo arrangement uses a pedal bass. */
export function withChordRoots(study: AnimatedStudy): AnimatedStudy {
  const left: Note[] = [];
  const changes = study.data.changes.map(change => {
    const pc = (natural[change.root.letter] + change.root.accidental + 12) % 12;
    const root = tone(change, 1, 0, 36 + pc);
    left.push(root);
    return { ...change, relationships: change.relationships.map(frame => ({ ...frame,
      notes: [...frame.notes.filter(n => n.hand === 'melody'), { note: root, hand: 'left' as const, roles: ['1'], bass: true }] })) };
  });
  return { ...study, data: { ...study.data, left, right: [], changes } };
}
