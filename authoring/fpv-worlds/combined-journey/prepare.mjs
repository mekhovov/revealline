import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Manual qualification only. This follows the immutable 216 player staging contract.
const [root, player, inventoryPath, revision, packPath, proofPath, out, mode] =
  process.argv.slice(2);
assert(['admitted', 'source-creator-overlay'].includes(mode), 'Explicit fixture mode required');
assert([root, player, inventoryPath, packPath, proofPath, out].every(path.isAbsolute));
assert(/^[a-f0-9]{40}$/.test(revision), 'Exact source commit required');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    maxBuffer: 24 * 1024 * 1024,
  });
const stageBytes = await fs.readFile(player + '.json');
const inventoryBytes = await fs.readFile(inventoryPath);
const stage = JSON.parse(stageBytes);
const inventory = JSON.parse(inventoryBytes);
assert.equal(stage.files.length, 102);
assert.equal(inventory.inputs.length, 95);
assert.equal(stage.sourceRevision, inventory.sourceRevision);
assert.equal(stage.sourceTree, inventory.sourceTree);
assert(
  stage.checks.every((check) => check.passed),
  'Retained admission must pass',
);
const sourceTree = git('rev-parse', revision + '^{tree}')
  .toString()
  .trim();
if (mode === 'admitted') {
  assert.equal(stage.sourceRevision, revision);
  assert.equal(stage.sourceTree, sourceTree);
}

const hostPath = 'optional-practice/civilian-fpv/world-app.mjs';
const inputs = [];
const overlays = new Map();
for (const row of inventory.inputs) {
  const bytes = git('show', revision + ':' + row.path);
  const sha256 = hash(bytes);
  const changed = bytes.length !== row.bytes || sha256 !== row.sha256;
  if (changed) {
    assert.equal(mode, 'source-creator-overlay', 'Admitted source inputs cannot change');
    assert.equal(row.path, hostPath, 'Only the declared Creator host overlay is permitted');
    overlays.set(row.path, bytes);
  }
  inputs.push({ ...row, bytes: bytes.length, sha256, changed });
}
assert.equal(overlays.size, mode === 'admitted' ? 0 : 1);
if (overlays.size) {
  const prior = await fs.readFile(path.join(player, hostPath));
  const next = overlays.get(hostPath);
  const slice = (bytes) => {
    const text = bytes.toString();
    const start = text.indexOf('  async function installProject(');
    const end = text.indexOf('  let importRequest = 0;', start);
    assert(start >= 0 && end > start, 'Known Creator function boundaries required');
    return text.slice(start, end);
  };
  const accepted = git('show', '0147226227880548a8ea3e047bfe94ada5f7704c:' + hostPath);
  assert.equal(slice(next), slice(accepted), 'Overlay must be the exact accepted Creator fix');
  assert.equal(prior.toString().replace(slice(prior), slice(accepted)), next.toString());
  assert.equal(next.length - prior.length, 323, 'No unrelated host overlay');
}
const sourceLibrary = git('show', revision + ':optional-practice/civilian-fpv/world-library.mjs');
assert(sourceLibrary.includes('surface-coating-v1/index.json'), 'Compatible Library prerequisite');

const packBytes = await fs.readFile(packPath);
const proofBytes = await fs.readFile(proofPath);
assert.equal(packBytes.length, 1379988);
assert.equal(hash(packBytes), '50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554');
assert.equal(proofBytes.length, 908574);
assert.equal(hash(proofBytes), '073ee3e359764d35039f607d02d0815ac0768b892d046b1426c5c4a55f4cacfb');
const { inspectPack } = await import(
  pathToFileURL(path.join(player, 'optional-practice/civilian-fpv/world-content.mjs'))
);
const pack = await inspectPack(packBytes);
assert.equal(pack.project.courses.length, 8);
const archive = JSON.parse(proofBytes);
assert.equal(archive.format, 'FPVProofArchive.v2');
assert.equal(archive.records.length, 16);
const watch = archive.records.find(
  (record) => record.course.id === 'mountain-reservoir-08' && record.proof.mode === 'self-level',
);
assert(watch && watch.proof.frames.length === 1616);
for (const record of archive.records) assert.equal(record.packIdentity, 'fpv-pack:' + pack.sha256);
const assets = [];
for (const [name, bytes] of pack.assets)
  assets.push({ path: name, bytes: bytes.byteLength, sha256: hash(bytes) });
assets.sort((a, b) => a.path.localeCompare(b.path));

