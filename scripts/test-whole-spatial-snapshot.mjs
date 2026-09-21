import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateWholeSpatial, WHOLE_SPATIAL_DATA_FILE } from './generate-whole-spatial.mjs';
import {
  composeWholeSpatialCandidates,
  WHOLE_SPATIAL_SELECTIONS as canonicalSelection,
} from './lib/whole-spatial-source.mjs';
import {
  createWholeSpatialCandidates,
  createWholeFieldCandidates,
  createWholeTimedCandidates,
  WHOLE_SPATIAL_SELECTIONS,
} from '../game/content-design/whole-spatial-candidates.mjs';
import { compileContentProject } from '../game/content-design/project.mjs';
import { validateContentSnapshots, buildProject, collectBuildFiles } from './game-cli.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('checked-in snapshot is byte-exact deterministic compiler output and check never rewrites it', async () => {
  const file = path.join(root, WHOLE_SPATIAL_DATA_FILE);
  const before = await fs.readFile(file);
  const stat = await fs.stat(file);
  const result = await generateWholeSpatial();
  assert.equal(result.sha256, hash(before));
  assert.equal(result.bytes, before.length);
  assert.deepEqual(await fs.readFile(file), before);
  assert.equal((await fs.stat(file)).mtimeMs, stat.mtimeMs);
});

test('both snapshots preserve complete canonical source, revisions, artwork pins and independent draft ownership', () => {
  assert.deepEqual(WHOLE_SPATIAL_SELECTIONS, canonicalSelection);
  for (const artwork of [false, true]) {
    const canonical = composeWholeSpatialCandidates({ artwork });
    const snapshot = createWholeSpatialCandidates({ artwork });
    assert.deepEqual(snapshot, canonical);
    snapshot.missions[0].actors[0].x = 1.5;
    snapshot.assets?.pop();
    assert.deepEqual(createWholeSpatialCandidates({ artwork }), canonical);
    const invalid = createWholeSpatialCandidates({ artwork });
    invalid.missions[0].coverage = 2;
    assert.throws(
      () => compileContentProject(invalid),
      /coverage/i,
      'snapshot does not bypass runtime validation',
    );
  }
});

test('browser snapshot dependency contains authored JSON strings only, never build-time composition', async () => {
  const wrapper = await fs.readFile(
    path.join(root, 'game/content-design/whole-spatial-candidates.mjs'),
    'utf8',
  );
  assert.doesNotMatch(
    wrapper,
    /^import .*scripts|^import .*whole-spatial-source|^import .*pressure-candidates/m,
  );
  const generated = await fs.readFile(path.join(root, WHOLE_SPATIAL_DATA_FILE), 'utf8');
  const lines = generated.split('\n').filter((line) => line && !line.startsWith('//'));
  assert.equal(lines.length, 5);
  for (const line of lines) {
    const match = line.match(
      /^export const WHOLE_SPATIAL_(?:SELECTIONS|GREYBOX|ORIGINAL|FIELD_FINALE|TIMED_BORDER)_JSON = (.*);$/,
    );
    assert(match);
    const value = JSON.parse(match[1]);
    assert.equal(typeof value, 'string');
    assert.doesNotThrow(() => JSON.parse(value));
  }
});

test('field-finale delta exactly matches canonical full composition in both artwork editions', () => {
  for (const artwork of [false, true]) {
    const expected = composeWholeSpatialCandidates({ artwork, fieldFinale: true });
    const actual = createWholeFieldCandidates({ artwork });
    assert.deepEqual(actual, expected);
    actual.maps.at(-1).foundations[0].x = 1;
    actual.missions.at(-1).name = 'caller mutation';
    assert.deepEqual(createWholeFieldCandidates({ artwork }), expected);
  }
});

test('timed delta exactly matches canonical full composition without changing maps or prior snapshots', () => {
  for (const artwork of [false, true]) {
    const expected = composeWholeSpatialCandidates({ artwork, timedBorder: true });
    const actual = createWholeTimedCandidates({ artwork });
    assert.deepEqual(actual, expected);
    assert.deepEqual(actual.maps, createWholeFieldCandidates({ artwork }).maps);
    actual.missions.find((item) => item.timedBonuses).timedBonuses.schedules[0].anchors[0].x++;
    assert.deepEqual(createWholeTimedCandidates({ artwork }), expected);
  }
});

