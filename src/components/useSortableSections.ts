import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { moveTo } from '../layout';

export interface DragState<T> {
  id: T;
  /** Insert position in the list without the dragged section */
  target: number;
  /** Drop-indicator offset from the top of the stack (px) */
  indicatorTop: number;
  x: number;
  y: number;
}

/**
 * Pointer-based drag-to-reorder for a vertical stack of `[data-section-id]` children.
 * Works with mouse, pen and touch; auto-scrolls near the window edges; Esc cancels.
 * Arrow keys on the handle move a section up/down for keyboard users.
 */
export function useSortableSections<T extends string>(order: T[], setOrder: (o: T[]) => void) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const focusAfterMove = useRef<T | null>(null);

  // Keep keyboard focus on the handle after a keyboard move re-orders the DOM.
  useEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    focusAfterMove.current = null;
    stackRef.current?.querySelector<HTMLElement>(`[data-section-id="${id}"] .drag-handle`)?.focus();
  }, [order]);

  function measure(id: T, clientY: number) {
    const stack = stackRef.current!;
    const others = [...stack.querySelectorAll<HTMLElement>(':scope > [data-section-id]')].filter(
      (el) => el.dataset.sectionId !== id,
    );
    let target = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = others[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    const top = stack.getBoundingClientRect().top;
    const indicatorTop =
      target < others.length
        ? others[target].getBoundingClientRect().top - top
        : others[others.length - 1].getBoundingClientRect().bottom - top;
    return { target, indicatorTop };
  }

  function startDrag(id: T, e: PointerEvent) {
    if (e.button !== 0 || !stackRef.current) return;
    e.preventDefault();
    let x = e.clientX;
    let y = e.clientY;
    let current = measure(id, y);
    let raf = 0;
    const update = () => {
      current = measure(id, y);
      setDrag({ id, ...current, x, y });
    };
    const onMove = (ev: globalThis.PointerEvent) => {
      x = ev.clientX;
      y = ev.clientY;
      update();
    };
    const tick = () => {
      const top = 90;
      const bottom = window.innerHeight - 150; // keep clear of the transport dock
      const dy = y < top ? -(top - y) / 3 : y > bottom ? (y - bottom) / 3 : 0;
      if (dy) {
        window.scrollBy(0, dy);
        update();
      }
      raf = requestAnimationFrame(tick);
    };
    const finish = (commit: boolean) => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('is-sorting');
      setDrag(null);
      if (commit) setOrder(moveTo(order, id, current.target));
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev: globalThis.KeyboardEvent) => ev.key === 'Escape' && finish(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('is-sorting');
    update();
    raf = requestAnimationFrame(tick);
  }

  function onHandleKeyDown(id: T, e: KeyboardEvent) {
    const i = order.indexOf(id);
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = i + delta;
    if (next < 0 || next >= order.length) return;
    focusAfterMove.current = id;
    setOrder(moveTo(order, id, next));
  }

  return { stackRef, drag, startDrag, onHandleKeyDown };
}
