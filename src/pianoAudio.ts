import { sitePath } from './sitePath';
import type { PlaybackEvent } from './pianoModel';

/** Salamander Grand Piano / Alexander Holm, CC BY 3.0. See public/audio/salamander. */
export const RELEASE_SECONDS = 0.32;
const buffers = new Map<number, Promise<AudioBuffer>>();
export const sampleMidi = (midi: number) => Math.max(21, Math.min(108, Math.round((midi - 21) / 3) * 3 + 21));
const sampleName = (midi: number) => `${['C', '', '', 'Ds', '', '', 'Fs', '', '', 'A'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export type MelodyInstrument = 'piano' | 'tenor-sax';
const sampleKey = (event: PlaybackEvent, instrument: MelodyInstrument) => instrument === 'tenor-sax' && event.hand === 'melody' ? -(event.midi - 12) : sampleMidi(event.midi);

export async function loadPiano(context: BaseAudioContext, events: PlaybackEvent[], instrument: MelodyInstrument = 'piano') {
  const samples = new Map<number, AudioBuffer>();
  await Promise.all([...new Set(events.map(e => sampleKey(e, instrument)))].map(async midi => {
    let pending = buffers.get(midi);
    if (!pending) {
      pending = fetch(sitePath(midi < 0 ? `/audio/tenor-sax/${-midi}.mp3` : `/audio/salamander/${sampleName(midi)}.mp3`))
        .then(response => {
          if (!response.ok) throw new Error('Piano sample unavailable');
          return response.arrayBuffer();
        }).then(bytes => context.decodeAudioData(bytes));
      buffers.set(midi, pending);
      void pending.catch(() => { if (buffers.get(midi) === pending) buffers.delete(midi); });
    }
    samples.set(midi, await pending);
  }));
  return samples;
}

/** Schedule recorded notes against the audio clock; no oscillator fallback. */
export function schedulePiano(context: BaseAudioContext, events: PlaybackEvent[],
  startTime: number, fromTick: number, secondsPerTick: number, samples: Map<number, AudioBuffer>, instrument: MelodyInstrument = 'piano') {
  const master = context.createGain();
  master.gain.value = 0.8;
  const compressor = context.createDynamicsCompressor();
  master.connect(compressor).connect(context.destination);
  // Only the sax passes through this darker tone chain; piano keeps its existing sound.
  const warmth = instrument === 'tenor-sax' ? context.createBiquadFilter() : null;
  const softness = instrument === 'tenor-sax' ? context.createBiquadFilter() : null;
  if (warmth && softness) {
    warmth.type = 'peaking'; warmth.frequency.value = 1100; warmth.Q.value = 0.8; warmth.gain.value = -4;
    softness.type = 'lowpass'; softness.frequency.value = 3200; softness.Q.value = 0.5;
    warmth.connect(softness).connect(master);
  }
  const voices: AudioBufferSourceNode[] = [];
  for (const event of events) {
    const sampled = sampleKey(event, instrument);
    const sax = sampled < 0;
    const buffer = samples.get(sampled);
    if (!buffer) throw new Error(`Piano sample missing: ${sampled}`);
    const start = startTime + (event.start - fromTick) * secondsPerTick;
    const end = start + event.duration * secondsPerTick;
    const envelope = context.createGain();
    const volume = sax ? 0.9 : event.hand === 'melody' ? 0.85 : instrument === 'tenor-sax' ? 0.3 : 0.65;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, Math.min(start + (sax ? 0.04 : 0.003), end));
    envelope.gain.setValueAtTime(volume, end);
    envelope.gain.exponentialRampToValueAtTime(0.001, end + RELEASE_SECONDS);
    envelope.connect(sax && warmth ? warmth : master);
    const voice = context.createBufferSource();
    voice.buffer = buffer;
    voice.playbackRate.value = sax ? 1 : 2 ** ((event.midi - sampled) / 12);
    voice.connect(envelope);
    voice.start(start);
    voice.stop(end + RELEASE_SECONDS);
    voices.push(voice);
    voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
  }
  return () => {
    for (const voice of voices) { voice.stop(); voice.disconnect(); }
    warmth?.disconnect();
    softness?.disconnect();
    master.disconnect();
    compressor.disconnect();
  };
}
