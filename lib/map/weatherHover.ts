interface WeatherHoverOptions {
  layer: string;
  sample: (lng: number, lat: number) => string | null;
  available: () => boolean;
}
interface HoverEvent { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }
interface WeatherHoverController {
  add: (options: WeatherHoverOptions) => () => void;
}
const controllers = new WeakMap<object, WeatherHoverController>();

/** Shared, stacked weather readout. One animation frame and no network/React work per move. */
export function attachWeatherHover(map: any, options: WeatherHoverOptions): () => void {
  let controller = controllers.get(map);
  if (!controller) {
    const container: HTMLElement = map.getContainer();
    const canvas: HTMLElement = map.getCanvas();
    const tooltip = document.createElement('div');
    tooltip.className = 'pointer-events-none absolute z-30 space-y-0.5 whitespace-nowrap rounded-md bg-panel px-1.5 py-1 text-xs font-semibold leading-4 tabular-nums text-accent-text shadow-panel';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.style.display = 'none';
    container.append(tooltip);
    const entries = new Map<WeatherHoverOptions, HTMLElement>();
    let pending = 0;
    let last: HoverEvent | null = null;
    const available = (entry: WeatherHoverOptions) => entry.available() && map.getLayer(entry.layer)
      && map.getLayoutProperty(entry.layer, 'visibility') !== 'none';
    const hide = () => {
      last = null;
      if (pending) cancelAnimationFrame(pending);
      pending = 0;
      tooltip.style.display = 'none';
    };
    const update = () => {
      pending = 0;
      if (!last || map.isMoving()) { hide(); return; }
      let count = 0;
      for (const [entry, row] of entries) {
        const value = available(entry) ? entry.sample(last.lngLat.lng, last.lngLat.lat) : null;
        row.style.display = value === null ? 'none' : 'block';
        if (value !== null) {
          if (row.textContent !== value) row.textContent = value;
          count++;
        }
      }
      tooltip.style.display = count ? 'block' : 'none';
      if (!count) return;
      tooltip.style.maxWidth = `${Math.max(0, container.clientWidth - 16)}px`;
      const { x, y } = last.point;
      const left = x + 14 + tooltip.offsetWidth <= container.clientWidth - 8 ? x + 14 : x - tooltip.offsetWidth - 14;
      const top = y + 14 + tooltip.offsetHeight <= container.clientHeight - 8 ? y + 14 : y - tooltip.offsetHeight - 14;
      tooltip.style.left = `${Math.max(8, Math.min(left, container.clientWidth - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(top, container.clientHeight - tooltip.offsetHeight - 8))}px`;
    };
    const move = (event: HoverEvent) => {
      last = event;
      if (!pending) pending = requestAnimationFrame(update);
    };
    const render = () => {
      if (!last) return;
      if (map.isMoving()) { hide(); return; }
      // Remove disabled/expired rows without resampling unchanged data on every render.
      let count = 0;
      for (const [entry, row] of entries) {
        if (!available(entry)) row.style.display = 'none';
        if (row.style.display !== 'none') count++;
      }
      if (!count) tooltip.style.display = 'none';
    };
    const events = { mousemove: move, movestart: hide, 'style.load': hide, render, remove: hide };
    for (const [name, callback] of Object.entries(events)) map.on(name, callback);
    container.addEventListener('mouseleave', hide);
    canvas.addEventListener('mouseleave', hide);
    controller = {
      add: entry => {
        const row = document.createElement('div');
        row.style.display = 'none';
        entries.set(entry, row);
        tooltip.append(row);
        if (last && !pending) pending = requestAnimationFrame(update);
        return () => {
          entries.delete(entry);
          row.remove();
          if (entries.size) { if (last && !pending) pending = requestAnimationFrame(update); return; }
          hide();
          tooltip.remove();
          for (const [name, callback] of Object.entries(events)) map.off(name, callback);
          container.removeEventListener('mouseleave', hide);
          canvas.removeEventListener('mouseleave', hide);
          controllers.delete(map);
        };
      },
    };
    controllers.set(map, controller);
  }
  return controller.add(options);
}
