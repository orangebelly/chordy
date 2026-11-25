import type { Chord } from '../utils/chordParser';
import { STANDARD_TUNING, type ChordShape } from '../utils/guitarShapes';
import { mod12 } from '../utils/musicTheory';
import { ChordDiagram } from './ChordDiagram';
import { NextIcon, PlayIcon, PrevIcon } from './Icons';

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
    return <p className="hint">Chord shapes are shown for standard tuning. Switch the fretboard tuning back to Standard to see them.</p>;
  }
  return (
    <div className="shape-panel">
      <div className="shape-stage">
        <ChordDiagram shape={shape} rootPitchClass={chord.root.pitchClass} pitchClassOf={(s, f) => mod12(STANDARD_TUNING[s] + f)} />
      </div>
      <div className="shape-info">
        <div className="shape-title">
          <span className="shape-symbol">{chord.symbol}</span>
          <span className="shape-frets">{shape.frets.map((f) => f ?? 'x').join(' ')}</span>
        </div>
        <div className="shape-label">{shape.label}</div>
        <div className="shape-controls">
          <div className="stepper" role="group" aria-label="Choose shape">
            <button className="icon-btn" disabled={shapes.length < 2}
              onClick={() => onShapeIndexChange((shapeIndex - 1 + shapes.length) % shapes.length)}
              aria-label="Previous shape"><PrevIcon /></button>
            <span className="stepper-value">{shapeIndex + 1} / {shapes.length}</span>
            <button className="icon-btn" disabled={shapes.length < 2}
              onClick={() => onShapeIndexChange((shapeIndex + 1) % shapes.length)}
              aria-label="Next shape"><NextIcon /></button>
          </div>
          <button className="btn btn--outline btn--sm" onClick={onStrum}><PlayIcon /> Strum</button>
        </div>
        <p className="hint">Numbers are fingers: 1 index · 2 middle · 3 ring · 4 pinky. × don’t play · ○ open string.</p>
      </div>
    </div>
  );
}
