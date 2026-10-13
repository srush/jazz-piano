import { useEffect, useId, useMemo, useState, type PointerEvent } from 'react';
import { PianoPlayer } from './PianoPlayer';
import { type KeyColor } from './pianoModel';
import { buildChord, buildHandVoicing, buildScaleChord, DEFAULT_CHORD, displayRoot, FIFTHS, fifthsIndex, QUALITIES,
  type ChordSelection, type RootName } from './chordExplorerModel';
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
  circleOnly?: boolean;
  progressionPath?: RootName[];
  variant?: "scale" | "chord" | "voicing";
};

function Audition({ data, palette, initialTempo, includeBass, request }: {
  data: PianoData; includeBass: boolean; request: number; palette?: ChordExplorerProps['palette']; initialTempo?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => setTick(0), [data]);
  return <PianoPlayer data={data} tick={tick} onTickChange={setTick} mode="implementation"
    autoPlayRequest={request} hideTransport playFromStart keyRange={[36, 84]} bassDisplayMidi={data.left[0].midi} includeBass={includeBass} palette={palette} initialTempo={initialTempo} title="Hear your voicing" />;
}

/** Self-contained: no lead sheet, exported JSON, LilyPond, or exported JSON needed. */
export function ChordExplorer({ value, defaultValue, onChange, palette, initialTempo,
  defaultIncludeBass = false, variant = 'chord', circleOnly = false, progressionPath, title = 'Take a chord around the circle' }: ChordExplorerProps) {
  const [local, setLocal] = useState<ChordSelection>(() => ({ ...DEFAULT_CHORD, ...(variant === 'scale' ? { quality: 'major' as const } : {}), ...defaultValue }));
  const [includeBass, setIncludeBass] = useState(defaultIncludeBass);
  const [voicing, setVoicing] = useState<1 | 2>(1);
  const [request, setRequest] = useState(0);
  const selection = value ?? local;
  const data = useMemo(() => variant === 'scale' ? buildScaleChord(selection.root) : variant === 'voicing' ? buildHandVoicing(selection, voicing) : buildChord(selection), [selection.root, selection.quality, selection.ninth, variant, voicing]);
  const arrowId = useId();
  const index = FIFTHS.findIndex(r => r.name === selection.root);
  function update(next: Partial<ChordSelection>) {
    const chord = { ...selection, ...next };
    if (chord.root === selection.root && chord.quality === selection.quality && chord.ninth === selection.ninth) return;
    setRequest(n => n + 1);
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
            {progressionPath && <>
              <defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#6193c5" /></marker></defs>
              {progressionPath.slice(0,-1).map(root => FIFTHS.findIndex(r=>r.name===root)).map(i => <path key={i} d={`M${140+Math.sin(i*Math.PI/6)*92} ${140-Math.cos(i*Math.PI/6)*92} A92 92 0 0 0 ${140+Math.sin((i-1)*Math.PI/6)*92} ${140-Math.cos((i-1)*Math.PI/6)*92}`}
                fill="none" stroke="#6193c5" strokeWidth={index === (i+11)%12 ? 3 : 1.5} opacity={index === (i+11)%12 ? 1 : .4} markerEnd={`url(#${arrowId})`} />)}
            </>}
            <circle cx="140" cy="140" r="110" fill="none" stroke="#dedfda" strokeWidth="1" />
            <circle cx="140" cy="140" r="68" fill="none" />
            <line x1={140 + Math.sin(angle) * 77} y1={140 - Math.cos(angle) * 77}
              x2={140 + Math.sin(angle) * 88} y2={140 - Math.cos(angle) * 88} stroke="#6193c5" strokeWidth="3" strokeLinecap="round" />
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
            }}><strong>{displayRoot(selection.root)}{selection.quality === 'major' ? '△7' : selection.quality === 'minor' ? '−7' : '7'}</strong></div>
          {FIFTHS.map((root, i) => <button key={root.name} aria-label={`Key ${displayRoot(root.name)}`}
            aria-pressed={root.name === selection.root}
            style={{ left: `${50 + Math.sin(i * Math.PI / 6) * 39.3}%`, top: `${50 - Math.cos(i * Math.PI / 6) * 39.3}%` }}
            onClick={() => update({ root: root.name })}>{displayRoot(root.name)}</button>)}
        </div>
      </div>
      {!circleOnly && variant !== 'scale' && <div className="jp-chord-options">
        <div className="jp-quality" role="group" aria-label="Chord quality">
          {QUALITIES.map(q => <button key={q.value} aria-label={q.label === 'Dom' ? 'Dominant' : q.label} title={q.label === 'Dom' ? 'Dominant' : q.label} aria-pressed={selection.quality === q.value}
            onClick={() => update({ quality: q.value })}>{q.value === 'major' ? '△7' : q.value === 'minor' ? '−7' : '7'}</button>)}
        </div>
        {variant === 'voicing' && <div className="jp-voicing-knob">Voicing
          <button role="slider" aria-label="Voicing type" aria-valuemin={1} aria-valuemax={2}
            aria-valuenow={voicing} aria-valuetext={`Type ${voicing === 1 ? 'A' : 'B'}`}
            onClick={() => { setVoicing(v => v === 1 ? 2 : 1); setRequest(n => n + 1); }}
            onKeyDown={e => {
              const next = ['ArrowRight', 'ArrowUp', 'End'].includes(e.key) ? 2 : ['ArrowLeft', 'ArrowDown', 'Home'].includes(e.key) ? 1 : null;
              if (next === null) return;
              e.preventDefault();
              if (next !== voicing) { setVoicing(next); setRequest(n => n + 1); }
            }}>
            <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="#d9e2ec" />
              <line x1="24" y1="12" x2="24" y2="6" stroke="#6193c5" strokeWidth="3" strokeLinecap="round" transform={`rotate(${voicing === 1 ? -40 : 40} 24 24)`} /></svg>
          </button>
          <span>Type {voicing === 1 ? 'A' : 'B'}</span>
          <span>{voicing === 1 ? 'LH 3–7 · RH 9–5' : 'LH 7–3 · RH 5–9'}</span>
        </div>}
      </div>}
    </div>
    {!circleOnly && variant !== 'scale' && <button className="jp-bass-toggle" aria-label="Play root bass" aria-pressed={includeBass}
      title="Play root bass" onClick={() => { setIncludeBass(v => !v); setRequest(n => n + 1); }}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M7 12h10M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    </button>}
    {!circleOnly && <Audition data={data} includeBass={variant === 'scale' || includeBass} request={request}
      palette={palette} initialTempo={initialTempo} />}
  </section>;
}