// Validate the complete retained member set before making any output directory.
for (const row of stage.files) {
  assert(/^[\w./-]+$/.test(row.path) && !row.path.split('/').includes('..'));
  const bytes = await fs.readFile(path.join(player, row.path));
  assert.equal(bytes.length, row.bytes);
  assert.equal(hash(bytes), row.sha256);
}
await fs.mkdir(out);
const files = [];
async function write(name, bytes, provenance) {
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.writeFile(path.join(out, name), bytes, { flag: 'wx' });
  files.push({ path: name, bytes: bytes.length, sha256: hash(bytes), provenance });
}
async function link(name, source, bytes, provenance) {
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.link(source, path.join(out, name));
  const linked = await fs.readFile(path.join(out, name));
  assert.equal(hash(linked), hash(bytes));
  files.push({ path: name, bytes: bytes.length, sha256: hash(bytes), provenance });
}
for (const row of stage.files) {
  const name = 'player/' + row.path;
  if (overlays.has(row.path))
    await write(name, overlays.get(row.path), 'Declared exact Creator source overlay');
  else
    await link(
      name,
      path.join(player, row.path),
      await fs.readFile(path.join(player, row.path)),
      'Immutable admitted member',
    );
}
await link('content/world.rlpack', packPath, packBytes, 'Pinned Reservoir r16 data');
await link('content/proofs.json', proofPath, proofBytes, 'Separate pinned proof archive');
await write(
  'expected-project.json',
  Buffer.from(JSON.stringify(pack.project) + '\n'),
  'Native inspectPack output, not installed/preseeded data',
);
for (const name of ['host.mjs', 'run.mjs', 'index.html'])
  await write(name, await fs.readFile(new URL(name, import.meta.url)), 'Manual observer/controls');
const html = await fs.readFile(
  path.join(player, 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
assert(html.includes('data-fpv-worlds="true"'));
assert(html.includes('src="../civilian-fpv/world-app.mjs"'));
await write(
  'player/optional-practice/fpv-worlds/journey-host.html',
  Buffer.from(
    html
      .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
      .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../host.mjs"'),
  ),
  'Native-depth observer entry; cached native index.html remains unchanged',
);
const fixture = {
  format: 'FPVCombinedJourneyFixture.v1',
  status: 'Manual qualification candidate; no result implied',
  mode,
  revision,
  sourceTree,
  baseline: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    stageSHA256: hash(stageBytes),
    inventorySHA256: hash(inventoryBytes),
    zip: stage.zip,
  },
  overlays: [...overlays].map(([name, bytes]) => ({
    path: name,
    bytes: bytes.length,
    sha256: hash(bytes),
  })),
  offlineEligible: mode === 'admitted',
  storage: 'Standard native DB names on a dedicated initially empty origin; no deletion or prefix',
  catalogue: { mode: 'native-file-import', publishedBrowseQualified: false },
  pack: {
    id: pack.project.id,
    sha256: pack.sha256,
    bytes: packBytes.length,
    courses: pack.project.courses.map((c) => c.id),
    assets,
  },
  proofs: {
    sha256: hash(proofBytes),
    bytes: proofBytes.length,
    records: archive.records.length,
    import: 'Separate explicit public Records upload',
    watch: {
      id: watch.id,
      packIdentity: watch.packIdentity,
      course: watch.course.id,
      mode: watch.proof.mode,
      frames: watch.proof.frames.length,
      session: watch.proof.session,
      courseIdentity: watch.proof.courseIdentity,
      worldIdentity: watch.proof.worldIdentity,
      responseIdentity: watch.proof.responseIdentity,
      rulesIdentity: watch.proof.rulesIdentity,
      finalStateIdentity: watch.proof.finalStateIdentity,
    },
  },
  entry: { course: 'mountain-reservoir-01', mode: 'self-level' },
  edit: { course: 'mountain-reservoir-02', mode: 'acro', step: 0, xDeltaMillimetres: 100 },
  inputs,
  files,
  limits: [
    'Native file import does not qualify a published catalogue row or delivery of proofs with a pack.',
    'Source overlay mode cannot qualify offline worker descriptors or cached native reload.',
    'One cohesive functional path; not a repeat of component matrices, hardware or performance qualification.',
    'Named real transaction aborts are not real quota exhaustion; parent owns browser and server-stop actions.',
  ],
};
const bytes = Buffer.from(JSON.stringify(fixture, null, 2) + '\n');
await fs.writeFile(path.join(out, 'fixture.json'), bytes, { flag: 'wx' });
console.log(
  JSON.stringify({
    out,
    revision,
    fixtureSHA256: hash(bytes),
    mode,
    offlineEligible: fixture.offlineEligible,
    inputs: inputs.length,
    files: files.length,
  }),
);
