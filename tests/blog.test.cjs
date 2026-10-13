const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createPlaybackCoordinator } = require('../build/piano-tests/playbackCoordinator.cjs');
const { buildComping, withChordRoots } = require('../build/piano-tests/compingModel.cjs');
const { playbackEvents } = require('../build/piano-tests/pianoModel.cjs');
const studies = JSON.parse(fs.readFileSync('public/generated/studies.json')).studies;
const blue = studies.find(s => s.data.title === 'Blue Room');

test('one playback owner: loading replacement and stale cleanup cannot stop the new owner', () => {
  const coordinator = createPlaybackCoordinator();
  const stopped = [];
  const oldLease = coordinator.claim(() => stopped.push('loading piano'));
  coordinator.claim(() => stopped.push('recording'));
  oldLease();
  assert.deepEqual(stopped, ['loading piano']);
  coordinator.claim(() => stopped.push('second piano'));
  assert.deepEqual(stopped, ['loading piano', 'recording']);
  coordinator.stop(); coordinator.stop();
  assert.deepEqual(stopped, ['loading piano', 'recording', 'second piano']);
});

test('both comping inversions use the requested hand roles without melody or bass', () => {
  for (const order of ['3-7', '7-3']) {
    const result = buildComping(blue, order);
    assert.equal(result.data.melody.length, 0);
    assert.equal(result.data.length, blue.data.length);
    for (const change of result.data.changes) {
      const notes = change.relationships[0].notes;
      assert.equal(notes.length, 4);
      const left = notes.filter(n => n.hand === 'left').sort((a,b) => a.note.midi-b.note.midi);
      assert.deepEqual(left.map(n => n.roles[0]), order.split('-'));
      assert.deepEqual(notes.filter(n => n.hand === 'right').map(n => n.roles[0]), ['5','9']);
      assert.ok(notes.every(n => !n.bass && n.hand !== 'melody'));
      assert.ok(left[1].note.midi - left[0].note.midi <= 12);
      assert.ok(notes[3].note.midi - notes[2].note.midi <= 12);
      assert.ok(Math.max(...left.map(n=>n.note.midi)) < notes[2].note.midi);
    }
    assert.ok(playbackEvents(result.data, 'implementation', 0, false, 'comping').every(n => n.hand !== 'melody'));
  }
  assert.ok(blue.data.melody.length > 0, 'source stays unchanged');
});

test('root lesson uses chord roots and preserves the melody', () => {
  const result = withChordRoots(blue);
  const naturals = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  assert.deepEqual(result.data.melody, blue.data.melody);
  for (const c of result.data.changes) {
    const bass = c.relationships[0].notes.find(n => n.bass);
    assert.equal(bass.note.midi % 12, (naturals[c.root.letter]+c.root.accidental+12)%12);
    assert.ok(c.relationships[0].notes.every(n => n.bass || n.hand === 'melody'));
  }
});

test('draft visual blocks resolve, including the complete 32-bar solo arrangement', () => {
  const draft = fs.readFileSync('content/blue-room.md','utf8');
  const blocks = [...draft.matchAll(/```visual\n([\s\S]*?)\n```/g)].map(m => JSON.parse(m[1]));
  assert.equal(blocks.length, 12);
  for (const b of blocks) if (b.study && b.study !== 'blue-room-full') assert.ok(studies.some(s => s.data.title === b.study), b.study);
  const full = JSON.parse(fs.readFileSync('public/generated/blue-room-full.json'));
  assert.equal(full.data.length / full.data.ticksPerQuarter / 4, 32);
  assert.equal(full.steps.at(-1).roman, '32');
  assert.ok(full.data.melody.length > blue.data.melody.length);
});

test('combo mixes inversions, leaves rhythmic space, and preserves bass and optional melody', () => {
  const {buildCombo} = require('../build/piano-tests/compingModel.cjs');
  const combo=buildCombo(blue);
  assert.deepEqual(combo.steps.map(s=>s.label),blue.steps.map(s=>s.label));
  const orders=new Set();
  const events=playbackEvents(combo.data,'implementation',0,true,'full');
  for (const c of combo.data.changes) {
    const attack=c.relationships[0].notes;
    assert.equal(attack.filter(n=>!n.bass && n.hand!=='melody').length,4,'all four voices attack on the chord change');
    for(const r of attack.filter(n=>n.hand!=='melody')) {
      assert.ok(events.some(e=>e.hand===r.hand && e.midi===r.note.midi && e.start===c.start),'bass and chords scheduled on change');
    }
    const sounding=c.relationships.find(f=>f.notes.some(n=>!n.bass && n.hand==='left'));
    const shell=sounding.notes.filter(n=>!n.bass && n.hand==='left').sort((a,b)=>a.note.midi-b.note.midi);
    orders.add(shell.map(n=>n.roles[0]).join('-'));
    assert.ok(c.relationships.every(f=>f.notes.filter(n=>n.bass).length===1));
    assert.ok(c.relationships.some(f=>!f.notes.some(n=>!n.bass && n.hand!=='melody')),'space between chord attacks');
  }
  assert.deepEqual([...orders].sort(),['3-7','7-3']);
  assert.deepEqual(combo.data.melody,blue.data.melody);
  assert.deepEqual(events.filter(e=>e.hand==='melody'),playbackEvents(blue.data,'implementation',0,true,'full').filter(e=>e.hand==='melody'),'melody timing is unchanged');
  const without=buildCombo(blue,false);
  assert.deepEqual(without.data.melody,[]);
  assert.deepEqual(without.data.left,combo.data.left);
  assert.deepEqual(without.data.right,combo.data.right);
  assert.ok(playbackEvents(combo.data,'implementation',0,true,'full').some(n=>n.hand==='melody'));
  for(const n of combo.data.melody) assert.ok(fs.existsSync(`public/audio/tenor-sax/${n.midi-12}.mp3`));
});

