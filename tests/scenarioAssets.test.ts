import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

it('extracts every raster without changing metadata or numeric-depth PNG bytes', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'gakit-scenario-assets-'));
  try {
    execFileSync(process.execPath, ['scripts/prepare-scenario-assets.mjs', '--output', output]);
    const source = path.resolve('public/data/scenarios');
    for (const name of readdirSync(source).filter(name => name.endsWith('.json'))) {
      const original = JSON.parse(readFileSync(path.join(source, name), 'utf8'));
      const compact = JSON.parse(readFileSync(path.join(output, name), 'utf8'));
      expect(readFileSync(path.join(output, name)).length).toBeLessThan(readFileSync(path.join(source, name)).length / 10);
      compact.frames.forEach((frame: Record<string, string>, index: number) => {
        for (const key of ['raster_uri', 'depth_raster_uri']) {
          if (!original.frames[index][key]?.startsWith('data:image/png;base64,')) continue;
          const bytes = readFileSync(path.join(output, path.basename(frame[key])));
          expect(bytes.equals(Buffer.from(original.frames[index][key].split(',')[1], 'base64'))).toBe(true);
          frame[key] = original.frames[index][key];
        }
      });
      expect(compact).toEqual(original);
    }
  } finally {
    for (const name of readdirSync(output)) unlinkSync(path.join(output, name));
    rmdirSync(output);
  }
});
