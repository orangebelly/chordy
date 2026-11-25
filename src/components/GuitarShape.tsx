import type { Chord } from '../utils/chordParser';
import { STANDARD_TUNING, type ChordShape } from '../utils/guitarShapes';
import { mod12 } from '../utils/musicTheory';
import { ChordDiagram } from './ChordDiagram';

interface Props {
  chord: Chord;
  shapes: ChordShape[];
  shapeIndex: number;
  onShapeIndexChange: (i: number) => void;
  onStrum: () => void;
}

export function GuitarShape({ chord, shapes, shapeIndex, onShapeIndexChange, onStrum }: Props) {
  const shape = shapes[shapeIndex];
  if (!shape) {
    return <p className="shape-help">Chord shapes are shown for standard tuning. Switch the fretboard tuning back to Standard to see them.</p>;
  }
  return (
    <div className="shape-panel">
      <ChordDiagram shape={shape} rootPitchClass={chord.root.pitchClass} pitchClassOf={(s, f) => mod12(STANDARD_TUNING[s] + f)} />
      <div className="shape-info">
        <div className="shape-title">
          {chord.symbol} <span className="shape-frets">{shape.frets.map((f) => f ?? 'x').join(' ')}</span>
        </div>
        <div className="shape-label">{shape.label}</div>
        <div className="shape-nav">
          <button className="btn small" disabled={shapes.length < 2}
            onClick={() => onShapeIndexChange((shapeIndex - 1 + shapes.length) % shapes.length)}
            aria-label="Previous shape">‹</button>
          <span>Shape {shapeIndex + 1} of {shapes.length}</span>
          <button className="btn small" disabled={shapes.length < 2}
            onClick={() => onShapeIndexChange((shapeIndex + 1) % shapes.length)}
            aria-label="Next shape">›</button>
        </div>
        <button className="btn small primary" onClick={onStrum}>▶ Strum this shape</button>
        <p className="shape-help">Numbers are fingers: 1 index, 2 middle, 3 ring, 4 pinky. × = don't play, ○ = open string.</p>
      </div>
    </div>
  );
}