test('comping holds visual voices and saved solo follows shared-hand texture', () => {
  const {buildCombo}=require('../build/piano-tests/compingModel.cjs');
  const comp=buildCombo(blue);
  for(const c of comp.visualData.changes) for(const f of c.relationships)
    assert.equal(f.notes.filter(n=>!n.bass && n.hand!=='melody').length,4);
  const solo=JSON.parse(fs.readFileSync('public/generated/blue-room-full.json'));
  for(const c of solo.data.changes) {
    const attack=c.relationships[0].notes;
    assert.equal(attack.filter(r=>r.hand!=='melody').length,4);
    for(const role of c.required) {
      assert.ok(attack.some(r=>r.roles.includes(role)),`essential ${role} at ${c.start}`);
    }
    for(const f of c.relationships) {
      const pitches=f.notes.map(r=>r.note.midi).sort((a,b)=>a-b);
      for(let i=0;i<pitches.length;i++) for(let j=i+1;j<pitches.length;j++)
        assert.ok(!(pitches[j]-pitches[i]>=13 && (pitches[j]-pitches[i])%12===1),`minor ninth at ${f.tick}`);
      const m=f.notes.find(r=>r.hand==='melody');
      if(m) assert.ok(f.notes.filter(r=>r.hand!=='melody').every(r=>r.note.midi<m.note.midi));
    }
  }
});

test('shared-hand solo sounds bass alongside melody and inner tones', () => {
  const solo=JSON.parse(fs.readFileSync('public/generated/blue-room-full.json'));
  assert.equal(solo.muteBass,false);
  const events=playbackEvents(solo.data,'implementation',0,true,'full',solo.muteBass);
  for(const c of solo.data.changes) {
    const bass=c.relationships[0].notes.find(r=>r.bass);
    assert.ok(events.some(e=>e.hand==='left' && e.midi===bass.note.midi && e.start===c.start && e.duration===c.duration));
    const attack=events.filter(e=>e.start<=c.start && e.start+e.duration>c.start);
    assert.equal(attack.length,c.relationships[0].notes.some(r=>r.hand==='melody')?5:4);
  }
});

test('simplified solo only uses 3/5/7/9 accompaniment and matching Blue Room labels', () => {
  const solo=JSON.parse(fs.readFileSync('public/generated/blue-room-full.json'));
  assert.deepEqual(solo.steps.slice(0,blue.steps.length).map(s=>s.label),blue.steps.map(s=>s.label));
  for(const c of solo.data.changes) {
    assert.ok(!['major-sixth','dominant-13th','major-triad'].includes(c.quality));
    assert.ok(c.keyboardTones.every(t=>[3,5,7,9].includes(t.degree)));
    for(const f of c.relationships) for(const r of f.notes.filter(r=>!r.bass && r.hand!=='melody'))
      assert.ok(r.roles.every(role=>['3','5','7','9','b9'].includes(role)));
  }
});

test('solo shares inner voices with hand spans including the sounding bass and melody', () => {
  const solo=JSON.parse(fs.readFileSync('public/generated/blue-room-full.json'));
  for(const c of solo.data.changes) {
    const notes=c.relationships[0].notes;
    const left=notes.filter(r=>r.hand==='left').map(r=>r.note.midi);
    const right=notes.filter(r=>r.hand==='right' || r.hand==='melody').map(r=>r.note.midi);
    assert.ok([2,3].includes(left.length));
    assert.equal(notes.filter(r=>r.hand!=='melody' && !r.bass).length,3);
    assert.ok(Math.max(...left)-Math.min(...left)<=12);
    assert.ok(Math.max(...right)-Math.min(...right)<=12);
    assert.ok(Math.max(...left)<Math.min(...right));
  }
});

test('Autumn Leaves plays a full chorus with pickup, alternate ending, and four sections', () => {
  const song=studies.find(s=>s.data.title==='Autumn Leaves');
  const {data}=song;
  assert.equal(data.length-song.pickupTicks,32*4*data.ticksPerQuarter);
  assert.deepEqual(song.sections,[{label:'A1',start:0},{label:'A2',start:70},{label:'B',start:134},{label:'C',start:198}]);
  assert.equal(song.steps.at(-1).roman,'32');
  const events=playbackEvents(data,'implementation',0,true,'full');
  assert.deepEqual(events.filter(n=>n.hand==='melody' && n.start<6).map(n=>n.midi),[62,64,65]);
  assert.ok(events.some(n=>n.hand==='melody' && n.start+n.duration===data.length),'final tonic sustains through the ending');
  assert.notDeepEqual(data.melody.filter(n=>n.start>=134).map(n=>n.midi),data.melody.filter(n=>n.start<134).map(n=>n.midi),'closing half is not a loop');
  for(const c of data.changes.filter(c=>c.start>=6)) {
    const attack=c.relationships[0].notes;
    assert.equal(attack.filter(n=>n.hand!=='melody' && !n.bass).length,3);
    assert.ok(attack.some(n=>n.bass));
    for(const role of c.required) assert.ok(attack.some(n=>n.roles.includes(role)));
    for(const f of c.relationships) for(const n of f.notes) {
      assert.ok(n.note.start<=f.tick && n.note.start+n.note.duration>f.tick);
      assert.ok(n.note.midi>=36 && n.note.midi<=84);
      if(!n.bass && n.hand!=='melody') assert.ok(n.roles.every(r=>['3','5','7','9','b9'].includes(r)));
    }
  }
});
