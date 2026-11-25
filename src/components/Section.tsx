import { useEffect, useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ChevronIcon, GripIcon } from './Icons';

const STORAGE_KEY = 'chord-visualizer.sections.v1';

function readFolded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

interface Props {
  /** Stable key used to remember whether this section is collapsed */
  id: string;
  title: string;
  /** Short text shown next to the title while collapsed (e.g. the current chord) */
  summary?: ReactNode;
  /** Controls kept in the header (they don't toggle the section) */
  actions?: ReactNode;
  children: ReactNode;
  /** Drag-to-reorder wiring (from useSortableSections) */
  drag?: {
    onPointerDown: (e: PointerEvent) => void;
    onKeyDown: (e: KeyboardEvent) => void;
    isDragging: boolean;
  };
}

/** A card with a clickable header that folds its content away. Remembers its state per browser. */
export function Section({ id, title, summary, actions, children, drag }: Props) {
  const [open, setOpen] = useState(() => !readFolded()[id]);
  const bodyId = useId();

  useEffect(() => {
    try {
      const folded = readFolded();
      if (open) delete folded[id];
      else folded[id] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(folded));
    } catch {
      /* storage unavailable — state just won't be remembered */
    }
  }, [id, open]);

  return (
    <section
      className={`section section--${id}${open ? '' : ' is-folded'}${drag?.isDragging ? ' is-dragging' : ''}`}
      data-section-id={id}
    >
      <header className="section-head">
        {drag && (
          <button
            className="drag-handle"
            onPointerDown={drag.onPointerDown}
            onKeyDown={drag.onKeyDown}
            aria-label={`Move ${title} section. Drag, or use the up and down arrow keys.`}
            title="Drag to move this section"
          >
            <GripIcon />
          </button>
        )}
        <button className="section-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
          <ChevronIcon className="section-chevron" />
          <span className="section-label">{title}</span>
          {!open && summary && <span className="section-summary">{summary}</span>}
        </button>
        {open && actions && <div className="section-actions">{actions}</div>}
      </header>
      {open && (
        <div className="section-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
