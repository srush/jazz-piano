import type { PlaybackEvent } from './pianoModel';

/** Salamander Grand Piano / Alexander Holm, CC BY 3.0. See public/audio/salamander. */
export const RELEASE_SECONDS = 0.32;
const buffers = new Map<number, Promise<AudioBuffer>>();
export const sampleMidi = (midi: number) => Math.max(21, Math.min(108, Math.round((midi - 21) / 3) * 3 + 21));
const sampleName = (midi: number) => `${['C', '', '', 'Ds', '', '', 'Fs', '', '', 'A'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export async function loadPiano(context: BaseAudioContext, events: PlaybackEvent[]) {
  const samples = new Map<number, AudioBuffer>();
  await Promise.all([...new Set(events.map(e => sampleMidi(e.midi)))].map(async midi => {
    let pending = buffers.get(midi);
    if (!pending) {
      pending = fetch(`/audio/salamander/${sampleName(midi)}.mp3`)
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
  startTime: number, fromTick: number, secondsPerTick: number, samples: Map<number, AudioBuffer>) {
  const master = context.createGain();
  master.gain.value = 0.8;
  const compressor = context.createDynamicsCompressor();
  master.connect(compressor).connect(context.destination);
  const voices: AudioBufferSourceNode[] = [];
  for (const event of events) {
    const sampled = sampleMidi(event.midi);
    const buffer = samples.get(sampled);
    if (!buffer) throw new Error(`Piano sample missing: ${sampled}`);
    const start = startTime + (event.start - fromTick) * secondsPerTick;
    const end = start + event.duration * secondsPerTick;
    const envelope = context.createGain();
    const volume = event.hand === 'melody' ? 0.85 : 0.65;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, Math.min(start + 0.003, end));
    envelope.gain.setValueAtTime(volume, end);
    envelope.gain.exponentialRampToValueAtTime(0.001, end + RELEASE_SECONDS);
    envelope.connect(master);
    const voice = context.createBufferSource();
    voice.buffer = buffer;
    voice.playbackRate.value = 2 ** ((event.midi - sampled) / 12);
    voice.connect(envelope);
    voice.start(start);
    voice.stop(end + RELEASE_SECONDS);
    voices.push(voice);
    voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
  }
  return () => {
    for (const voice of voices) { voice.stop(); voice.disconnect(); }
    master.disconnect();
    compressor.disconnect();
  };
}
