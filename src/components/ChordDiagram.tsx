import type { ChordShape } from '../utils/guitarShapes';

// Classic vertical chord box: strings run top→bottom (low E on the left),
// frets run across. Dots show where to press, numbers show which finger.

const STRINGS = 6;
const FRETS_SHOWN = 5;
const W = 150;
const H = 190;
const LEFT = 30;
const TOP = 34;
const GAP_X = (W - LEFT - 14) / (STRINGS - 1);
const GAP_Y = (H - TOP - 12) / FRETS_SHOWN;

interface Props {
  shape: ChordShape;
  rootPitchClass: number;
  pitchClassOf: (stringIndex: number, fret: number) => number;
  small?: boolean;
}

export function ChordDiagram({ shape, rootPitchClass, pitchClassOf, small }: Props) {
  const fretted = shape.frets.filter((f): f is number => f !== null && f > 0);
  const maxFret = Math.max(0, ...fretted);
  // Show from the nut if the shape fits in the first 5 frets, otherwise start at the lowest fret.
  const startFret = maxFret <= FRETS_SHOWN ? 1 : Math.min(...fretted);
  const atNut = startFret === 1;

  const sx = (s: number) => LEFT + s * GAP_X;
  const fy = (fret: number) => TOP + (fret - startFret + 0.5) * GAP_Y; // centre of fret space

  return (
    <svg className={`chord-diagram${small ? ' small' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Chord shape ${shape.frets.map((f) => f ?? 'x').join(' ')}`}>
      {/* frets */}
      {Array.from({ length: FRETS_SHOWN + 1 }, (_, i) => (
        <line key={i} x1={sx(0)} x2={sx(5)} y1={TOP + i * GAP_Y} y2={TOP + i * GAP_Y}
          className={i === 0 && atNut ? 'cd-nut' : 'cd-fret'} />
      ))}
      {/* strings */}
      {Array.from({ length: STRINGS }, (_, s) => (
        <line key={s} x1={sx(s)} x2={sx(s)} y1={TOP} y2={TOP + FRETS_SHOWN * GAP_Y} className="cd-string" />
      ))}
      {!atNut && (
        <text x={LEFT - 10} y={fy(startFret) + 4} className="cd-fretnum" textAnchor="end">
          {startFret}fr
        </text>
      )}
      {/* open / muted markers above the nut */}
      {shape.frets.map((f, s) =>
        f === null ? (
          <text key={s} x={sx(s)} y={TOP - 10} className="cd-mute" textAnchor="middle">×</text>
        ) : f === 0 ? (
          <circle key={s} cx={sx(s)} cy={TOP - 14} r={5}
            className={pitchClassOf(s, 0) === rootPitchClass ? 'cd-open root' : 'cd-open'} />
        ) : null,
      )}
      {/* barres */}
      {shape.barres.map((b) => (
        <rect key={`${b.fret}-${b.fromString}`} x={sx(b.fromString) - 9} y={fy(b.fret) - 9}
          width={sx(b.toString) - sx(b.fromString) + 18} height={18} rx={9} className="cd-barre" />
      ))}
      {/* finger dots */}
      {shape.frets.map((f, s) => {
        if (f === null || f === 0) return null;
        const isRoot = pitchClassOf(s, f) === rootPitchClass;
        const inBarre = shape.barres.some((b) => b.fret === f && s >= b.fromString && s <= b.toString);
        return (
          <g key={s}>
            {!inBarre && <circle cx={sx(s)} cy={fy(f)} r={9} className={isRoot ? 'cd-dot root' : 'cd-dot'} />}
            {inBarre && isRoot && <circle cx={sx(s)} cy={fy(f)} r={7} className="cd-dot root" />}
            <text x={sx(s)} y={fy(f) + 4} className="cd-finger" textAnchor="middle">
              {shape.fingers[s]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
