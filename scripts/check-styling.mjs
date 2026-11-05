import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const exceptions = JSON.parse(await readFile(path.join(root, 'styles/color-exceptions.json'), 'utf8'));
const literal = /#[0-9a-fA-F]{3,8}\b|rgba?\((?!var\()[^)]*\)|(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring|from|to|via|divide|placeholder|fill|stroke|outline|accent)-(?:white|black|(?:slate|gray|zinc|neutral|stone|maroon|red|rose|orange|green|emerald|teal|amber|yellow|blue|sky|cyan|indigo|violet|purple)-\d+|canvas-(?:white|light|lighter|grey)|gakit-maroon(?:-light)?)(?![\w-])/g;
const issues = [];
let files = 0;
async function scan(directory) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await scan(relative); continue; }
    if (!/\.(?:tsx?|css)$/.test(entry.name)) continue;
    files++;
    const source = await readFile(path.join(root, relative), 'utf8');
    const approved = exceptions[relative];
    for (const match of source.matchAll(literal)) {
      if (approved?.reason && approved.tokens.includes(match[0])) continue;
      const line = source.slice(0, match.index).split('\n').length;
      issues.push(`${relative}:${line}: ${match[0]}`);
    }
  }
}
for (const directory of ['app', 'components', 'hooks', 'lib', 'styles']) await scan(directory);
if (issues.length) {
  console.error('Use semantic colors for UI. For deliberate data paint or artwork, document the exact token and reason in styles/color-exceptions.json.\n' + issues.join('\n'));
  process.exitCode = 1;
} else { console.log(`Styling check passed (${files} source files; documented palette/artwork exceptions only).`); }
