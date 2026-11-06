import { afterEach, expect, it, vi } from 'vitest';
import { attachWeatherHover } from '@/lib/map/weatherHover';
import { containsMaskPoint, prepareMaskPolygons } from '@/lib/map/heatLandMask';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('stacks both layers in one tooltip, throttles movement and removes disabled rows', () => {
  class Element {
    className = ''; textContent = ''; style: Record<string, string> = {};
    clientWidth = 500; clientHeight = 400; offsetWidth = 70; offsetHeight = 24;
    children: Element[] = []; listeners = new Map<string, () => void>();
    append(element: Element) { this.children.push(element); }
    setAttribute() {} remove = vi.fn();
    addEventListener(name: string, callback: () => void) { this.listeners.set(name, callback); }
    removeEventListener(name: string) { this.listeners.delete(name); }
  }
  const container = new Element(), canvas = new Element();
  vi.stubGlobal('document', { createElement: () => new Element() });
  const frames = new Map<number, () => void>();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.set(1, callback); return 1; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const events = new Map<string, (...args: any[]) => void>();
  let rainVisible = true;
  const map = { getContainer: () => container, getCanvas: () => canvas, getLayer: () => ({}),
    getLayoutProperty: (layer: string) => layer === 'rainfall-grid' && !rainVisible ? 'none' : 'visible', isMoving: () => false,
    on: (name: string, callback: (...args: any[]) => void) => { expect(events.has(name)).toBe(false); events.set(name, callback); },
    off: (name: string) => events.delete(name) };
  const rain = vi.fn((lng: number) => `${lng.toFixed(1)} mm`);
  const heat = vi.fn(() => '32.1 C');
  const detachRain = attachWeatherHover(map, { layer: 'rainfall-grid', available: () => true, sample: rain });
  const detachHeat = attachWeatherHover(map, { layer: 'heat-index-layer', available: () => true, sample: heat });
  expect(container.children).toHaveLength(1);
  const tooltip = container.children[0];
  const move = (lng: number, x: number) => events.get('mousemove')!({ lngLat: { lng, lat: 8 }, point: { x, y: 20 } });
  const flush = () => { const callback = frames.get(1)!; frames.clear(); callback(); };
  move(124.1, 20); move(124.2, 30); flush();
  expect(rain).toHaveBeenCalledOnce(); expect(heat).toHaveBeenCalledOnce();
  expect(tooltip.children.map(row => row.textContent)).toEqual(['124.2 mm', '32.1 C']);
  const initialLeft = tooltip.style.left;
  move(124.3, 40); flush();
  expect(tooltip.style.left).not.toBe(initialLeft);
  expect(tooltip.children[0].textContent).toBe('124.3 mm');
  rainVisible = false; events.get('render')!();
  expect(tooltip.children[0].style.display).toBe('none');
  expect(tooltip.children[1].style.display).toBe('block');
  canvas.listeners.get('mouseleave')!();
  expect(tooltip.style.display).toBe('none');
  detachRain(); expect(events.size).toBe(5);
  detachHeat(); expect(events.size).toBe(0);
  expect(canvas.listeners.size).toBe(0); expect(container.listeners.size).toBe(0);
  expect(tooltip.remove).toHaveBeenCalledOnce();
});

it('uses land polygon bounds and excludes holes', () => {
  const polygons = prepareMaskPolygons({ type: 'Polygon', coordinates: [
    [[120, 6], [126, 6], [126, 12], [120, 12], [120, 6]],
    [[122, 8], [124, 8], [124, 10], [122, 10], [122, 8]],
  ] });
  expect(containsMaskPoint(polygons, 121, 7)).toBe(true);
  expect(containsMaskPoint(polygons, 123, 9)).toBe(false);
  expect(containsMaskPoint(polygons, 130, 9)).toBe(false);
});
