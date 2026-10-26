/** Refresh searchable route labels from integrity-checked published packs. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { worldLibraryPage } from '../optional-practice/civilian-fpv/world-library.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = async (name) => {
  try {
    return await readFile(path.join(root, name));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return execFileSync('git', ['show', `HEAD:${name}`], {
      cwd: root,
      maxBuffer: 32 * 1024 * 1024,
    });
  }
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rows = [];
let page = { path: 'authoring/fpv-worlds/published/free-worlds-v2/index.json' };
const seen = new Set();
while (page) {
  if (seen.has(page.path)) throw new Error('Cyclic world index');
  seen.add(page.path);
  const bytes = await read(page.path);
  if (page.sha256 && (hash(bytes) !== page.sha256 || bytes.length !== page.bytes))
    throw new Error('World index integrity mismatch');
  const parsed = worldLibraryPage(bytes);
  for (const row of parsed.worlds) {
    const bytes = await read(row.path);
    if (hash(bytes) !== row.sha256 || bytes.length !== row.bytes)
      throw new Error(`Pack integrity mismatch: ${row.id}`);
    if (bytes.subarray(0, 8).toString() !== 'RLFPV2\r\n') throw new Error('Invalid world pack');
    const length = bytes.readUInt32LE(8);
    const manifest = JSON.parse(bytes.subarray(12, 12 + length).toString('utf8'));
    if (manifest.project.id !== row.id || manifest.project.courses.length !== row.courses)
      throw new Error('Pack course identity mismatch');
    const { url, ...pin } = row;
    rows.push({
      ...pin,
      levels: manifest.project.courses.map((course) => ({
        id: course.id,
        title: [course.locales.en.title, course.locales.uk.title],
      })),
    });
  }
  page = parsed.next;
}
const file = path.join(root, 'optional-practice/civilian-fpv/world-library.mjs');
const source = await readFile(file, 'utf8');
const marker =
  '// Route labels from the exact published pack hashes; never used as flight authority.';
const at = source.indexOf(marker);
if (at < 0) throw new Error('Missing catalogue marker');
const next =
  source.slice(0, at) +
  marker +
  '\nexport const WORLD_LIBRARY_CATALOGUE = Object.freeze(' +
  JSON.stringify(rows, null, 2) +
  ');\n';
if (process.argv.includes('--check')) {
  if (source !== next)
    throw new Error('World route labels are stale; run scripts/refresh-fpv-world-library.mjs');
} else await writeFile(file, next);
console.log(
  JSON.stringify({
    worlds: rows.length,
    levels: rows.reduce((total, row) => total + row.courses, 0),
  }),
);
