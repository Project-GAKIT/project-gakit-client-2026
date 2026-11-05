'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AppearanceSelector } from '@/components/AppearanceSelector';

export interface DisplayPopoverProps {
  children?: ReactNode;
  className?: string;
  placement?: 'above' | 'below';
  align?: 'start' | 'end';
  compact?: boolean;
}

/** Appearance is always available, including while map controls are loading. */
export function DisplayPopover({ children, className = '', placement = 'below', compact = false, align = 'end' }: DisplayPopoverProps) {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 8, width: 304, maxHeight: 400 });
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    const resize = () => setOpen(false);
    if (align === 'start') window.addEventListener('resize', resize);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true); window.removeEventListener('resize', resize); };
  }, [open, align]);
  return (
    <div ref={container} className={`relative ${className}`}>
      <button ref={trigger} type="button" onClick={event => {
        if (!open && align === 'start') {
          const bounds = event.currentTarget.getBoundingClientRect();
          const workspace = container.current?.closest('[data-map-workspace]')?.getBoundingClientRect();
          const leftEdge = Math.max(8, (workspace?.left ?? 0) + 8);
          const rightEdge = Math.min(window.innerWidth - 8, (workspace?.right ?? window.innerWidth) - 8);
          const width = Math.min(304, rightEdge - leftEdge);
          const top = bounds.bottom + 8;
          setPopupPosition({ top, left: Math.max(leftEdge, Math.min(bounds.left, rightEdge - width)), width,
            maxHeight: Math.max(80, Math.min(window.innerHeight, workspace?.bottom ?? window.innerHeight) - top - 8) });
        }
        setOpen(value => !value);
      }} aria-label="Display settings" title="Display settings"
        aria-expanded={open} aria-controls={id} className={`flex w-max shrink-0 items-center justify-center gap-1 rounded-full px-2 font-semibold text-secondary transition-colors hover:bg-muted md:gap-1.5 md:px-2.5 md:text-[11px] ${compact ? (align === 'start' ? 'h-[30px]' : 'h-8') : 'h-10 md:h-9'} ${open ? 'bg-muted text-secondary ring-1 ring-default' : ''}`}>
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 md:hidden" aria-hidden="true" />
        <span className="hidden md:inline">Display</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform md:h-3.5 md:w-3.5 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <>
        {align !== 'start' && <div className="fixed inset-0 z-[1290] bg-scrim/20 md:hidden" onClick={close} aria-hidden="true" />}
        <div id={id} role="region" aria-label="Display settings" data-header-dropdown={(align !== 'start' && placement === 'below') || undefined}
          style={align === 'start' ? { position: 'fixed', ...popupPosition } : undefined}
          className={align === 'start' ? 'z-[1300] overflow-y-auto overscroll-contain rounded-2xl border border-default bg-panel text-primary shadow-xl' : `${placement === 'below' ? 'map-header-dropdown' : ''} fixed inset-x-4 top-16 z-[1300] mx-auto max-h-[calc(100dvh-10rem-env(safe-area-inset-bottom,0px))] max-w-[320px] overflow-y-auto overscroll-contain rounded-2xl border border-default bg-panel/95 p-3 text-primary shadow-xl backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:w-80 md:max-h-[calc(100dvh-5rem)] ${placement === 'above' ? 'md:top-auto md:bottom-full md:mb-2' : 'md:top-12'}`}>
          <div className={align === 'start' ? 'flex items-center justify-between gap-2 border-b border-default px-3 py-2' : 'mb-2 flex items-center justify-between border-b border-default pb-1.5'}>
            <h3 className="text-xs font-bold">Display settings</h3>
          </div>
          <div className={align === 'start' ? 'space-y-3 px-3 py-3' : 'space-y-3'}>
            <AppearanceSelector compact label="Appearance" />
            {children && <div className="border-t border-default pt-3">{children}</div>}
          </div>

        </div>
      </>}
    </div>
  );
}
