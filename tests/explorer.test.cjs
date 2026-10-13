const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildChord, FIFTHS, QUALITIES, fifthsIndex } = require('../build/piano-tests/chordExplorerModel.cjs');
const { playbackEvents, keyRole, noteName } = require('../build/piano-tests/pianoModel.cjs');

test('circle order moves in fifths and drag coordinates wrap at C', () => {
  FIFTHS.forEach((r,i) => {
    assert.equal((FIFTHS[(i+1)%12].pc-r.pc+12)%12,7);
    assert.equal(fifthsIndex(Math.sin(i*Math.PI/6)*110,-Math.cos(i*Math.PI/6)*110),i);
  });
  assert.equal(fifthsIndex(-1,-100),0);
  assert.equal(fifthsIndex(1,-100),0);
  assert.equal(fifthsIndex(100,0),3);
  assert.equal(fifthsIndex(-100,0),9);
});

test('every key, quality, and ninth setting produces spelled, bounded, bass-free audio', () => {
  const natural = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  for (const root of FIFTHS) for (const quality of QUALITIES) for (const ninth of [true,false]) {
    const data = buildChord({root:root.name,quality:quality.value,ninth});
    assert.equal(data.melody.length,0);
    assert.equal(data.left.length,2);
    assert.equal(data.right.length,ninth ? 3 : 2);
    const notes = [...data.left,...data.right];
    for (const n of notes) {
      assert.equal(n.midi,12*(n.octave+1)+natural[n.spelling.letter]+n.spelling.accidental);
      assert.ok(n.midi>=21 && n.midi<=108);
      assert.equal(n.start,0); assert.equal(n.duration,8);
    }
    assert.equal(data.left[0].midi%12,root.pc);
    assert.equal((data.left[1].midi-data.left[0].midi)%12,quality.third);
    const events = playbackEvents(data,'implementation',0);
    assert.equal(events.length,ninth ? 4 : 3);
    assert.ok(!events.some(e=>e.midi===data.left[0].midi));
    assert.equal(new Set(notes.map(n=>n.midi)).size,notes.length);
    assert.equal(data.changes[0].keyboardTones.length,4);
    assert.equal('proof' in data,false);
  }
});

test('major/dominant/minor change the intended third and seventh', () => {
  const degrees = quality => buildChord({root:'C',quality,ninth:false}).changes[0].keyboardTones.map(t=>t.pitchClass);
  assert.deepEqual(degrees('major'),[4,7,11,2]);
  assert.deepEqual(degrees('dominant'),[4,7,10,2]);
  assert.deepEqual(degrees('minor'),[3,7,10,2]);
});

test('spelling follows degree letters in sharp and flat keys', () => {
  const names = (root,quality) => {
    const d = buildChord({root,quality,ninth:true});
    return [...d.left,...d.right].map(noteName);
  };
  assert.deepEqual(names('A','major'),['A2','C♯4','E4','G♯4','B4']);
  assert.deepEqual(names('F#','major'),['F♯2','A♯3','C♯4','E♯4','G♯4']);
  assert.deepEqual(names('Db','minor'),['D♭2','F♭4','A♭4','C♭5','E♭5']);
  assert.ok(names('Ab','minor').includes('C♭4'));
});

test('ninth toggle removes sound but keeps reference color; families remain stable', () => {
  for (const ninth of [true,false]) {
    const d = buildChord({root:'C',quality:'dominant',ninth});
    const change = d.changes[0];
    assert.equal(keyRole(change,62).color,'ninth');
    assert.equal(keyRole(change,64).color,'third');
    assert.equal(keyRole(change,67).color,'fifth');
    assert.equal(keyRole(change,70).color,'seventh');
    assert.equal(playbackEvents(d,'implementation',0).some(e=>e.midi%12===2),ninth);
  }
});

test('runtime callers receive a clear error for unsupported selections', () => {
  assert.throws(()=>buildChord({root:'H',quality:'major',ninth:true}),RangeError);
  assert.throws(()=>buildChord({root:'C',quality:'diminished',ninth:true}),RangeError);
});


test('all rootless voicings stay compact and inside the fixed display range', () => {
  for (const root of FIFTHS) for (const quality of QUALITIES) {
    const d = buildChord({root:root.name,quality:quality.value,ninth:true});
    const pitches = playbackEvents(d,'implementation',0).map(e=>e.midi);
    assert.ok(pitches.every((p,i)=>i===0 || p>pitches[i-1]));
    assert.ok(pitches[3]-pitches[0] <= 11);
    assert.ok(pitches.every(p=>p>=53 && p<=81));
    const reference = d.left[0].midi + (root.pc>5 ? 12 : 24);
    assert.equal(reference%12,root.pc);
    assert.equal(pitches[0]-reference,quality.third);
    assert.ok(reference>=53 && reference<=81);
    const bass = playbackEvents(d,'implementation',0,true)[0];
    assert.equal(bass.midi,36+root.pc);
  }
});

