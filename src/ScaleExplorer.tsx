import { useState, type PointerEvent } from 'react';
import { FIFTHS, displayRoot, fifthsIndex, type RootName } from './chordExplorerModel';
import { isBlack } from './pianoModel';
import { majorScaleOctave, SCALE_COLORS } from './scaleModel';
import './explorer.css';
import './scales.css';

export function ScaleExplorer() {
  const [root, setRoot] = useState<RootName>('C');
  const tones = majorScaleOctave(root);
  const keys = Array.from({ length: 25 }, (_, i) => 60 + i);
  const whites = keys.filter(k => !isBlack(k));
  const position = (midi: number) => keys.filter(k => k < midi && !isBlack(k)).length * 30;
  function selectAt(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) > rect.width * .16) setRoot(FIFTHS[fifthsIndex(x, y)].name);
  }
  function key(midi: number) {
    const black = isBlack(midi), tone = tones.find(t => t.midi === midi);
    const x = position(midi) - (black ? 9 : 0), w = black ? 18 : 29, h = black ? 70 : 114;
    const label = tone ? `${tone.name}, degree ${tone.degree}${tone.degree === 2 ? ' / ninth' : ''}` : 'Outside the major scale';
    return <g key={midi} data-midi={midi} data-degree={tone?.degree} aria-label={label}>
      <title>{label}</title>
      <rect className="jp-scale-key" x={x} y="0" width={w} height={h}
        fill={tone ? SCALE_COLORS[tone.color] : black ? '#e4eaf0' : '#fff'} stroke="#bccad4" />
    </g>;
  }
  return <section className="jp-explorer jp-scales" aria-label="Major scale explorer">
    <div className="jp-explorer-controls"><div className="jp-circle-wrap">
      <div className="jp-circle" role="group" aria-label="Major scales around the circle of fifths"
        onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); selectAt(e); }}
        onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) selectAt(e); }}
        onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}>
        <svg viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="110" fill="none" stroke="#dedfda" /></svg>
        <div className="jp-circle-center"><strong>{displayRoot(root)}</strong><div>major</div></div>
        {FIFTHS.map((r, i) => <button key={r.name} aria-label={`${displayRoot(r.name)} major`} aria-pressed={root === r.name}
          style={{ left: `${50 + Math.sin(i * Math.PI / 6) * 39.3}%`, top: `${50 - Math.cos(i * Math.PI / 6) * 39.3}%` }}
          onClick={() => setRoot(r.name)}>{displayRoot(r.name)}</button>)}
      </div>
    </div></div>
    <div className="jp-scale-keyboard"><svg viewBox={`-3 -3 ${whites.length * 30 + 6} 122`} role="img" aria-label={`${displayRoot(root)} major, one octave highlighted from ${displayRoot(root)} to ${displayRoot(root)} on a fixed keyboard.`}>
      {whites.map(key)}{keys.filter(isBlack).map(key)}
    </svg></div>
  </section>;
}
