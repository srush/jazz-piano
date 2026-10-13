const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const model = require('../build/piano-tests/pianoModel.cjs');
const { schedulePiano, loadPiano, sampleMidi, RELEASE_SECONDS } = require('../build/piano-tests/pianoAudio.cjs');
const data = JSON.parse(readFileSync(join(__dirname, '../public/generated/example.json'), 'utf8'));

test('the actual exported example has four fixed color families, with a reference-only ninth', () => {
  for (const change of data.changes) {
    assert.deepEqual(change.keyboardTones.map(t => t.degree).sort((a,b) => a-b), [3,5,7,9]);
  }
  const cMajor = data.changes[2];
  const passingD = model.atTick(cMajor, 18).find(r => r.hand === 'melody');
  assert.deepEqual(passingD.roles, []); // The display must not change the proof contract.
  assert.equal(model.keyRole(cMajor, 74, passingD).color, 'ninth');
  assert.equal(new Set(Object.values(model.COLORS)).size, 6);
});

test('bass is excluded from playback; other LH notes and melody remain', () => {
  const events = model.playbackEvents(data, 'implementation', 0);
  assert.equal(events.length, 18);
  for (const midi of [50,43,48]) assert.ok(!events.some(e => e.midi === midi));
  assert.deepEqual(events.filter(e => e.hand === 'left').map(e => [e.midi,e.start,e.duration]),
    [[53,0,8],[53,8,8],[52,16,8]]);
  assert.deepEqual(events.filter(e => e.hand === 'melody').map(e => [e.midi,e.start,e.duration]),
    data.melody.map(n => [n.midi,n.start,n.duration]));
});

test('seeking clips held notes without adding attacks on every tick', () => {
  const events = model.playbackEvents(data, 'implementation', 3);
  assert.deepEqual(events.filter(e => e.start === 3).map(e => [e.midi,e.duration]), [[72,1],[53,5],[60,5]]);
  assert.equal(events.filter(e => e.midi === 60).length, 1);
  assert.equal(model.playbackEvents(data, 'head', 0).length, data.melody.length);
  assert.deepEqual(model.playbackEvents(data, 'head', data.length), []);
});

test('slash bass is muted by role; a melody root is still played', () => {
  const custom = structuredClone(data);
  const frame = custom.changes[0].relationships[0];
  const bass = frame.notes.find(r => r.hand === 'left' && r.bass);
  bass.note.midi = 52; bass.note.spelling = { letter:'E', accidental:0 };
  bass.roles = ['9']; // A slash bass can have another harmonic function.
  const melody = frame.notes.find(r => r.hand === 'melody');
  melody.note.midi = 74; melody.note.spelling = {letter:'D',accidental:0}; melody.bass = true;
  const events = model.playbackEvents(custom, 'implementation', 0);
  assert.ok(!events.some(e => e.start === 0 && e.midi === 52));
  assert.ok(events.some(e => e.start === 0 && e.midi === 74 && e.hand === 'melody'));
});

test('a held note becoming bass is silenced without losing its earlier sound', () => {
  const custom = structuredClone(data);
  for (const frame of custom.changes[0].relationships) {
    const f = frame.notes.find(r => r.hand === 'left' && r.note.midi === 53);
    if (frame.tick >= 4) f.bass = true;
  }
  const held = model.playbackEvents(custom, 'implementation', 0).find(e => e.midi === 53);
  assert.equal(held.duration, 4);
});

test('altered chord tones retain their families and functional spelling', () => {
  const a7b9 = { keyboardTones: [
    {degree:3,label:'3',letter:'C',pitchClass:1},
    {degree:5,label:'5',letter:'E',pitchClass:4},
    {degree:7,label:'b7',letter:'G',pitchClass:7},
    {degree:9,label:'b9',letter:'B',pitchClass:10},
  ] };
  assert.equal(model.keyRole(a7b9,61).color, 'third');
  assert.equal(model.keyRole(a7b9,70).color, 'ninth');
  assert.equal(model.referenceName(a7b9,61), 'C♯4');
  assert.equal(model.referenceName(a7b9,70), 'B♭4');
  const db = { note:{spelling:{letter:'D',accidental:-1}},hand:'melody' };
  assert.equal(model.keyRole(a7b9,61,db).color, undefined);
  const f = model.atTick(data.changes[0],0).find(r => r.note.midi === 53);
  assert.equal(model.keyRole(data.changes[0],53,f).color, 'third');
});

test('keyboard includes every supplied piano key and has correctly placed black keys', () => {
  const keys = model.keyboardRange(data);
  for (const n of [...data.melody,...data.left,...data.right]) assert.ok(keys.includes(n.midi));
  assert.equal(model.isBlack(60),false);
  assert.equal(model.isBlack(61),true);
  assert.equal(model.isBlack(65),false);
  assert.equal(model.frequency(69),440);
});

