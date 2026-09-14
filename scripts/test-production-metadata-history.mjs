import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyProductionSources } from '../authoring/production/sources.mjs';
import { summarizeProduction, validateProductionRegister } from '../authoring/production/model.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const register = JSON.parse(
  await readFile(path.join(root, 'authoring/production/register-fracture-themes.json')),
);
const previous = JSON.parse(
  await readFile(path.join(root, 'authoring/production/register-sentinel-themes.json')),
);
const historyRoot = 'authoring/production/history';
const index = JSON.parse(await readFile(path.join(root, historyRoot, 'index.json')));
const old = index.entries[0];
const snapshot = `${historyRoot}/${old.sha256}.json`;
const current = await readFile(path.join(root, old.path));
const clone = (v) => structuredClone(v);
const hash = (b) => createHash('sha256').update(b).digest('hex');
function pins(r) {
  return [
    ...r.authorities,
    ...r.works.map((w) => w.source),
    ...r.works.flatMap((w) => w.dependencies),
    ...r.layouts.map((l) => l.source),
    ...r.enemies.map((e) => e.source),
    ...r.assessments.flatMap((a) => a.evidence),
    ...r.deliveries.map((d) => d.evidence),
  ];
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(root, '.cache/metadata-history-fixture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of new Set([
    ...pins(register).map((p) => p.path),
    `${historyRoot}/index.json`,
    snapshot,
  ])) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), await readFile(path.join(root, name)));
  }
  return dir;
}
test('the immutable Fracture register authenticates historical presets after runtime appearance expansion', async () => {
  assert.equal(old.path, 'authoring/motion-lab/presets.json');
  assert.equal(old.bytes, 23077);
  assert.equal(old.sha256, 'edbb5c4e73e03b7e516825575bf2fed6d234745cecc514241667097a3d3f8eca');
  assert.notEqual(hash(current), old.sha256);
  const result = await verifyProductionSources(register, { root });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, false);
  assert(result.originals.every((p) => p.status === 'unverified'));
  const valid = validateProductionRegister(register, { previous });
  const summary = summarizeProduction(valid);
  assert.equal(summary.uniquePictureWorks, 48);
  assert.equal(summary.maps.approved, 0);
  assert.deepEqual(register.assessments, previous.assessments);
});
test('an old checkout without history uses exact current metadata; missing snapshot never silently uses different runtime presets', async (t) => {
  const dir = await fixture(t);
  await rm(path.join(dir, snapshot));
  await assert.rejects(verifyProductionSources(register, { root: dir }), /ENOENT/);
  await rm(path.join(dir, historyRoot, 'index.json'));
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
  await writeFile(path.join(dir, old.path), await readFile(path.join(root, snapshot)));
  assert.equal((await verifyProductionSources(register, { root: dir })).metadata, 'verified');
});
test('changed or symlinked historical snapshots reject; an unrelated mapping cannot redirect a declared pin', async (t) => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, snapshot), '{}');
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
  await rm(path.join(dir, snapshot));
  await symlink(path.join(root, snapshot), path.join(dir, snapshot));
  await assert.rejects(verifyProductionSources(register, { root: dir }), /Symlink/);
  await writeFile(
    path.join(dir, historyRoot, 'index.json'),
    JSON.stringify({ ...index, entries: [{ ...old, path: 'game/content/foreign.json' }] }),
  );
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
});
test('history admits only finite complete JSON identities, with no arbitrary snapshot path or duplicate entry', async (t) => {
  const dir = await fixture(t);
  const invalid = [
    { ...index, entries: [old, old] },
    { ...index, entries: Array.from({ length: 65 }, () => old) },
    { ...index, entries: [{ ...old, snapshot: '../elsewhere.json' }] },
    { ...index, entries: [{ ...old, path: '../presets.json' }] },
    { ...index, entries: [{ ...old, path: 'art/original.png' }] },
    { ...index, entries: [{ ...old, bytes: 4194305 }] },
    { ...index, entries: [{ ...old, sha256: [old.sha256] }] },
  ];
  for (const document of invalid) {
    await writeFile(path.join(dir, historyRoot, 'index.json'), JSON.stringify(document));
    await assert.rejects(verifyProductionSources(register, { root: dir }), /history|path|Unsafe/i);
  }
});
test('a newly declared preset revision reads the current file and still refuses changed current bytes', async (t) => {
  const dir = await fixture(t),
    next = clone(register);
  for (const pin of pins(next))
    if (pin.path === old.path) Object.assign(pin, { bytes: current.length, sha256: hash(current) });
  assert.equal((await verifyProductionSources(next, { root: dir })).metadata, 'verified');
  // This test candidate is not a successor approval and is never published.
  await writeFile(path.join(dir, old.path), '{}');
  await assert.rejects(verifyProductionSources(next, { root: dir }), /changed authority/);
});
