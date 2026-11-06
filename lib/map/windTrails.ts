import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ForecastWeather, ForecastWeatherFrame } from '@/types/forecastWeather';
import { sampleForecast } from './forecastWeather';

/** Independent canvas: animating wind never repaints map tiles or 3D buildings. */
export function createWindTrails(map: MapLibreMap, grid: ForecastWeather, frame: ForecastWeatherFrame): () => void {
  const canvas = document.createElement('canvas');
  canvas.dataset.windTrails = 'true';
  canvas.dataset.windValidAt = grid.times[grid.frames.indexOf(frame)];
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none', width: '100%', height: '100%' });
  map.getCanvasContainer().appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { canvas.remove(); return () => {}; }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  let width = 0, height = 0, cols = 0, rows = 0;
  let flow = new Float32Array(0);
  const step = 28;
  const count = coarse ? 260 : 650;
  const particles = new Float32Array(count * 3);
  let activeCount = count, animation = 0, timer: ReturnType<typeof setTimeout> | undefined, disposed = false, last = 0;
  let slowFrames = 0;
  let hasWind = false;
  const clear = () => ctx.clearRect(0, 0, width, height);
  const stop = () => { cancelAnimationFrame(animation); clearTimeout(timer); animation = 0; last = 0; };
  const seed = (i: number) => { particles[i] = Math.random() * width; particles[i + 1] = Math.random() * height; particles[i + 2] = 1 + Math.random() * 3; };
  const vectorAt = (x: number, y: number): [number, number] | null => {
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    const offset = (Math.min(rows - 1, Math.floor(y / step)) * cols + Math.min(cols - 1, Math.floor(x / step))) * 2;
    const u = flow[offset], v = flow[offset + 1];
    return Number.isFinite(u) && Number.isFinite(v) ? [u, v] : null;
  };
  const rebuild = () => {
    stop();
    width = map.getCanvas().clientWidth; height = map.getCanvas().clientHeight;
    // Cap pixel count; high-DPI displays must not multiply animation cost.
    const scale = Math.min(1, Math.sqrt(1_500_000 / Math.max(1, width * height)));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    cols = Math.ceil(width / step); rows = Math.ceil(height / step);
    flow = new Float32Array(cols * rows * 2).fill(NaN);
    hasWind = false;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const position = map.unproject([col * step + step / 2, row * step + step / 2]);
      const u = sampleForecast(grid, frame.u, position.lng, position.lat), v = sampleForecast(grid, frame.v, position.lng, position.lat);
      if (u == null || v == null) continue;
      const speed = Math.hypot(u, v);
      if (speed < .15) continue;
      const a = map.project(position);
      const b = map.project([position.lng + u * .005 / Math.cos(position.lat * Math.PI / 180), position.lat + v * .005]);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!length) continue;
      const visualSpeed = Math.min(55, 10 + speed * 1.8);
      const offset = (row * cols + col) * 2;
      flow[offset] = (b.x - a.x) / length * visualSpeed;
      flow[offset + 1] = (b.y - a.y) / length * visualSpeed;
      hasWind = true;
    }
    for (let i = 0; i < particles.length; i += 3) seed(i);
    clear();
    resume();
  };
  const arrows = () => {
    clear(); ctx.strokeStyle = 'rgba(100,116,139,.85)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let y = 36; y < height; y += 90) for (let x = 36; x < width; x += 90) {
      const vector = vectorAt(x, y);
      if (!vector) continue;
      const angle = Math.atan2(vector[1], vector[0]), dx = Math.cos(angle) * 12, dy = Math.sin(angle) * 12;
      ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy);
      for (const offset of [-.55, .55]) { ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx - Math.cos(angle + offset) * 6, y + dy - Math.sin(angle + offset) * 6); }
    }
    ctx.stroke();
  };
  const draw = (time: number) => {
    animation = 0;
    if (disposed || document.hidden || map.isMoving() || !hasWind || Date.now() >= Date.parse(grid.expiresAt)) { clear(); return; }
    const began = performance.now(), dt = last ? Math.min(.06, (time - last) / 1000) : 1 / 30;
    last = time;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    // Two strokes keep trails readable on both light and satellite basemaps.
    ctx.beginPath();
    for (let n = 0; n < activeCount; n++) {
      const i = n * 3, x = particles[i], y = particles[i + 1];
      const vector = vectorAt(x, y);
      particles[i + 2] -= dt;
      if (!vector || particles[i + 2] <= 0) { seed(i); continue; }
      const nx = x + vector[0] * dt, ny = y + vector[1] * dt;
      ctx.moveTo(x, y); ctx.lineTo(nx, ny);
      particles[i] = nx; particles[i + 1] = ny;
    }
    ctx.strokeStyle = 'rgba(15,23,42,.22)'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.stroke();
    if (performance.now() - began > 10 && ++slowFrames >= 5) { activeCount = Math.max(100, Math.floor(activeCount * .75)); slowFrames = 0; }
    timer = setTimeout(() => { animation = requestAnimationFrame(draw); }, 1000 / 30);
  };
  function resume() {
    stop();
    if (disposed || document.hidden || map.isMoving()) return;
    if (motion.matches) arrows();
    else animation = requestAnimationFrame(draw);
  }
  const moving = () => { stop(); clear(); };
  const visibility = () => { if (document.hidden) { stop(); clear(); } else rebuild(); };
  map.on('movestart', moving); map.on('moveend', rebuild); map.on('resize', rebuild);
  map.on('remove', moving);
  document.addEventListener('visibilitychange', visibility); motion.addEventListener('change', resume);
  rebuild();
  return () => {
    disposed = true; stop(); canvas.remove();
    map.off('movestart', moving); map.off('moveend', rebuild); map.off('resize', rebuild); map.off('remove', moving);
    document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', resume);
  };
}