test('sampled piano preserves timing, transposition, release, and silent bass', () => {
  const voices = [];
  const parameter = () => ({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const context = {
    destination:{},
    createGain:() => ({gain:parameter(),connect(n){return n;},disconnect(){}}),
    createDynamicsCompressor:() => ({connect(n){return n;},disconnect(){}}),
    createBufferSource:() => {
      const voice = {playbackRate:parameter(),connect(n){return n;},disconnect(){},
        start(t){this.on=t;},stop(t){this.off=t;}};
      voices.push(voice); return voice;
    },
  };
  const events = model.playbackEvents(data,'implementation',0);
  const samples = new Map(events.map(e => [sampleMidi(e.midi), {sample:sampleMidi(e.midi)}]));
  const stop = schedulePiano(context,events,10,0,0.3,samples);
  assert.equal(voices.length,events.length);
  events.forEach((event,index) => {
    const voice = voices[index];
    assert.equal(voice.buffer.sample,sampleMidi(event.midi));
    assert.equal(voice.playbackRate.value,2 ** ((event.midi-sampleMidi(event.midi))/12));
    assert.equal(voice.on,10+event.start*0.3);
    assert.ok(Math.abs(voice.off-voice.on-event.duration*0.3-RELEASE_SECONDS) < 1e-10);
    assert.ok(![50,43,48].includes(event.midi));
  });
  for(let midi=21;midi<=108;midi++) assert.ok(Math.abs(midi-sampleMidi(midi))<=1);
  stop();
  assert.ok(voices.every(v => v.off === undefined));
});

test('sample loading deduplicates recordings, caches decoding, and retries failures', async () => {
  const originalFetch = global.fetch;
  const urls = [];
  let decodes = 0;
  const context = {decodeAudioData: async () => ({decoded:++decodes})};
  const events = [{midi:60},{midi:61},{midi:60}];
  try {
    global.fetch = async url => { urls.push(url); return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}; };
    const samples = await loadPiano(context,events);
    await loadPiano(context,events);
    assert.equal(samples.size,1);
    assert.deepEqual(urls,['/audio/salamander/C4.mp3']);
    assert.equal(decodes,1);
    global.fetch = async () => ({ok:false});
    await assert.rejects(loadPiano(context,[{midi:69}]),/unavailable/);
    global.fetch = async () => ({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
    assert.equal((await loadPiano(context,[{midi:69}])).size,1);
  } finally { global.fetch = originalFetch; }
});

test('optional bass adds the original root timing without changing the voicing or head', () => {
  const silent = model.playbackEvents(data, 'implementation', 0);
  const full = model.playbackEvents(data, 'implementation', 0, true);
  const added = full.filter(e => !silent.some(s => JSON.stringify(s) === JSON.stringify(e)));
  assert.deepEqual(added.map(e => [e.midi,e.start,e.duration]), [[50,0,8],[43,8,8],[48,16,8]]);
  assert.deepEqual(model.playbackEvents(data,'head',0,true), model.playbackEvents(data,'head',0));
  assert.deepEqual(model.playbackEvents(data,'implementation',3,true).find(e=>e.midi===50),
    {midi:50,start:3,duration:5,hand:'left'});
});

const { voiceTrail, TRAIL_MS } = require('../build/piano-tests/voiceLeadingModel.cjs');
test('voice trails travel from the previous key toward the next key in both directions', () => {
  for (const [from,to] of [[40,100],[100,40]]) {
    const direction = Math.sign(to-from);
    let previousHead = from, previousTail = from;
    for(let elapsed=0;elapsed<=TRAIL_MS;elapsed+=10) {
      const t=voiceTrail(from,to,elapsed);
      assert.ok((t.head-previousHead)*direction >= -1e-9);
      assert.ok((t.tail-previousTail)*direction >= -1e-9);
      assert.ok((t.head-t.tail)*direction >= -1e-9);
      assert.ok(t.head>=Math.min(from,to) && t.head<=Math.max(from,to));
      previousHead=t.head; previousTail=t.tail;
    }
    assert.equal(voiceTrail(from,to,0).head,from);
    assert.equal(voiceTrail(from,to,TRAIL_MS).head,to);
    assert.equal(voiceTrail(from,to,TRAIL_MS).tail,to);
    assert.equal(voiceTrail(from,to,TRAIL_MS).opacity,0);
  }
  assert.equal(voiceTrail(40,40,200).opacity,0);
});

test('part selection filters audio and highlighted relationships identically', () => {
  for (const parts of ['melody','melody-root','full']) {
    const events = model.playbackEvents(data,'implementation',0,false,parts);
    for (let tick=0;tick<data.length;tick++) {
      const relationships=model.atTick(model.currentChange(data,tick),tick);
      const selected=relationships.filter(r=>model.includesPart(r,parts));
      const expected=relationships.filter(r=>r.hand==='melody' || parts==='full' || (parts==='melody-root' && r.bass && r.hand==='left'));
      assert.deepEqual(selected,expected);
      const sounding=events.filter(e=>e.start<=tick && tick<e.start+e.duration);
      assert.deepEqual(sounding.map(e=>`${e.hand}:${e.midi}`).sort(),selected.map(r=>`${r.hand}:${r.note.midi}`).sort());
      if(parts==='melody') assert.ok(selected.every(r=>r.hand==='melody'));
      if(parts==='melody-root') assert.ok(selected.every(r=>r.hand==='melody' || r.bass));
    }
    const seek = model.playbackEvents(data,'implementation',9,false,parts);
    assert.ok(seek.every(e=>e.start>=9));
  }
});

test('tenor melody and piano can use the same pitch with separate samples', async () => {
  const originalFetch=global.fetch;
  const urls=[];
  try {
    global.fetch=async url=>{urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};};
    const samples=await loadPiano({decodeAudioData:async()=>({})},[{midi:60,hand:'melody'},{midi:60,hand:'right'}],'tenor-sax');
    assert.ok(samples.has(-48)); assert.ok(samples.has(60));
    assert.notEqual(samples.get(-48),samples.get(60));
    assert.ok(urls.includes('/audio/tenor-sax/48.mp3'));
  } finally {global.fetch=originalFetch;}
});
