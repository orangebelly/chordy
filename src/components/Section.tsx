import { useEffect, useId, useState, type ReactNode } from 'react';

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
}

/** A card with a clickable header that folds its content away. Remembers its state per browser. */
export function Section({ id, title, summary, actions, children }: Props) {
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
    <section className={`card section${open ? '' : ' folded'}`}>
      <div className="section-header">
        <button className="section-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
          <span className="chevron" aria-hidden="true">▸</span>
          <h3>{title}</h3>
          {!open && summary && <span className="section-summary">{summary}</span>}
        </button>
        {open && actions && <div className="section-actions">{actions}</div>}
      </div>
      {open && (
        <div className="section-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
