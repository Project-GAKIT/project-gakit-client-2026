import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Preserve the source bundles used by the generators and scientific checks.
// The app reads small manifests and fetches only the selected frame's PNG.
const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv.includes('--source')
  ? path.resolve(process.argv[process.argv.indexOf('--source') + 1])
  : path.join(root, 'public/data/scenarios');
const output = process.argv.includes('--output')
  ? path.resolve(process.argv[process.argv.indexOf('--output') + 1])
  : path.join(root, 'public/data/scenario-assets');
await mkdir(output, { recursive: true });
const written = new Set();
let before = 0, after = 0;
for (const name of (await readdir(source)).filter(name => name.endsWith('.json'))) {
  const raw = await readFile(path.join(source, name), 'utf8');
  const data = JSON.parse(raw);
  for (const frame of data.frames) {
    for (const key of ['raster_uri', 'depth_raster_uri']) {
      const uri = frame[key];
      if (typeof uri !== 'string' || !uri.startsWith('data:image/png;base64,')) continue;
      const bytes = Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64');
      const filename = createHash('sha256').update(bytes).digest('hex') + '.png';
      if (!written.has(filename)) {
        await writeFile(path.join(output, filename), bytes);
        written.add(filename);
      }
      frame[key] = `/data/scenario-assets/${filename}`;
    }
  }
  const manifest = JSON.stringify(data);
  await writeFile(path.join(output, name), manifest);
  before += Buffer.byteLength(raw);
  after += Buffer.byteLength(manifest);
}
console.log(`Scenario manifests: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB; ${written.size} shared frame images.`);
