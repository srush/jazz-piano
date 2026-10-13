import { useEffect, useMemo, useState } from 'react';
import { PianoPlayer } from './PianoPlayer';
import { ChordExplorer } from './ChordExplorer';
import { ScaleExplorer } from './ScaleExplorer';
import { buildProgression, progressionSteps } from './progressionModel';
import type { MelodyInstrument } from './pianoAudio';
import type { PianoData } from './musicTypes';
import type { PianoParts } from './pianoModel';
import './progression.css';
import { type RootName, type ChordSelection } from './chordExplorerModel';
import { chordNotation } from './chordNotation';

const PARTS: PianoParts[] = ['melody', 'melody-root', 'full'];
const PART_LABELS = ['Melody only', 'Melody + root', 'Melody + voicing + root'];
export type AnimatedStudy = {
  data: PianoData; visualData?: PianoData; steps: {label: string; roman: string; start: number; duration: number; displayRoot: number}[];
  keyRange: readonly [number, number]; tempo: number; label: string; includeBass?: boolean; muteBass?: boolean; arrangementNote?: string;
};
export function ProgressionDemo({ study: singleStudy, studies, embedded = false, initialParts = 'full', title, showHands = false, form = false, melodyInstrument = 'piano', showCircle = false }: {
  study?: AnimatedStudy; studies?: AnimatedStudy[]; embedded?: boolean; initialParts?: PianoParts;
  title?: string; showHands?: boolean; form?: boolean; melodyInstrument?: MelodyInstrument; showCircle?: boolean;
}) {
  const [startRoot, setStartRoot] = useState<RootName>('D');
  const [audition, setAudition] = useState(0);
  const originalData = useMemo(() => buildProgression(startRoot), [startRoot]);
  const originalSteps = useMemo(() => progressionSteps(startRoot), [startRoot]);
  const [studyIndex, setStudyIndex] = useState(0);
  const study = studies?.[studyIndex] ?? singleStudy;
  const [original, setOriginal] = useState(false);
  const excerpt = !!study && !original;
  const data = excerpt ? study.data : originalData;
  const steps = excerpt ? study.steps : originalSteps;
  const tempo = Math.round((excerpt ? study.tempo : showCircle ? 200 : 100) * 1.2);
  const [explore, setExplore] = useState<false | 'chords' | 'scales'>(false);
  const [tick, setTick] = useState(0);
  const [animate, setAnimate] = useState(() => !embedded && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [audio, setAudio] = useState(false);
  const [parts, setParts] = useState<PianoParts>(initialParts);
  const partIndex = PARTS.indexOf(parts);
  const nextPart = (partIndex + 1) % PARTS.length;
  const partLabel = `${PART_LABELS[partIndex]}. Switch to ${PART_LABELS[nextPart].toLowerCase()}`;
  const [seek, setSeek] = useState(0);
  const active = Math.max(0, steps.findIndex(s => s.start <= tick && tick < s.start + s.duration));
  const stepLabel = (step: typeof steps[number]) => embedded && parts === 'melody-root' ? step.label.match(/^[A-G][#b♯♭]?/)?.[0] ?? step.label : chordNotation(step.label);
  const chordButton = (step: typeof steps[number], i: number) => <button key={step.start} aria-pressed={active === i}
    aria-label={`${excerpt ? `Bar ${step.roman}, ` : ""}${stepLabel(step)}`} onClick={() => { setTick(step.start); setSeek(s => s + 1); }}>
    <span>{!excerpt ? step.roman : embedded ? null : i === 0 || steps[i - 1].roman !== step.roman ? step.roman : '\u00a0'}</span><strong>{stepLabel(step)}</strong>
    <i style={{ transform: `scaleX(${active === i ? (tick - step.start + 1) / step.duration : 0})` }} />
  </button>;
  useEffect(() => {
    if (!animate || audio || explore) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setTick(t => (t + 1) % data.length);
    }, 60_000 / tempo / data.ticksPerQuarter);
    return () => window.clearInterval(timer);
  }, [animate, audio, explore, data, tempo]);
  const barTicks = data.ticksPerQuarter * 4;
  const page = form ? Math.floor(tick / (8 * barTicks)) : 0;
  const visibleSteps = form ? steps.filter(s => s.start >= page * 8 * barTicks && s.start < (page + 1) * 8 * barTicks) : steps;
  return <section className={`jp-demo${showCircle ? " jp-pattern-demo" : ""}`} aria-label={title ?? (excerpt ? study.label : "Animated ii–V–I piano")}>
    {!embedded && <nav className="jp-demo-mode" aria-label="Piano view">
      {(studies ?? (study ? [study] : [])).map((s, i) => <button key={s.label} aria-pressed={i === studyIndex && !original && !explore} onClick={() => { setStudyIndex(i); setOriginal(false); setTick(0); setExplore(false); setAudio(false); }}>{s.label}</button>)}
      <button aria-pressed={(!study || original) && !explore} onClick={() => { setOriginal(true); setTick(0); setExplore(false); setAudio(false); }}>ii–V–I</button>
      <button aria-pressed={explore === 'chords'} onClick={() => { setExplore('chords'); setAudio(false); }}>Explore</button>
      <button aria-pressed={explore === 'scales'} onClick={() => { setExplore('scales'); setAudio(false); }}>Scales</button>
    </nav>}
    {explore === 'scales' ? <ScaleExplorer /> : explore === 'chords' ? <ChordExplorer /> : <>
      {form && <nav className="jp-form" aria-label="Song form">{['A1', 'A2', 'B', 'A3'].map((name, i) =>
        <button key={name} aria-pressed={page === i} onClick={() => { setTick(i * 8 * barTicks); setSeek(s => s + 1); }}>{name}</button>)}</nav>}
      {showCircle && !excerpt && <ChordExplorer circleOnly progressionPath={originalSteps.map(s=>s.root)}
        value={{root: originalSteps[active].root, quality: originalSteps[active].quality, ninth:true} as ChordSelection}
        onChange={selection => {
          setStartRoot(selection.root); setTick(0); setSeek(s=>s+1); setAudition(n=>n+1);
        }} title="ii–V–I on the circle of fifths" />}
      {!(embedded && parts === 'melody') && <div className={`jp-progression${excerpt ? " jp-excerpt-chords" : ""}`} role="group" aria-label="Chord progression">
        {excerpt ? [...new Set(visibleSteps.map(s => s.roman))].map(bar =>
          <div className="jp-chord-bar" key={bar}>{steps.map((step, i) => step.roman === bar ? chordButton(step, i) : null)}</div>
        ) : steps.map(chordButton)}
      </div>}
      {!embedded && excerpt && study.arrangementNote && <p className="jp-arrangement-note">{study.arrangementNote}</p>}
      <PianoPlayer muteBass={excerpt && study.muteBass} visualData={excerpt ? study.visualData : undefined} autoPlayRequest={showCircle ? audition : 0} outlineMelody={embedded && (parts === 'melody' || parts === 'melody-root')} melodyInstrument={melodyInstrument} data={data} mode="implementation" tick={tick} onTickChange={setTick}
        seekVersion={seek} keyRange={excerpt ? study.keyRange : [36, 84]} bassDisplayMidi={steps[active].displayRoot}
        parts={parts} showVoiceLeading showHands={showHands} key={excerpt ? study.label : "original"} initialTempo={tempo} playFromStart={!embedded} onPlaybackStateChange={setAudio}
        title={title ?? (excerpt ? study.label : "Hear ii–V–I")} />
      {!embedded && <div className="jp-demo-options">
        <button aria-label={animate ? 'Pause animation' : 'Animate progression'} aria-pressed={animate}
          onClick={() => setAnimate(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-13-2L3 9m0-5v5h5M5 16a8 8 0 0 0 13 2l3-3m0 5v-5h-5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
        <button aria-label={partLabel} title={partLabel} data-parts={parts} onClick={() => setParts(PARTS[nextPart])}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d={`M5 8h14${partIndex > 0 ? 'M7 12h10' : ''}${partIndex > 1 ? 'M9 16h6' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>}
    </>}
  </section>;
}
