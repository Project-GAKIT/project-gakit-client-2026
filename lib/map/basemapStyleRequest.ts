import { BASEMAP_STYLES, type BasemapId } from '@/constants/publicMap';
import type { StyleSpecification } from 'maplibre-gl';

/** Fetch before replacing a working style. Abort and generation checks ensure
 * that a late response can never replace a more recent user choice. */
export class BasemapStyleRequest {
  private generation = 0;
  private controller?: AbortController;

  cancel() { this.generation++; this.controller?.abort(); }

  async load(basemap: BasemapId, apply: (style: StyleSpecification) => void): Promise<void> {
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const source = BASEMAP_STYLES[basemap];
      let style: StyleSpecification;
      if (typeof source === 'string') {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`Basemap request failed (${response.status})`);
        style = await response.json();
        if (style.version !== 8 || !style.sources || !Array.isArray(style.layers)) throw new Error('Invalid basemap style');
      } else { style = source; }
      if (generation === this.generation) apply(style);
    } catch (error) {
      if (generation === this.generation && !controller.signal.aborted) throw error;
    }
  }
}
