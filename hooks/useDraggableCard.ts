'use client';

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

/** Move only the card's DOM transform; no state updates or map work per frame. */
export function useDraggableCard(enabled = true) {
  const panelRef = useRef<HTMLElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const paintedPosition = useRef({ x: 0, y: 0 });
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const paint = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (panelRef.current) panelRef.current.style.transform = `translate3d(${position.current.x}px,${position.current.y}px,0)`;
    paintedPosition.current = { ...position.current };
    frame.current = null;
  }, []);
  const bounds = useCallback(() => {
    if (!panelRef.current) return null;
    const panel = panelRef.current.getBoundingClientRect();
    const container = panelRef.current.parentElement!;
    const parent = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    const inset = parseFloat(style.getPropertyValue('--map-edge-gap')) || 12;
    const headerBottom = parseFloat(style.getPropertyValue('--map-header-bottom'));
    const minY = Number.isFinite(headerBottom) ? Math.max(inset, headerBottom - parent.top + inset) : 80;
    const clearance = parseFloat(style.getPropertyValue('--flood-player-clearance')) || 100;
    return { left: panel.left - parent.left - paintedPosition.current.x, top: panel.top - parent.top - paintedPosition.current.y,
      inset, minY, maxX: Math.max(inset, parent.width - panel.width - inset), maxY: Math.max(minY, parent.height - panel.height - clearance) };
  }, []);
  // Expanding a centered card changes its top edge as well as its height.
  // Recheck the rendered geometry after size changes, not just at drag start.
  useEffect(() => {
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    if (!enabled) {
      drag.current = null;
      position.current = { x: 0, y: 0 };
      paint();
      return;
    }
    const clamp = () => {
      const area = bounds();
      if (!area) return;
      const x = Math.min(area.maxX - area.left, Math.max(area.inset - area.left, position.current.x));
      const y = Math.min(area.maxY - area.top, Math.max(area.minY - area.top, position.current.y));
      if (x === position.current.x && y === position.current.y) return;
      position.current = { x, y };
      paint();
    };
    const observer = new ResizeObserver(clamp);
    observer.observe(panel);
    observer.observe(container);
    window.addEventListener('resize', clamp);
    clamp();
    return () => { observer.disconnect(); window.removeEventListener('resize', clamp); };
  }, [enabled, bounds, paint]);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (!enabled || event.button !== 0 || !bounds()) return;
    drag.current = { pointer: event.pointerId, x: event.clientX - position.current.x, y: event.clientY - position.current.y };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    const area = bounds();
    if (!active || !area || event.pointerId !== active.pointer) return;
    position.current = { x: Math.min(area.maxX - area.left, Math.max(area.inset - area.left, event.clientX - active.x)),
      y: Math.min(area.maxY - area.top, Math.max(area.minY - area.top, event.clientY - active.y)) };
    if (frame.current === null) frame.current = requestAnimationFrame(paint);
  };
  const keyMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key];
    const area = bounds();
    if (!enabled || !delta || !area) return;
    event.preventDefault();
    position.current = { x: Math.min(area.maxX - area.left, Math.max(area.inset - area.left, position.current.x + delta[0])),
      y: Math.min(area.maxY - area.top, Math.max(area.minY - area.top, position.current.y + delta[1])) };
    paint();
  };
  return { panelRef, start, move, keyMove, end: () => { drag.current = null; } };
}
