// A song = a library of saved measures (each one a chord progression) plus an
// arrangement: the order they're played in. The same measure can appear many
// times (verse, chorus, verse…), so editing it updates every repeat.

export interface Measure {
  id: string;
  name: string;
  /** Chord text exactly as typed, e.g. "C Am F G" */
  chords: string;
}

export interface Song {
  title: string;
  measures: Measure[];
  /** Measure ids in playing order (repeats allowed) */
  arrangement: string[];
  bpm: number;
  beatsPerChord: number;
}

export const EMPTY_SONG: Song = { title: 'My song', measures: [], arrangement: [], bpm: 90, beatsPerChord: 4 };

const STORAGE_KEY = 'chord-visualizer.song.v1';

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
      ? s.measures.filter((m): m is Measure => !!m && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.chords === 'string')
      : [];
    const ids = new Set(measures.map((m) => m.id));
    return {
      title: typeof s.title === 'string' ? s.title : EMPTY_SONG.title,
      measures,
      arrangement: Array.isArray(s.arrangement) ? s.arrangement.filter((id) => ids.has(id)) : [],
      bpm: typeof s.bpm === 'number' && s.bpm >= 40 && s.bpm <= 240 ? s.bpm : EMPTY_SONG.bpm,
      beatsPerChord: [1, 2, 4].includes(s.beatsPerChord as number) ? (s.beatsPerChord as number) : EMPTY_SONG.beatsPerChord,
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