test('ii–V–I has four chord tones, close voice leading, and correctly timed bass', () => {
  const {buildProgression,PROGRESSION} = require('../build/piano-tests/progressionModel.cjs');
  const d = buildProgression();
  const events = playbackEvents(d,'implementation',0);
  assert.equal(events.length,12);
  const natural = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  for (let i=0;i<3;i++) {
    const chordEvents=events.filter(e=>e.start===i*8);
    assert.ok(PROGRESSION[i].displayRoot < Math.min(...chordEvents.map(e=>e.midi)));
    assert.equal(PROGRESSION[i].displayRoot % 12, [2,7,0][i]);
    assert.deepEqual(chordEvents.map(e=>e.midi).sort((a,b)=>a-b),[...PROGRESSION[i].pitches]);
    assert.ok(chordEvents.every(e=>e.duration===8));
    const relations=d.changes[i].relationships[0].notes.filter(r=>!r.bass);
    assert.deepEqual(relations.map(r=>keyRole(d.changes[i],r.note.midi,r).color).sort(),['fifth','ninth','seventh','third']);
    for (const {note:n} of relations) assert.equal(n.midi,12*(n.octave+1)+natural[n.spelling.letter]+n.spelling.accidental);
    if(i>0) assert.ok(PROGRESSION[i].pitches.every((p,j)=>Math.abs(p-PROGRESSION[i-1].pitches[j])<=2));
  }
  const withBass=playbackEvents(d,'implementation',0,true);
  assert.equal(withBass.length,15);
  assert.deepEqual(withBass.filter(e=>[38,43,36].includes(e.midi)).map(e=>[e.midi,e.start,e.duration]),[[38,0,8],[43,8,8],[36,16,8]]);
});

test('Type 2 rotates the seventh and ninth below the third and fifth in every key', () => {
  for (const root of FIFTHS) for (const quality of QUALITIES) {
    const data = buildChord({root:root.name,quality:quality.value,ninth:true},2);
    const notes = data.changes[0].relationships[0].notes.filter(n=>!n.bass).sort((a,b)=>a.note.midi-b.note.midi);
    assert.deepEqual(notes.map(n=>n.roles[0]),[quality.seventh===10?'b7':'7','9',quality.third===3?'b3':'3','5']);
    assert.ok(notes.every(n=>n.note.midi>=48 && n.note.midi<=84));
    assert.ok(notes.at(-1).note.midi-notes[0].note.midi<12);
    assert.deepEqual(notes.map(n=>n.note.midi%12).sort((a,b)=>a-b),playbackEvents(buildChord({root:root.name,quality:quality.value,ninth:true}),'implementation',0).map(n=>n.midi%12).sort((a,b)=>a-b));
  }
});

test('scale view places the ninth above the seventh, within the fixed keyboard', () => {
  const {buildScaleChord} = require('../build/piano-tests/chordExplorerModel.cjs');
  for (const root of FIFTHS) {
    const data=buildScaleChord(root.name);
    const events=playbackEvents(data,'implementation',0,true);
    const tonic = 60 + root.pc - (60 + root.pc + 14 > 84 ? 12 : 0);
    assert.equal(data.left[0].midi,36+root.pc);
    assert.deepEqual(events.filter(n=>n.midi!==data.left[0].midi).map(n=>n.midi-tonic).sort((a,b)=>a-b),[4,7,11,14]);
    assert.ok(events.every(n=>n.midi>=36 && n.midi<=84));
    assert.equal(data.changes[0].relationships[0].notes.filter(n=>n.bass).length,1);
  }
});

test('ii–V–I transposes from every starting root without changing rhythm or voice leading', () => {
  const {buildProgression,progressionSteps}=require('../build/piano-tests/progressionModel.cjs');
  for(const root of FIFTHS) {
    const steps=progressionSteps(root.name), data=buildProgression(root.name);
    assert.equal(steps[0].root,root.name);
    assert.equal(data.length,24);
    for(let i=0;i<3;i++) {
      const c=data.changes[i], pitches=playbackEvents(data,'implementation',i*8).filter(e=>e.start===i*8).map(e=>e.midi).sort((a,b)=>a-b);
      assert.deepEqual(pitches,steps[i].pitches);
      const voices=c.relationships[0].notes.filter(r=>!r.bass);
      assert.deepEqual(voices.map(r=>r.hand),['left','left','right','right']);
      assert.deepEqual(voices.map(r=>Number(r.roles[0].replace('b',''))),i===1?[7,3,5,9]:[3,7,9,5]);
      assert.ok(steps[i].displayRoot < pitches[0]);
      assert.ok(pitches.every(p=>p>=36 && p<=84));
      if(i) {
        assert.equal((FIFTHS.find(r=>r.name===steps[i].root).pc-FIFTHS.find(r=>r.name===steps[i-1].root).pc+12)%12,5);
        assert.ok(pitches.every((p,j)=>Math.abs(p-steps[i-1].pitches[j])<=2));
      }
      assert.equal(c.start,i*8);
    }
  }
});

test('two-hand types preserve requested ordering and separate hands in every key and quality',()=>{
  const {buildHandVoicing}=require('../build/piano-tests/chordExplorerModel.cjs');
  for(const root of FIFTHS) for(const q of QUALITIES) for(const type of [1,2]) {
    const d=buildHandVoicing({root:root.name,quality:q.value,ninth:true},type);
    const voices=d.changes[0].relationships[0].notes.filter(r=>!r.bass);
    assert.deepEqual(voices.map(r=>Number(r.roles[0].replace('b',''))),type===1?[3,7,9,5]:[7,3,5,9]);
    assert.deepEqual(voices.map(r=>r.hand),['left','left','right','right']);
    assert.ok(voices.every((r,i)=>r.note.midi>=36 && r.note.midi<=84 && (!i || r.note.midi>voices[i-1].note.midi)));
  }
});
