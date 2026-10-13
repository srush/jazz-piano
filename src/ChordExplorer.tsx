import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import { PianoPlayer } from './PianoPlayer';
import { type KeyColor } from './pianoModel';
import { buildChord, DEFAULT_CHORD, displayRoot, FIFTHS, fifthsIndex, QUALITIES,
  type ChordSelection } from './chordExplorerModel';
import type { PianoData } from './musicTypes';
import './explorer.css';

export type ChordExplorerProps = {
  /** Supply value/onChange for controlled use, or just defaultValue. */
  value?: ChordSelection;
  defaultValue?: Partial<ChordSelection>;
  onChange?: (selection: ChordSelection) => void;
  palette?: Partial<Record<KeyColor, string>>;
  initialTempo?: number;
  title?: string;
  defaultIncludeBass?: boolean;
};

function Audition({ data, palette, initialTempo, includeBass }: {
  data: PianoData; includeBass: boolean; palette?: ChordExplorerProps['palette']; initialTempo?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => setTick(0), [data]);
  return <PianoPlayer data={data} tick={tick} onTickChange={setTick} mode="implementation"
    keyRange={[53, 81]} bassDisplayMidi={data.left[0].midi + (data.left[0].midi % 12 > 5 ? 12 : 24)} includeBass={includeBass} palette={palette} initialTempo={initialTempo} title="Hear your voicing" />;
}

/** Self-contained: no lead sheet, exported JSON, LilyPond, or exported JSON needed. */
export function ChordExplorer({ value, defaultValue, onChange, palette, initialTempo,
  defaultIncludeBass = false, title = 'Take a chord around the circle' }: ChordExplorerProps) {
  const [local, setLocal] = useState<ChordSelection>(() => ({ ...DEFAULT_CHORD, ...defaultValue }));
  const [includeBass, setIncludeBass] = useState(defaultIncludeBass);
  const selection = value ?? local;
  const data = useMemo(() => buildChord(selection), [selection.root, selection.quality, selection.ninth]);
  const index = FIFTHS.findIndex(r => r.name === selection.root);
  function update(next: Partial<ChordSelection>) {
    const chord = { ...selection, ...next };
    if (!value) setLocal(chord);
    onChange?.(chord);
  }
  function selectAt(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < rect.width * 0.16) return;
    const next = FIFTHS[fifthsIndex(x, y)].name;
    if (next !== selection.root) update({ root: next });
  }
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const angle = index * Math.PI / 6;
  return <section className="jp-explorer" aria-label={title}>
    <div className="jp-explorer-controls">
      <div className="jp-circle-wrap">
        <div className="jp-circle" role="group" aria-label="Circle of fifths"
          onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId); selectAt(e); }}
          onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) selectAt(e); }}
          onPointerUp={endDrag} onPointerCancel={endDrag}>
          <svg viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r="110" fill="none" stroke="#dedfda" strokeWidth="1" />
            <circle cx="140" cy="140" r="68" fill="none" />
            <line x1={140 + Math.sin(angle) * 77} y1={140 - Math.cos(angle) * 77}
              x2={140 + Math.sin(angle) * 88} y2={140 - Math.cos(angle) * 88} stroke="#315e50" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="jp-circle-center" role="slider" tabIndex={0} aria-label="Key on circle of fifths"
            aria-valuemin={0} aria-valuemax={11} aria-valuenow={index} aria-valuetext={displayRoot(selection.root)}
            onKeyDown={e => {
              let next: number;
              if (e.key === 'Home') next = 0;
              else if (e.key === 'End') next = 11;
              else if (['ArrowRight', 'ArrowUp'].includes(e.key)) next = (index + 1) % 12;
              else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) next = (index + 11) % 12;
              else return;
              e.preventDefault(); update({ root: FIFTHS[next].name });
            }}><strong>{displayRoot(selection.root)}{selection.quality === 'major' ? 'maj7' : selection.quality === 'minor' ? 'm7' : '7'}</strong></div>
          {FIFTHS.map((root, i) => <button key={root.name} aria-label={`Key ${displayRoot(root.name)}`}
            aria-pressed={root.name === selection.root}
            style={{ left: `${50 + Math.sin(i * Math.PI / 6) * 39.3}%`, top: `${50 - Math.cos(i * Math.PI / 6) * 39.3}%` }}
            onClick={() => update({ root: root.name })}>{displayRoot(root.name)}</button>)}
        </div>
      </div>
      <div className="jp-chord-options">
        <div className="jp-quality" role="group" aria-label="Chord quality">
          {QUALITIES.map(q => <button key={q.value} aria-label={q.label === 'Dom' ? 'Dominant' : q.label} title={q.label === 'Dom' ? 'Dominant' : q.label} aria-pressed={selection.quality === q.value}
            onClick={() => update({ quality: q.value })}>{q.value === 'major' ? 'maj7' : q.value === 'minor' ? 'm7' : '7'}</button>)}
        </div>
      </div>
    </div>
    <button className="jp-bass-toggle" aria-label="Play root bass" aria-pressed={includeBass}
      title="Play root bass" onClick={() => setIncludeBass(v => !v)}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M7 12h10M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    </button>
    <Audition data={data} includeBass={includeBass}
      palette={palette} initialTempo={initialTempo} />
  </section>;
}
