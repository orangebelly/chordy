// Sample-based playback with the Web Audio API.
//
// Real recorded instruments, bundled in public/samples (no network needed at runtime):
//   • Piano:  Salamander Grand Piano (Alexander Holm), CC-BY 3.0
//   • Guitar: acoustic guitar from nbrosowsky/tonejs-instruments, CC-BY 3.0
// Samples exist every few semitones; in-between notes are pitch-shifted from the
// nearest sample (at most ±1–2 semitones, which is inaudible as an artefact).

export type Instrument = 'piano' | 'guitar';

const SAMPLE_NOTES: Record<Instrument, string[]> = {
  piano: ['A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5'],
  guitar: ['D2', 'E2', 'Fs2', 'Gs2', 'As2', 'C3', 'D3', 'E3', 'Fs3', 'Gs3', 'As3',
    'C4', 'D4', 'E4', 'Fs4', 'Gs4', 'As4', 'C5', 'D5'],
};

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Fs3" → 54 */
function sampleNameToMidi(name: string): number {
  const m = /^([A-G])(s?)(\d)$/.exec(name)!;
  return (Number(m[3]) + 1) * 12 + NOTE_PC[m[1]] + (m[2] ? 1 : 0);
}

interface Sample {
  midi: number;
  buffer: AudioBuffer;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const rawFiles: Partial<Record<Instrument, Promise<{ midi: number; data: ArrayBuffer }[]>>> = {};
const decoded: Partial<Record<Instrument, Promise<Sample[]>>> = {};

function getContext(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    // A gentle compressor keeps big chords from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

function fetchSamples(inst: Instrument) {
  rawFiles[inst] ??= Promise.all(
    SAMPLE_NOTES[inst].map(async (name) => {
      const res = await fetch(`${import.meta.env.BASE_URL}samples/${inst}/${name}.mp3`);
      if (!res.ok) throw new Error(`Could not load sample ${inst}/${name}`);
      return { midi: sampleNameToMidi(name), data: await res.arrayBuffer() };
    }),
  );
  return rawFiles[inst]!;
}

function loadInstrument(inst: Instrument): Promise<Sample[]> {
  const { ctx } = getContext();
  decoded[inst] ??= fetchSamples(inst).then((files) =>
    Promise.all(files.map(async (f) => ({ midi: f.midi, buffer: await ctx.decodeAudioData(f.data) }))),
  );
  return decoded[inst]!;
}

/**
 * Download the sample files in the background (no AudioContext needed), and
 * decode them as soon as the user first touches the page so the first note
 * plays without delay. Browsers only allow audio after a user gesture.
 */
export function preloadSamples() {
  fetchSamples('piano').catch(console.error);
  fetchSamples('guitar').catch(console.error);
  const warmUp = () => {
    loadInstrument('piano').catch(console.error);
    loadInstrument('guitar').catch(console.error);
  };
  window.addEventListener('pointerdown', warmUp, { once: true });
  window.addEventListener('keydown', warmUp, { once: true });
}

// ---- playback -------------------------------------------------------------

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}
let voices: Voice[] = [];
/** Bumped by stopAll so notes still waiting for samples to load are cancelled. */
let generation = 0;

interface NoteEvent {
  midi: number;
  /** seconds after the call */
  delay: number;
}

const SETTINGS: Record<Instrument, { volume: number; length: number }> = {
  piano: { volume: 0.9, length: 3.5 },
  guitar: { volume: 1.0, length: 4 },
};

async function play(inst: Instrument, events: NoteEvent[], length = SETTINGS[inst].length) {
  const gen = generation;
  const { ctx, master } = getContext();
  const samples = await loadInstrument(inst);
  if (gen !== generation) return; // stopped while loading

  // Quieter per note when many sound together.
  const volume = SETTINGS[inst].volume / Math.sqrt(Math.max(1, events.filter((e) => e.delay < 0.2).length));
  const start = ctx.currentTime + 0.01;

  for (const { midi, delay } of events) {
    const sample = samples.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));
    const t = start + delay;

    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.value = Math.pow(2, (midi - sample.midi) / 12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.setValueAtTime(volume, t + length - 0.6);
    gain.gain.linearRampToValueAtTime(0, t + length); // smooth release, no click

    src.connect(gain).connect(master);
    src.start(t);
    src.stop(t + length + 0.05);

    const voice = { src, gain };
    voices.push(voice);
    src.onended = () => (voices = voices.filter((v) => v !== voice));
  }
}

export function playNote(inst: Instrument, midi: number) {
  void play(inst, [{ midi, delay: 0 }]);
}

/** All notes at once. Guitar gets a quick downward strum like a real pick. */
export function playChord(inst: Instrument, midis: number[]) {
  const spacing = inst === 'guitar' ? 0.03 : 0;
  void play(inst, midis.map((midi, i) => ({ midi, delay: i * spacing })));
}

/** One note after another, low to high. */
export function playArpeggio(inst: Instrument, midis: number[]) {
  const spacing = inst === 'guitar' ? 0.3 : 0.4;
  void play(inst, midis.map((midi, i) => ({ midi, delay: i * spacing })));
}

export function stopAll() {
  generation++;
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { src, gain } of voices) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    try {
      src.stop(now + 0.1);
    } catch {
      /* already stopped */
    }
  }
  voices = [];
}
