import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScenarioData } from '@/types/scenario';
import { SCENARIO_PRESETS } from '@/types/scenario';

const directory = path.resolve(process.cwd(), 'public/data/scenarios');
const names = readdirSync(directory).filter(name => name.endsWith('.json'));

function hasNumericDepth(uri: string): boolean {
  const bytes = Buffer.from(uri.split(',')[1], 'base64');
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    if (offset + size + 12 > bytes.length) return false;
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'gdEP') {
      return size > 12 && bytes.toString('ascii', offset + 8, offset + 12) === 'GDK1';
    }
    offset += size + 12;
  }
  return false;
}

describe('bundled illustrative scenario integrity', () => {
  it('Basyang uses 24 corrected hours and a zero initial state, with matching picker total', () => {
    const data = JSON.parse(readFileSync(path.join(directory, 'basyang.json'), 'utf8'));
    expect(data.rainfall_forcing.model.id).toBe('pooled_tail');
    expect(data.rainfall_forcing.reference_total_scaling).toBe(false);
    expect(data.source_label).toBe('Corrected JAXA NOW · Iligan');
    expect(data.reference_total_mm).toBeNull();
    expect(data.frames).toHaveLength(25);
    expect(data.frames[0].hourly_rain_mm).toBe(0);
    expect(data.frames[0].cum_rain_mm).toBe(0);
    const start = Date.parse(data.rainfall_forcing.interval_start_utc);
    data.frames.forEach((frame: ScenarioData['frames'][number], i: number) => {
      expect(Date.parse(frame.raw_time)).toBe(start + i * 3600000);
      expect(frame.effective_rainfall_mm).toBe(frame.cum_rain_mm);
    });
    expect(data.total_rainfall_mm).toBe(110.61);
    expect(data.raster_generation.forcing).toBe('corrected_hourly_cumulative');
    expect(SCENARIO_PRESETS.find(p => p.id === 'basyang')?.totalRain).toBe('110.61 mm');
    expect(JSON.parse(readFileSync(path.join(directory, 'penha.json'), 'utf8'))).toEqual(data);
  });
  it.each(names)('%s has consistent rainfall and does not claim hydraulic validation', name => {
    const data = JSON.parse(readFileSync(path.join(directory, name), 'utf8')) as ScenarioData;
    expect(data.scenario_contract).toBe('static-illustration-v1');
    expect(data.is_calibrated).toBe(false);
    expect(data.official_total_mm).toBeNull();
    expect(data.model_notice).toContain('not been independently validated');
    expect(data.frames).toHaveLength(data.total_frames);
    let cents = 0;
    data.frames.forEach((frame, index) => {
      expect(frame.hour_index).toBe(index);
      expect(frame.hourly_rain_mm).toBeGreaterThanOrEqual(0);
      cents += Math.round(frame.hourly_rain_mm! * 100);
      expect(frame.cum_rain_mm).toBe(cents / 100);
      expect(frame.raster_uri).toMatch(/^data:image\/png;base64,/);
      expect(hasNumericDepth(frame.raster_uri), `${name} frame ${index} needs numeric depths`).toBe(true);
      expect(frame.q_peak_m3s).toBeNull();
    });
    expect(data.total_rainfall_mm).toBe(cents / 100);
  });
});
