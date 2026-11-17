import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/** Static help stays outside clipping cards and supports pointer, touch and keyboard. */
export function ContextHelp({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointer = useRef('mouse');
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const show = () => {
    clearTimeout(timer.current);
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
      top: rect.bottom + 200 < window.innerHeight ? rect.bottom + 4 : Math.max(12, rect.top - 200) });
    setOpen(true);
  };
  const leave = () => {
    if (!pinned) timer.current = setTimeout(() => setOpen(false), 180);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setPinned(false); };
    const outside = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) close();
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', close);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  return <>
    <button ref={button} type="button" aria-label={'Bantuan ' + label} aria-expanded={open}
      aria-describedby={open ? id : undefined}
      onPointerDown={event => { pointer.current = event.pointerType; }}
      onPointerEnter={event => { if (event.pointerType === 'mouse') show(); }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') leave(); }}
      onFocus={() => { if (pointer.current !== 'touch') show(); }}
      onBlur={event => { if ((!pinned || event.relatedTarget) && !panel.current?.contains(event.relatedTarget as Node)) { setOpen(false); setPinned(false); } }}
      onClick={() => { if (pinned) { setOpen(false); setPinned(false); } else { show(); setPinned(true); } }}
      className="gp-help-button inline-flex align-middle items-center justify-center rounded-lg">
      <Info aria-hidden="true" className="w-4 h-4" />
    </button>
    {open && createPortal(<div ref={panel} id={id} role="tooltip"
      onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}
      className="gp-help-panel fixed z-[100] w-80 max-w-[calc(100vw-24px)] max-h-[min(190px,70vh)] overflow-auto"
      style={position}>{children}</div>, document.body)}
  </>;
}
