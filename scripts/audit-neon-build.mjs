import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { neonReviewCatalog } from './neon-review-catalog.mjs';

// Run after the ordinary distribution build. This audits emitted files; it does
// not stand in for installing/upgrading a pack in an authenticated browser.
const directory = resolve(process.argv[2] ?? 'dist');
const read = async (path) => JSON.parse(await readFile(join(directory, path), 'utf8'));
const manifest = await read('manifest.json');
const cache = await read('offline-cache.json');
const content = await read('offline-content.json');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expected = neonReviewCatalog();
const galleries = [];
for (const [name, packId] of [
  ['neon-artwork', null],
  ['neon-mosaic', 'neon-mosaic-pack'],
]) {
  const path = `authoring/library/${name}/index.html`;
  const bytes = await readFile(join(directory, path));
  const base = new URL(path, 'https://mekhovov.github.io/revealline/');
  const document = parse(bytes.toString());
  const elements = [];
  const walk = (node) => {
    if (node.tagName) elements.push(node);
    for (const child of node.childNodes ?? []) walk(child);
    if (node.content) walk(node.content);
  };
  walk(document);
  const localFiles = new Set();
  const missionLinks = [];
  for (const node of elements)
    for (const attr of node.attrs ?? []) {
      if (!['href', 'src'].includes(attr.name) || attr.value.startsWith('#')) continue;
      const url = new URL(attr.value, base);
      if (url.origin !== base.origin) continue;
      assert.ok(url.pathname.startsWith('/revealline/'), `Outside deployment base: ${url}`);
      let localPath = decodeURIComponent(url.pathname.slice('/revealline/'.length));
      if (localPath.endsWith('/')) localPath += 'index.html';
      assert.ok((await stat(join(directory, localPath))).isFile(), `Missing ${localPath}`);
      localFiles.add(localPath);
      if (url.searchParams.has('library-mission')) missionLinks.push(url.href);
    }
  const expectedLinks = expected
    .filter((row) => !packId || JSON.parse(row.ownerId)[2] === packId)
    .map((row) => row.publicHref)
    .sort();
  assert.deepEqual(missionLinks.sort(), expectedLinks, `${name}: current mission links drifted`);
  galleries.push({
    path,
    sha256: digest(bytes),
    exactMissionLinks: missionLinks.length,
    linkedFiles: [...localFiles].sort(),
  });
}
const reviewPrefixes = ['neon-artwork', 'neon-mosaic', 'neon-reference-pack'].map(
  (name) => `authoring/library/${name}/`,
);
const reviewFiles = manifest.files.filter((row) =>
  reviewPrefixes.some((prefix) => row.path.startsWith(prefix)),
);
assert.ok(reviewFiles.length > 0);
assert.ok(
  cache.files.every((row) => !reviewPrefixes.some((prefix) => row.path.startsWith(prefix))),
  'Duplicate review assets entered the mandatory offline core',
);
const packs = [];
for (const id of ['neon-reference-pack', 'neon-mosaic-pack']) {
  const path = `game/content/packs/${id}.json`;
  const bytes = await readFile(join(directory, path));
  const original = await readFile(new URL(`../${path}`, import.meta.url));
  assert.equal(digest(bytes), digest(original), `${id}: distribution changed pack identity`);
  const optional = cache.optionalPacks.find((row) => row.id === id);
  assert.equal(optional?.sha256, digest(bytes), `${id}: missing exact offline package`);
  const group = content.groups.find((row) => row.id === `chapter:${id}`);
  assert.ok(group?.files.includes(path), `${id}: offline chapter omits the pack`);
  packs.push({ id, path, sha256: digest(bytes), bytes: bytes.length, group: group.id });
}
const coreBytes = cache.files.reduce((sum, row) => sum + row.bytes, 0);
assert.ok(coreBytes <= 80 * 1024 * 1024, 'Core exceeds the 80 MiB cache budget');
const report = {
  format: 'revealline-neon-build-audit.v1',
  scope:
    'Distribution files, exact links and offline descriptors; not browser installation or public deployment acceptance.',
  version: manifest.version,
  buildSourceRevision: manifest.sourceRevision,
  distributionSHA256: (await readFile(join(directory, 'distribution.zip.sha256'), 'utf8'))
    .trim()
    .split(/\s+/)[0],
  distributionFiles: manifest.files.length,
  coreBytes,
  reviewFilesOutsideCore: reviewFiles.length,
  reviewBytesOutsideCore: reviewFiles.reduce((sum, row) => sum + row.bytes, 0),
  galleries,
  packs,
};
await writeFile(
  new URL('../docs/qualification/neon-level-completion/build-delivery.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `Both built galleries resolve all ${galleries.reduce((sum, row) => sum + row.exactMissionLinks, 0)} exact play links and linked files; both Neon offline package hashes match. Core: ${(coreBytes / 1024 / 1024).toFixed(2)} MiB.`,
);
