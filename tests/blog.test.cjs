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
  assert.equal(blocks.length, 10);
  for (const b of blocks) if (b.study && b.study !== 'blue-room-full') assert.ok(studies.some(s => s.data.title === b.study), b.study);
  const full = JSON.parse(fs.readFileSync('public/generated/blue-room-full.json'));
  assert.equal(full.data.length / full.data.ticksPerQuarter / 4, 32);
  assert.equal(full.steps.at(-1).roman, '32');
  assert.ok(full.data.melody.length > blue.data.melody.length);
});
