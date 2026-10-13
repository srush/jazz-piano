import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PianoData } from './musicTypes';
import { loadPiano, RELEASE_SECONDS, schedulePiano } from './pianoAudio';
import { atTick, COLORS, currentChange, isBlack, isMutedBass, keyboardRange, keyRole,
  noteName, playbackEvents, referenceName, ROLE_NAMES, includesPart, type PianoParts, type KeyColor, type ViewMode } from './pianoModel';
import './piano.css';
import { playback } from './playbackCoordinator';
import { VoiceLeading } from './VoiceLeading';

export type PianoPlayerProps = {
  data: PianoData; mode: ViewMode; tick: number; onTickChange: (tick: number) => void;
  /** Increment when a user seeks (as opposed to a playback clock update). */
  seekVersion?: number;
  palette?: Partial<Record<KeyColor, string>>;
  initialTempo?: number;
  title?: string;
  minimal?: boolean;
  includeBass?: boolean;
  /** When supplied, filters both sound and visuals to these parts. */
  parts?: PianoParts;
  showVoiceLeading?: boolean;
  showHands?: boolean;
  /** Display the bass reference here while retaining its original audio pitch. */
  bassDisplayMidi?: number;
  keyRange?: readonly [number, number];
  playFromStart?: boolean;
  onPlaybackStateChange?: (active: boolean) => void;
};

