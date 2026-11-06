import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

it('preserves raster bytes and metadata, deduplicates images and keeps external URLs', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gakit-scenario-assets-'));
  const source = path.join(directory, 'source');
  const output = path.join(directory, 'output');
  mkdirSync(source);
  const images = [
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGNk23blLAMDAwMTiABhACOeAmF25L8LAAAAAElFTkSuQmCC',
  ];
  const uri = (index: number) => `data:image/png;base64,${images[index]}`;
  const original = { id: 'fixture', bounds: [[124.2, 8.2], [124.3, 8.3]], frames: [
    { hour_index: 0, raster_uri: uri(0), depth_raster_uri: uri(1), max_depth_m: 2 },
    { hour_index: 1, raster_uri: uri(0), depth_raster_uri: '/existing-depth.png', max_depth_m: 3 },
  ] };
  try {
    writeFileSync(path.join(source, 'fixture.json'), JSON.stringify(original));
    execFileSync(process.execPath, ['scripts/prepare-scenario-assets.mjs', '--source', source, '--output', output]);
    const compact = JSON.parse(readFileSync(path.join(output, 'fixture.json'), 'utf8'));
    expect(compact.frames[0].raster_uri).toBe(compact.frames[1].raster_uri);
    expect(readdirSync(output).filter(name => name.endsWith('.png'))).toHaveLength(2);
    compact.frames.forEach((frame: Record<string, string>, index: number) => {
      for (const key of ['raster_uri', 'depth_raster_uri'] as const) {
        const value = original.frames[index][key];
        if (!value.startsWith('data:')) continue;
        expect(readFileSync(path.join(output, path.basename(frame[key]))))
          .toEqual(Buffer.from(value.split(',')[1], 'base64'));
        frame[key] = value;
      }
    });
    expect(compact).toEqual(original);
  } finally {
    if (!directory.startsWith(path.join(tmpdir(), 'gakit-scenario-assets-'))) throw new Error('Invalid fixture path');
    rmSync(directory, { recursive: true, force: true });
  }
});
