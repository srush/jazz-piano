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
export function buildComping(study: AnimatedStudy, order: HandOrder | 'mixed'): AnimatedStudy {
  const data: PianoData = { ...study.data, melody: [], left: [], right: [], changes: [] };
  let previous: number[] | undefined;
  const steps = study.steps.map(step => ({ ...step }));
  for (const change of study.data.changes) {
    const minor = /minor|diminished/.test(change.quality);
    const major = change.quality.startsWith('major');
    const intervals = [minor ? 3 : 4, major || change.quality === 'minor-major-seventh' ? 11 : change.quality === 'diminished-seventh' ? 9 : 10,
      change.quality.includes('diminished') ? 6 : 7, change.quality === 'dominant-flat-ninth' ? 1 : 2];
    const degrees = [3, 7, 5, 9];
    const root = (natural[change.root.letter] + change.root.accidental + 12) % 12;
    const pcs = intervals.map(n => (root + n) % 12);
    const options: { pitches: number[]; cost: number }[] = [];
    for (const lowIndex of order === 'mixed' ? [0, 1] : [order === '3-7' ? 0 : 1]) {
    const highIndex = 1 - lowIndex;
    for (let low = 48; low <= 64; low++) {
      if (low % 12 !== pcs[lowIndex]) continue;
      const high = low + ((pcs[highIndex] - low % 12 + 12) % 12);
      for (let fifth = high + 1; fifth <= high + 12; fifth++) {
        if (fifth % 12 !== pcs[2]) continue;
        const ninth = fifth + ((pcs[3] - fifth % 12 + 12) % 12);
        const pitches = [0, 0, fifth, ninth];
        pitches[lowIndex] = low; pitches[highIndex] = high;
        options.push({ pitches, cost: Math.abs(low - 55) + Math.max(0, ninth - 81) * 4 +
          (previous ? (order === 'mixed' ? [...pitches].sort((a,b)=>a-b) : pitches).reduce((sum, p, i) => sum + Math.abs(p - (order === 'mixed' ? [...previous!].sort((a,b)=>a-b) : previous!)[i]), 0) * 2 : 0) });
      }
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

/** One voiced accompaniment, with chord attacks and root bass on each change. */
export function buildCombo(study: AnimatedStudy, sax = true): AnimatedStudy {
  const comp = buildComping(study, 'mixed');
  const rooted = withChordRoots(study);
  const left: Note[] = [], right: Note[] = [];
  const visualChanges: Change[] = [];
  const changes = comp.data.changes.map((change, i) => {
    const duration = Math.max(1, Math.min(change.duration, [2, 2, 2, 3][i % 4]));
    const chords = change.relationships[0].notes.map(r => ({ ...r,
      note: { ...r.note, start: change.start, duration } }));
    left.push(...chords.filter(r=>r.hand==='left').map(r=>r.note));
    right.push(...chords.filter(r=>r.hand==='right').map(r=>r.note));
    const bass = rooted.data.changes[i].relationships[0].notes.find(r=>r.bass)!;
    left.push(bass.note);
    visualChanges.push({ ...change, relationships: change.relationships.map(frame => ({ tick: frame.tick,
      notes: [bass, ...chords, ...(sax ? study.data.changes[i].relationships.find(f=>f.tick===frame.tick)?.notes.filter(r=>r.hand==='melody') ?? [] : [])] })) });
    return { ...change, relationships: change.relationships.map(frame => ({ tick: frame.tick,
      notes: [bass, ...chords.filter(r=>r.note.start<=frame.tick && frame.tick<r.note.start+r.note.duration),
        ...(sax ? study.data.changes[i].relationships.find(f=>f.tick===frame.tick)?.notes.filter(r=>r.hand==='melody') ?? [] : [])] })) };
  });
  const melody = sax ? study.data.melody : [];
  return { ...comp, data: { ...comp.data, left, right, melody, changes },
    visualData: { ...comp.data, left, right, melody, changes: visualChanges },
    steps: comp.steps.map((s,i)=>({...s,displayRoot:rooted.data.left[i].midi})),
    keyRange: [36, Math.max(comp.keyRange[1], ...melody.map(n=>n.midi))], includeBass:true };
}

/** Complete the four harmony slots, letting a chord-tone melody occupy its slot. */
export function withFourVoiceHarmony(study: AnimatedStudy): AnimatedStudy {
  const left = [...study.data.left], right = [...study.data.right];
  const changes = study.data.changes.map(change => {
    const minor = /minor|diminished/.test(change.quality);
    const sixth = change.quality === 'major-sixth';
    const slots = [[3, minor ? 3 : 4], [5, change.quality.includes('diminished') ? 6 : 7],
      [sixth ? 6 : 7, sixth || change.quality === 'diminished-seventh' ? 9 : change.quality.startsWith('major') || change.quality === 'minor-major-seventh' ? 11 : 10],
      [9, change.quality === 'dominant-flat-ninth' ? 1 : 2]];
    const root = (natural[change.root.letter]+change.root.accidental+12)%12;
    const additions = new Map<string, Note>();
    const relationships = change.relationships.map(frame => {
      const melodyNote = frame.notes.find(r=>r.hand==='melody');
      const melodyPc = melodyNote ? melodyNote.note.midi % 12 : -1;
      const melodyFillsSlot = slots.some(([,interval])=>(root+interval)%12===melodyPc);
      const notes = frame.notes.filter(r=>r.bass || r.hand==='melody' || !melodyFillsSlot || r.note.midi%12!==melodyPc);
      const melody = notes.find(r=>r.hand==='melody')?.note.midi ?? 77;
      const bass = notes.find(r=>r.bass)?.note.midi ?? 36;
      for(const [degree, interval] of slots) {
        const pc = (root+interval)%12;
        if(notes.some(r=>!r.bass && r.note.midi%12===pc)) continue;
        const candidates = Array.from({length:36},(_,i)=>48+i).filter(m=>m%12===pc && m<melody && m>bass);
        if(!candidates.length) throw new Error(`No inner voice for ${study.data.title} at ${frame.tick}`);
        const midi = candidates.sort((a,b)=>Math.abs(a-58)-Math.abs(b-58))[0];
        const id = `${degree}:${midi}`;
        let note = additions.get(id);
        if(!note || note.start+note.duration!==frame.tick) {
          note = {...tone(change,degree,interval,midi), start:frame.tick,duration:0};
          additions.set(id,note); right.push(note);
        }
        note.duration++;
        notes.push({note,hand:'right',roles:[String(degree)],bass:false});
      }
      return {...frame,notes};
    });
    const keyboardTones = [...change.keyboardTones];
    for (const [degree,interval] of slots) {
      if(keyboardTones.some(t=>t.degree===degree)) continue;
      const n=tone(change,degree,interval,60+(root+interval)%12);
      keyboardTones.push({degree,label:String(degree),letter:n.spelling.letter,pitchClass:(root+interval)%12});
    }
    return {...change,keyboardTones,relationships};
  });
  return {...study,data:{...study.data,left,right,changes}};
}