export function PianoPlayer({ data, mode, tick, onTickChange, seekVersion = 0, palette, initialTempo = 100, title = 'The notes under your hands', minimal = true, includeBass: bassOption = false, parts, showVoiceLeading = false, showHands = false, keyRange, bassDisplayMidi, playFromStart = false, onPlaybackStateChange }: PianoPlayerProps) {
  const includeBass = parts ? parts === 'full' || parts === 'melody-root' : bassOption;
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempo, setTempo] = useState(Math.max(40, Math.min(200, initialTempo)));
  const colors = { ...COLORS, ...(minimal ? { third: '#138b80', fifth: '#70d4bc', seventh: '#138b80', ninth: '#70d4bc', other: '#70d4bc', melody: '#6aa6d8' } : {}), ...palette };
  const [error, setError] = useState('');
  const context = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const generation = useRef(0);
  const completed = useRef(false);
  const tempoId = useId();
  const titleId = useId();
  const release = useRef<(() => void) | null>(null);
  const playbackLease = useRef<(() => void) | null>(null);
  const stopAudio = useCallback(() => {
    playbackLease.current?.();
    playbackLease.current = null;
    generation.current++;
    cancelAnimationFrame(frame.current);
    release.current?.();
    release.current = null;
    const ctx = context.current;
    context.current = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }, []);
  const stop = useCallback(() => { stopAudio(); setPlaying(false); setLoading(false); }, [stopAudio]);
  useEffect(() => {
    stop();
    completed.current = false;
    return stopAudio;
  }, [data, mode, seekVersion, includeBass, parts, stop, stopAudio]);
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [stop]);

  useEffect(() => { onPlaybackStateChange?.(playing || loading); }, [playing, loading, onPlaybackStateChange]);

  async function play() {
    stop();
    playbackLease.current = playback.claim(stop);
    setError('');
    setLoading(true);
    const token = generation.current;
    try {
      const ctx = new AudioContext();
      context.current = ctx;
      await ctx.resume();
      if (generation.current !== token) return;
      const from = completed.current || playFromStart ? 0 : tick;
      const events = playbackEvents(data, mode, from, includeBass, parts);
      const samples = await loadPiano(ctx, events);
      if (generation.current !== token) return;
      setLoading(false);
      completed.current = false;
      const secondsPerTick = 60 / tempo / data.ticksPerQuarter;
      const start = ctx.currentTime + 0.05;
      const end = start + (data.length - from) * secondsPerTick;
      release.current = schedulePiano(ctx, events, start, from, secondsPerTick, samples);
      onTickChange(from);
      setPlaying(true);
      let lastTick = from;
      const animate = () => {
        if (generation.current !== token) return;
        if (ctx.currentTime >= end + RELEASE_SECONDS) {
          completed.current = true;
          onTickChange(data.length - 1);
          stop();
          return;
        }
        const next = Math.max(from, Math.min(data.length - 1,
          from + Math.floor((ctx.currentTime - start) / secondsPerTick)));
        if (next !== lastTick) { onTickChange(next); lastTick = next; }
        frame.current = requestAnimationFrame(animate);
      };
      frame.current = requestAnimationFrame(animate);
    } catch {
      if (generation.current !== token) return;
      stop();
      setError('The piano could not load or start. Press Play to retry.');
    }
  }

  const change = currentChange(data, tick);
  const relationships = atTick(change, tick).filter(r => !parts || includesPart(r, parts));
  const basses = relationships.filter(isMutedBass);
  const audible = relationships.filter(r => !isMutedBass(r) && (parts || mode === 'implementation' || r.hand === 'melody'));
  const range = keyboardRange(data);
  const pitches = [...data.left, ...data.right, ...data.melody].map(n => n.midi);
  let low = Math.max(21, Math.min(60, ...pitches) - 2);
  let high = Math.min(108, Math.max(71, ...pitches) + 2);
  while (isBlack(low)) low--;
  while (isBlack(high)) high++;
  const keys = keyRange ? Array.from({ length: keyRange[1] - keyRange[0] + 1 }, (_, i) => keyRange[0] + i) : minimal ? range.filter(k => k >= low && k <= high) : range;
  const whites = keys.filter(k => !isBlack(k));
  const width = whites.length * 30;
  const position = (midi: number) => keys.filter(k => k < midi && !isBlack(k)).length * 30;
  const innerVoices = audible.filter(r => r.hand !== 'melody')
    .sort((a, b) => a.note.midi - b.note.midi).map(r => ({
      midi: r.note.midi, x: position(r.note.midi) + (isBlack(r.note.midi) ? 0 : 14.5),
    }));
  const voiceOverlay = showVoiceLeading && (parts ? parts === 'full' || parts === 'comping' : mode === 'implementation');

  function key(midi: number) {
    const black = isBlack(midi);
    const bass = basses.find(r => (minimal ? bassDisplayMidi ?? r.note.midi : r.note.midi) === midi);
    const played = audible.find(r => r.note.midi === midi);
    const role = keyRole(change, midi, played);
    const color: KeyColor | undefined = played
      ? role.color ?? (played.hand === 'melody' ? 'melody' : 'other') : role.color;
    const x = position(midi) - (black ? 9 : 0);
    const w = black ? 18 : 29;
    const h = minimal ? (black ? 70 : 114) : black ? 87 : 138;
    const neutral = minimal ? (black ? '#e4eaf0' : '#ffffff') : black ? '#26282b' : '#fff';
    const fill = minimal ? (played && color ? colors[color] : bass ? '#d0ddee' : neutral) : played && color ? colors[color] : neutral;
    const melody = relationships.some(r => r.hand === 'melody' && r.note.midi === midi);

    const label = bass ? 'bass' : played ? role.label ?? (played.hand === 'melody' ? 'M' : '·') : role.label;
    const name = played || bass ? noteName((played || bass)!.note) : referenceName(change, midi);
    const description = `${name}${bass ? includeBass ? ', bass' : ', bass, muted' : ''}${played ? `, ${playing ? 'sounding' : 'selected'}, ${color ? ROLE_NAMES[color] : ''}` : ''}`;
    return <g key={midi} data-midi={midi} data-active={!!played} data-bass={!!bass}
      data-color={color ?? 'none'} aria-label={description}>
      <title>{description}</title>
      <rect className="jp-key-surface" x={x} y={0} width={w} height={h} rx={minimal ? 0 : black ? 3 : 4} fill={fill} stroke={minimal ? '#bccad4' : black ? '#26282b' : '#dcdedb'} />
      {!minimal && !played && !bass && color && <rect x={x + 1} y={1} width={w - 2} height={h - 2} rx="3" fill={colors[color]} opacity={black ? 0.32 : 0.1} />}
      {!minimal && bass && <rect x={x + 2.5} y={2.5} width={w - 5} height={h - 5} rx="3" fill="none" stroke={black ? '#fbf4d8' : '#315e50'} strokeWidth="2.5" strokeDasharray={minimal ? undefined : "5 3"} />}
      {minimal && <path className="jp-key-mark" d={`M${x + w / 2} 12l3 3-3 3-3-3Z`}
        fill={black ? '#bec7c0' : '#8d9c91'} opacity={melody ? 1 : 0} />}
      {showHands && played && <text x={x + w / 2} y={h - 12} textAnchor="middle" fontSize={black ? 7 : 9} fill={color === 'third' || color === 'seventh' ? '#fff' : '#183b45'}>{played.hand === 'left' ? 'L' : 'R'} {label}</text>}
      {!minimal && label && <text x={x + w / 2} y={h - (black ? 11 : 22)} textAnchor="middle"
        fill={played || black ? '#fff' : bass ? '#315e50' : '#44564d'} fontSize={bass ? 7 : 9} fontWeight="600">{label.replace(/^b(?=\d)/, '♭')}</text>}
      {!minimal && !black && <text x={x + w / 2} y={h - 7} textAnchor="middle" fontSize="6.5"
        fill={played ? '#fff' : '#78837b'}>{name}</text>}
      {!minimal && played && <circle cx={x + w / 2} cy={black ? 57 : 92} r="2.6" fill="white" />}
    </g>;
  }

  return <section className={`jp-piano${minimal ? ' jp-piano-minimal' : ''}`} aria-label={minimal ? title : undefined} aria-labelledby={minimal ? undefined : titleId}>
    <div className="jp-piano-heading">{!minimal && <div><span className="jp-piano-eyebrow">HEAR THE HARMONY</span>
      <h3 id={titleId}>{title}</h3></div>}
      <div className="jp-transport">{!minimal && <label htmlFor={tempoId}>BPM <input id={tempoId} type="number" min="40" max="200" step="5"
        value={tempo} onChange={e => { stop(); setTempo(Math.max(40, Math.min(200, Number(e.target.value) || 40))); }} /></label>}
        <button className="jp-play" onClick={playing || loading ? stop : () => void play()} aria-busy={loading} aria-label={loading ? 'Cancel loading piano' : playing ? 'Stop piano playback' : 'Play piano from selected position'}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{loading ? <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="30 14"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" /></circle> : playing
            ? <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" />
            : <path d="M9 5.5 19 12 9 18.5Z" fill="currentColor" />}</svg>
          {!minimal && (playing ? 'Stop' : 'Play')}</button>
      </div>
    </div>
    <div className="jp-keyboard-scroll" tabIndex={0} role="region" aria-label="Piano keyboard; scroll horizontally on small screens">
      <svg viewBox={`-3 -3 ${width + 6} ${minimal ? 122 : 146}`} role="img" aria-label={`Piano keyboard at bar ${Math.floor(tick / (4 * data.ticksPerQuarter)) + 1}, beat ${(tick % (4 * data.ticksPerQuarter)) / data.ticksPerQuarter + 1}. ${includeBass ? 'Bass included.' : 'Bass silent.'}`}>
        {whites.map(key)}{keys.filter(isBlack).map(key)}
        {voiceOverlay && <VoiceLeading voices={innerVoices} y={minimal ? 84 : 102} />}
      </svg>
    </div>
    {!minimal && <><div className="jp-piano-legend">{(['third', 'fifth', 'seventh', 'ninth', 'melody'] as KeyColor[]).map(color =>
      <span key={color}><i style={{ backgroundColor: colors[color] }} />{ROLE_NAMES[color]}</span>)}
      <span><i className="jp-bass-swatch" />Bass · silent</span>
    </div>
    <p className="jp-piano-hint">Tinted: chord reference. Solid + dot: {playing ? 'sounding' : 'selected'} notes. The outlined bass is silent.</p>
    <div className="jp-piano-now"><span className="jp-piano-status" role="status">{playing ? 'Playing' : 'Preview'}</span>
      <span>{audible.map(r => noteName(r.note)).join(' · ') || 'Rest'}{basses.length > 0 && ` — ${basses.map(r => noteName(r.note)).join(', ')} muted`}</span>
    </div>
    </>}
    {error && <p role="alert" className="jp-audio-error">{error}</p>}
  </section>;
}
