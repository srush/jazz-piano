import { useId, useState } from 'react';
import './harmony.css';
import { PianoPlayer } from './PianoPlayer';

import type { Spelling, Change, HarmonyData } from './musicTypes';
export type { Spelling, Note, Relationship, Change, HarmonyData, PianoData } from './musicTypes';

const spelling = (s: Spelling) => s.letter + (s.accidental > 0 ? '♯'.repeat(s.accidental) : '♭'.repeat(-s.accidental));
const chordName = (c: Change) => spelling(c.root) + c.quality.replace('b', '♭') + (c.bass ? '/' + spelling(c.bass) : '');
const source = { melody: 'Melody', left: 'Left hand', right: 'Right hand · added' };

/** Static LilyPond assets + Lean-generated relationships. No proof checker in the browser.
 * Mount in an MDX/blog page with <HarmonyExample data={data} assetBase="/music/study" />.
 */
export function HarmonyExample({ data, assetBase }: { data: HarmonyData; assetBase: string }) {
  const [mode, setMode] = useState<'head' | 'implementation'>('implementation');
  const [tick, setTick] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const seek = (position: number) => { setTick(position); setSeekVersion(v => v + 1); };
  const sliderId = useId();
  const change = data.changes.find(c => c.start <= tick && tick < c.start + c.duration)!;
  const notes = change.relationships.find(r => r.tick === tick)?.notes ?? [];
  const shown = notes.filter(n => mode === 'implementation' || n.hand === 'melody');
  return <section className="jp" aria-label={data.title}>
    <div className="jp-toolbar">
      <div className="jp-toggle" aria-label="Score view">
        <button aria-pressed={mode === 'head'} onClick={() => setMode('head')}>01 · The head</button>
        <button aria-pressed={mode === 'implementation'} onClick={() => setMode('implementation')}>02 · With voicing</button>
      </div>
      <span className="jp-stamp">Lean example · build checked</span>
    </div>
    <div className="jp-score"><img src={`${assetBase}/${mode}.svg`} alt={mode === 'head'
      ? `${data.title}: the original melody and chord symbols`
      : `${data.title}: unchanged melody, added right-hand guide tones and left-hand shells`} /></div>
    <div className="jp-caption"><span>{mode === 'head' ? 'SPECIFICATION' : 'IMPLEMENTATION'}</span>
      {mode === 'head' ? 'The melody and harmony we start with.' : 'Added notes support the unchanged melody.'}
    </div>
    <PianoPlayer data={data} mode={mode} tick={tick} onTickChange={setTick} seekVersion={seekVersion} />
    <div className="jp-inspector">
      <div className="jp-inspector-title"><h3>What each note does</h3><span>Inspect the sounding harmony</span></div>
      <div className="jp-chords" aria-label="Select harmony">{data.changes.map(c =>
        <button key={c.start} aria-pressed={change === c} onClick={() => seek(c.start)}>
          <small>BAR {Math.floor(c.start / 8) + 1}</small>{chordName(c)}
        </button>)}</div>
      <div className="jp-time"><label htmlFor={sliderId}>Bar {Math.floor(tick / 8) + 1} · beat {(tick % 8) / 2 + 1}</label>
        <input id={sliderId} aria-label="Score position in eighth-note ticks" type="range" min="0" max={data.length - 1} value={tick}
          onChange={e => seek(Number(e.target.value))} />
      </div>
      <table><caption className="jp-sr">Sounding notes and checked harmonic relationships</caption>
        <thead><tr><th>Source</th><th>Written note</th><th>Chord function</th><th>At this position</th></tr></thead>
        <tbody>{shown.map((r, index) => <tr key={`${r.hand}-${r.note.midi}-${index}`}>
          <td><span className={`jp-dot jp-${r.hand}`} />{source[r.hand]}</td>
          <td className="jp-note">{spelling(r.note.spelling)}<sub>{r.note.octave}</sub></td>
          <td>{r.roles.length ? r.roles.join(' / ') : r.bass ? 'Slash bass' : 'Melody · non-chord tone'}</td>
          <td className="jp-muted">{r.note.start === tick ? 'Attack' : 'Held'}</td>
        </tr>)}</tbody>
      </table>
      <p className="jp-required">Required identity in {chordName(change)}: <strong>{change.required.join(' + ')}</strong>.
        {mode === 'head' && ' The head alone is the specification, not a checked voicing.'}</p>
    </div>
    <details className="jp-proof"><summary>Read the proof contract <span>{data.checks.length} checks</span></summary>
      <ul>{data.checks.map(check => <li key={check}>{check}</li>)}</ul>
      <p>Checked by Lean when this example is built. The browser displays the exported result; it does not verify proofs.
        These predicates establish the stated constraints, not musical taste or every rule of jazz.</p>
      <code>{data.proof}</code>
    </details>
    <div className="jp-downloads"><a href={`${assetBase}/${mode}.ly`} download>LilyPond source ↗</a>
      <a href={`${assetBase}/piano.musicxml`} download>MusicXML ↗</a>
      <a href={`${assetBase}/piano.mid`} download>MIDI ↗</a>
      <a href={`${assetBase}/example.json`} download>Note data ↗</a></div>
  </section>;
}
