const { test } = require('node:test');
const assert = require('node:assert/strict');
const { majorScale, majorScaleOctave } = require('../build/piano-tests/scaleModel.cjs');
test('all twelve scales retain seven distinct letters and the major interval pattern', () => {
  for (const root of ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F']) {
    const tones = majorScale(root);
    assert.equal(new Set(tones.map(t => t.name[0])).size, 7);
    assert.deepEqual(tones.map(t => (t.pc - tones[0].pc + 12) % 12), [0,2,4,5,7,9,11]);
    assert.deepEqual(tones.map(t => t.color), ['root','light','dark','pale','light','pale','dark']);
  }
});
test('sharp and flat keys use functional scale spelling', () => {
  assert.deepEqual(majorScale('F#').map(t => t.name), ['F♯','G♯','A♯','B','C♯','D♯','E♯']);
  assert.deepEqual(majorScale('Db').map(t => t.name), ['D♭','E♭','F','G♭','A♭','B♭','C']);
});

test('every scale runs in pitch order from its tonic to the tonic one octave higher', () => {
  for (const root of ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F']) {
    const notes = majorScaleOctave(root);
    assert.deepEqual(notes.map(n => n.midi - notes[0].midi), [0,2,4,5,7,9,11,12]);
    assert.deepEqual(notes.map(n => n.degree), [1,2,3,4,5,6,7,1]);
    assert.equal(notes[0].name, notes.at(-1).name);
    assert.ok(notes.every(n => n.midi % 12 === n.pc));
    assert.equal(notes.filter(n => n.color === 'root').length, 2);
  }
});
