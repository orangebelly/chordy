import type { CSSProperties } from 'react';
import { THEMES, type ThemeId } from '../theme';

/** Compact swatch picker; each swatch shows the theme's background and surface tones. */
export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }) {
  const current = THEMES.find((t) => t.id === value)!;
  return (
    <div className="theme-picker">
      <span className="theme-name" aria-hidden="true">{current.name}</span>
      <div className="theme-swatches" role="radiogroup" aria-label="Colour theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={value === t.id}
            aria-label={t.name}
            title={t.name}
            className={`theme-swatch${value === t.id ? ' is-active' : ''}${t.id === 'system' ? ' is-system' : ''}`}
            style={{ '--a': t.swatch[0], '--b': t.swatch[1] } as CSSProperties}
            onClick={() => onChange(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
