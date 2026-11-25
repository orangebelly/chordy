// Small functional stroke icons (16px grid). Decorative icons are deliberately avoided.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const PlayIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" /></svg>
);
export const StopIcon = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor" stroke="none" /></svg>
);
/** Rising notes = arpeggio */
export const ArpeggioIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);
export const ChevronIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 4l4 4-4 4" /></svg>
);
export const PrevIcon = (p: P) => (
  <svg {...base(p)}><path d="M10 4l-4 4 4 4" /></svg>
);
export const NextIcon = ChevronIcon;
export const ArrowLeftIcon = (p: P) => (
  <svg {...base(p)}><path d="M13 8H3m4-4L3 8l4 4" /></svg>
);
export const ArrowRightIcon = (p: P) => (
  <svg {...base(p)}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 4l8 8M12 4l-8 8" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}><path d="M8 3v10M3 8h10" /></svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base(p)}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
);
export const PianoIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="1.75" y="3" width="12.5" height="10" rx="1.5" />
    <path d="M5.9 13V9M10.1 13V9" />
    <path d="M4.6 3v6h2.6V3M8.8 3v6h2.6V3" fill="currentColor" />
  </svg>
);
export const GuitarIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.5 6.5L13.5 2.5M12.2 2l1.8 1.8" />
    <path d="M8.2 5.6c-1.3-.5-2.6-.2-3.4.6-.6.6-.7 1.4-1.3 2-.6.5-1.5.6-2 1.3-.9 1.2-.5 3 .8 4.2 1.2 1.3 3 1.7 4.2.8.7-.5.8-1.4 1.3-2 .6-.6 1.4-.7 2-1.3.8-.8 1.1-2.1.6-3.4" />
    <circle cx="6.3" cy="9.7" r="1" fill="currentColor" stroke="none" />
  </svg>
);
/** Six-dot drag handle */
export const GripIcon = (p: P) => (
  <svg {...base(p)}>
    {[4.5, 8, 11.5].map((y) => (
      <g key={y}>
        <circle cx="6" cy={y} r="1.1" fill="currentColor" stroke="none" />
        <circle cx="10" cy={y} r="1.1" fill="currentColor" stroke="none" />
      </g>
    ))}
  </svg>
);
