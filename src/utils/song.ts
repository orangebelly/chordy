import { parseProgression } from './progression';
import type { Chord } from './chordParser';

// A song = a library of saved measures (each one a chord progression) plus an
// arrangement: the order they're played in. The same measure can appear many
// times (verse, chorus, verse…), so editing it updates every repeat.

export interface Measure {
  id: string;
  name: string;
  /** Chord text exactly as typed, e.g. "C Am F G" */
  chords: string;
  /**
   * Beats per chord, one per chord in `chords` (set by dragging in the lengths editor).
   * Absent → every chord lasts the song's beatsPerChord.
   */
  durations?: number[];
}

export interface Song {
  title: string;
  measures: Measure[];
  /** Measure ids in playing order (repeats allowed) */
  arrangement: string[];
  bpm: number;
  beatsPerChord: number;
  /** Playback speed for the whole song (× tempo) */
  speed: number;
}

/** Speeds offered for song playback. */
export const SPEEDS = [0.75, 1, 1.1, 1.2, 1.5];

/** Tempo the song actually plays at. */
export const playbackBpm = (song: Song) => song.bpm * song.speed;

export const EMPTY_SONG: Song = { title: 'My song', measures: [], arrangement: [], bpm: 90, beatsPerChord: 4, speed: 1 };

const STORAGE_KEY = 'chord-visualizer.song.v1';

/** Chord lengths, in beats: half a beat to four bars. */
export const MIN_BEATS = 0.5;
export const MAX_BEATS = 16;
export const LENGTH_STEP = 0.5;

export const newId = () => Math.random().toString(36).slice(2, 10);

export function nextMeasureName(measures: Measure[]): string {
  let n = measures.length + 1;
  while (measures.some((m) => m.name === `Measure ${n}`)) n++;
  return `Measure ${n}`;
}

export function addMeasure(song: Song, chords: string, alsoArrange = true): { song: Song; id: string } {
  const measure = { id: newId(), name: nextMeasureName(song.measures), chords };
  return {
    id: measure.id,
    song: {
      ...song,
      measures: [...song.measures, measure],
      arrangement: alsoArrange ? [...song.arrangement, measure.id] : song.arrangement,
    },
  };
}

export function updateMeasure(song: Song, id: string, patch: Partial<Omit<Measure, 'id'>>): Song {
  return { ...song, measures: song.measures.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
}

/** Deleting a measure also removes it from the arrangement. */
export function deleteMeasure(song: Song, id: string): Song {
  return {
    ...song,
    measures: song.measures.filter((m) => m.id !== id),
    arrangement: song.arrangement.filter((a) => a !== id),
  };
}

export function arrangeAppend(song: Song, id: string): Song {
  return { ...song, arrangement: [...song.arrangement, id] };
}

export function arrangeRemoveAt(song: Song, index: number): Song {
  return { ...song, arrangement: song.arrangement.filter((_, i) => i !== index) };
}

export function arrangeMove(song: Song, index: number, delta: number): Song {
  const to = index + delta;
  if (to < 0 || to >= song.arrangement.length) return song;
  const arrangement = [...song.arrangement];
  [arrangement[index], arrangement[to]] = [arrangement[to], arrangement[index]];
  return { ...song, arrangement };
}

/** Load the saved song; falls back to an empty song if storage is unavailable or corrupt. */
export function loadSong(): Song {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SONG;
    const s = JSON.parse(raw) as Partial<Song>;
    const measures = Array.isArray(s.measures)
      ? s.measures
          .filter((m): m is Measure => !!m && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.chords === 'string')
          .map(({ durations, ...m }) =>
            Array.isArray(durations) && durations.every((d) => typeof d === 'number' && d >= MIN_BEATS && d <= MAX_BEATS)
              ? { ...m, durations }
              : m,
          )
      : [];
    const ids = new Set(measures.map((m) => m.id));
    return {
      title: typeof s.title === 'string' ? s.title : EMPTY_SONG.title,
      measures,
      arrangement: Array.isArray(s.arrangement) ? s.arrangement.filter((id) => ids.has(id)) : [],
      bpm: typeof s.bpm === 'number' && s.bpm >= 40 && s.bpm <= 240 ? s.bpm : EMPTY_SONG.bpm,
      beatsPerChord: [1, 2, 4].includes(s.beatsPerChord as number) ? (s.beatsPerChord as number) : EMPTY_SONG.beatsPerChord,
      speed: SPEEDS.includes(s.speed as number) ? (s.speed as number) : 1,
    };
  } catch {
    return EMPTY_SONG;
  }
}

export function saveSong(song: Song) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
  } catch {
    /* storage unavailable (private mode etc.) — the song just won't persist */
  }
}

// ---- Chord lengths ------------------------------------------------------------

/**
 * Beats for each chord token of a measure. Saved lengths are used only while they
 * still match the chords (editing the chord text to a different number of chords
 * resets them to the song default).
 */
export function measureDurations(m: Measure, beatsPerChord: number): number[] {
  const n = parseProgression(m.chords).length;
  return m.durations && m.durations.length === n ? m.durations : new Array<number>(n).fill(beatsPerChord);
}

/** Set chord `index`'s length (snapped to half beats, within limits). */
export function setChordLength(song: Song, id: string, index: number, beats: number): Song {
  const m = song.measures.find((x) => x.id === id);
  if (!m) return song;
  const durations = [...measureDurations(m, song.beatsPerChord)];
  if (index < 0 || index >= durations.length) return song;
  durations[index] = Math.min(MAX_BEATS, Math.max(MIN_BEATS, Math.round(beats / LENGTH_STEP) * LENGTH_STEP));
  return updateMeasure(song, id, { durations });
}

/** Back to the song's default length for every chord. */
export const resetChordLengths = (song: Song, id: string): Song =>
  ({ ...song, measures: song.measures.map((m) => (m.id === id ? (({ durations: _, ...rest }) => rest)(m) : m)) });

export interface TimelineEvent {
  /** index in the arrangement */
  slot: number;
  /** index of the chord token within the measure */
  item: number;
  chord: Chord;
  /** beats from the start of the song */
  start: number;
  duration: number;
}

/**
 * Every playable chord of the song in order, with start time and length in beats.
 * Tokens that aren't chords are skipped (they take no time).
 */
export function songTimeline(song: Song, fromSlot = 0): { events: TimelineEvent[]; beats: number } {
  const byId = new Map(song.measures.map((m) => [m.id, m]));
  const events: TimelineEvent[] = [];
  let t = 0;
  song.arrangement.forEach((id, slot) => {
    const m = byId.get(id);
    if (!m || slot < fromSlot) return;
    const lengths = measureDurations(m, song.beatsPerChord);
    parseProgression(m.chords).forEach((it, item) => {
      if (!it.chord) return;
      events.push({ slot, item, chord: it.chord, start: t, duration: lengths[item] });
      t += lengths[item];
    });
  });
  return { events, beats: t };
}
