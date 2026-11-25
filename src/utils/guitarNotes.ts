import { mod12 } from './musicTheory';

export interface Tuning {
  name: string;
  /** MIDI numbers of the open strings, low (6th) → high (1st) */
  strings: number[];
  labels: string[];
}

export const TUNINGS: Tuning[] = [
  { name: 'Standard (E A D G B E)', strings: [40, 45, 50, 55, 59, 64], labels: ['E', 'A', 'D', 'G', 'B', 'E'] },
  { name: 'Drop D (D A D G B E)', strings: [38, 45, 50, 55, 59, 64], labels: ['D', 'A', 'D', 'G', 'B', 'E'] },
  { name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62], labels: ['D', 'A', 'D', 'G', 'A', 'D'] },
  { name: 'Open G (D G D G B D)', strings: [38, 43, 50, 55, 59, 62], labels: ['D', 'G', 'D', 'G', 'B', 'D'] },
];

export const FRET_COUNT = 12;

export interface FretPosition {
  stringIndex: number; // 0 = lowest string
  fret: number;
  midi: number;
  pitchClass: number;
}

/** Every string/fret position from fret 0 to FRET_COUNT, with its pitch. */
export function fretboardPositions(tuning: Tuning): FretPosition[] {
  const positions: FretPosition[] = [];
  tuning.strings.forEach((open, stringIndex) => {
    for (let fret = 0; fret <= FRET_COUNT; fret++) {
      const midi = open + fret;
      positions.push({ stringIndex, fret, midi, pitchClass: mod12(midi) });
    }
  });
  return positions;
}