async function buildFixture(t) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'journey-snapshot-build-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const fixtureRoot = path.join(directory, 'source');
  await fs.mkdir(path.join(fixtureRoot, 'game/content-design'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'scripts'));
  await fs.mkdir(path.join(fixtureRoot, 'game/offline'));
  for (const file of ['offline.mjs', 'platform.mjs', 'offline/service-worker.template.js']) {
    await fs.copyFile(path.join(root, 'game', file), path.join(fixtureRoot, 'game', file));
  }
  await fs.writeFile(
    path.join(fixtureRoot, 'game/index.html'),
    '<script type="module" src="content-design/whole-spatial-data.mjs"></script>',
  );
  await fs.writeFile(
    path.join(fixtureRoot, 'game/build-config.json'),
    JSON.stringify({ version: '0.1.0', entry: 'game/index.html', include: ['game'] }),
  );
  const bytes = await fs.readFile(path.join(root, WHOLE_SPATIAL_DATA_FILE));
  await fs.writeFile(path.join(fixtureRoot, WHOLE_SPATIAL_DATA_FILE), bytes);
  // This fixture's checker deliberately owns its source hash, not the current
  // checkout's composer. Production freshness is exercised separately above.
  await fs.writeFile(
    path.join(fixtureRoot, 'scripts/generate-whole-spatial.mjs'),
    `
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function generateWholeSpatial({ root, write }) {
  if (write !== false) throw new Error('Validation must be read-only');
  const value = await readFile(root + '/${WHOLE_SPATIAL_DATA_FILE}');
  const sha256 = createHash('sha256').update(value).digest('hex');
  if (sha256 !== '${hash(bytes)}') throw new Error('Selected tree snapshot is stale');
  if (await readFile(root + '/mutate-after-check', 'utf8').catch(() => null)) {
    await writeFile(root + '/${WHOLE_SPATIAL_DATA_FILE}', value.toString().replace('First return', 'First Return'));
  }
  return { selectedTree: true, file: '${WHOLE_SPATIAL_DATA_FILE}', bytes: value.length, sha256 };
}
`,
  );
  return { fixtureRoot, out: path.join(directory, 'dist'), bytes };
}

test('build/preflight use selected-root read-only checker; stale data cannot replace a playable build', async (t) => {
  const { fixtureRoot, out, bytes } = await buildFixture(t);
  const files = await collectBuildFiles(fixtureRoot);
  assert(files.includes(WHOLE_SPATIAL_DATA_FILE));
  assert(!files.some((file) => file.startsWith('scripts/')));
  const checked = await validateContentSnapshots(fixtureRoot, files);
  assert.equal(checked.contentSnapshots[0].selectedTree, true);
  await buildProject({ root: fixtureRoot, out });
  assert.deepEqual(await fs.readFile(path.join(out, WHOLE_SPATIAL_DATA_FILE)), bytes);
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(
    manifest.files.find((entry) => entry.path === WHOLE_SPATIAL_DATA_FILE).sha256,
    hash(bytes),
  );
  const zip = await fs.readFile(path.join(out, 'distribution.zip'));
  const entries = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0, 'ZIP entry uses stored bytes');
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    entries.set(name, zip.subarray(start, start + size));
    offset = start + size;
  }
  assert.deepEqual(entries.get(WHOLE_SPATIAL_DATA_FILE), bytes);
  const offline = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json'), 'utf8'));
  assert.deepEqual(
    offline.files.find((entry) => entry.path === WHOLE_SPATIAL_DATA_FILE),
    {
      path: WHOLE_SPATIAL_DATA_FILE,
      bytes: bytes.length,
      sha256: hash(bytes),
    },
  );
  // Same-size corruption catches content drift, not merely a path/length check.
  await fs.writeFile(
    path.join(fixtureRoot, WHOLE_SPATIAL_DATA_FILE),
    Buffer.from(bytes.toString().replace('First return', 'First Return')),
  );
  await assert.rejects(
    validateContentSnapshots(fixtureRoot, files),
    /Selected tree snapshot is stale/,
  );
  await assert.rejects(buildProject({ root: fixtureRoot, out }), /Selected tree snapshot is stale/);
  assert.deepEqual(await fs.readFile(path.join(out, 'distribution.zip')), zip);
});

test('historical source trees without the snapshot need no new generator', async () => {
  assert.deepEqual(
    await validateContentSnapshots('/unused-historical-root', ['game/index.html']),
    {},
  );
});

test('snapshot changed after successful validation cannot replace the prior playable distribution', async (t) => {
  const { fixtureRoot, out } = await buildFixture(t);
  await buildProject({ root: fixtureRoot, out });
  const prior = await fs.readFile(path.join(out, 'distribution.zip'));
  await fs.writeFile(
    path.join(fixtureRoot, 'mutate-after-check'),
    'simulate concurrent source edit',
  );
  await assert.rejects(
    buildProject({ root: fixtureRoot, out }),
    /snapshot changed after validation/,
  );
  assert.deepEqual(await fs.readFile(path.join(out, 'distribution.zip')), prior);
});
