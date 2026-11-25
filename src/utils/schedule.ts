// Turn a chord sequence into timed notes, so each chord stops when the next one starts
// (instead of every chord ringing for its full sample length and piling up).

export interface ScheduledChord {
  midis: number[];
  /** length in beats */
  beats: number;
}

export interface TimedNote {
  midi: number;
  /** seconds from the start */
  start: number;
  duration: number;
  volume: number;
}

/**
 * Notes for a chord sequence at `bpm`. Guitar chords are strummed (strings
 * `strum` seconds apart). Each note ends when its chord's time is up, and
 * volume is shared across the notes of a chord so big chords aren't louder.
 */
export function chordSchedule(chords: ScheduledChord[], bpm: number, strum = 0, baseVolume = 0.9): { notes: TimedNote[]; starts: number[]; end: number } {
  const sec = 60 / bpm;
  const notes: TimedNote[] = [];
  const starts: number[] = [];
  let t = 0;
  for (const c of chords) {
    starts.push(t);
    const len = c.beats * sec;
    const volume = baseVolume / Math.sqrt(Math.max(1, c.midis.length));
    c.midis.forEach((midi, k) => {
      const offset = Math.min(k * strum, len / 2);
      notes.push({ midi, start: t + offset, duration: Math.max(0.05, len - offset), volume });
    });
    t += len;
  }
  return { notes, starts, end: t };
}
