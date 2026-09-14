import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyProductionSources } from '../authoring/production/sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const historyRoot = 'authoring/production/history';
const indexPath = `${historyRoot}/source-index.json`;
const index = JSON.parse(await readFile(path.join(root, indexPath)));
const register = JSON.parse(
  await readFile(path.join(root, 'authoring/production/register-countercurrent.json')),
);
const expected = new Map([
  [
    'authoring/motion-lab/render-character.mjs',
    { bytes: 6489, sha256: '1ae56eb2b059b910cb3f1960eca0c4786f828d669b6f6c7615b5527850030e9a' },
  ],
  [
    'game/ui/actor-presentation.mjs',
    { bytes: 25033, sha256: '4676dbca131440742815a3ed7a5e1e2ec89c121f813e5d8c0ff45f01360dde4a' },
  ],
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const snapshot = (pin) => `${historyRoot}/${pin.sha256}.source`;
function pins(record) {
  return [
    ...record.authorities,
    ...record.works.map((work) => work.source),
    ...record.works.flatMap((work) => work.dependencies),
    ...record.layouts.map((layout) => layout.source),
    ...record.enemies.map((enemy) => enemy.source),
    ...record.assessments.flatMap((assessment) => assessment.evidence),
    ...record.deliveries.map((delivery) => delivery.evidence),
  ];
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'revealline-source-history-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const metadata = JSON.parse(await readFile(path.join(root, historyRoot, 'index.json')));
  for (const name of new Set([
    ...pins(register).map((pin) => pin.path),
    `${historyRoot}/index.json`,
    ...metadata.entries.map((pin) => `${historyRoot}/${pin.sha256}${path.posix.extname(pin.path)}`),
    indexPath,
    ...index.entries.map(snapshot),
  ])) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), await readFile(path.join(root, name)));
  }
  return dir;
}

test('retained source bodies authenticate exact immutable recipe pins without approving production', async () => {
  assert(index.entries.some((pin) => pin.path === 'authoring/motion-lab/render-character.mjs'));
  for (const pin of index.entries) {
    assert.deepEqual({ bytes: pin.bytes, sha256: pin.sha256 }, expected.get(pin.path));
    const bytes = await readFile(path.join(root, snapshot(pin)));
    assert.equal(bytes.length, pin.bytes);
    assert.equal(hash(bytes), pin.sha256);
    assert(pins(register).some((declared) => JSON.stringify(declared) === JSON.stringify(pin)));
  }
  const before = JSON.stringify(register);
  const result = await verifyProductionSources(register, { root });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, false);
  assert(result.originals.every((original) => original.status === 'unverified'));
  assert.equal(JSON.stringify(register), before);
});

test('old source checkouts remain valid without the optional source index; changed current bytes refuse', async (t) => {
  const dir = await fixture(t);
  await rm(path.join(dir, indexPath));
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
  for (const pin of index.entries)
    await writeFile(path.join(dir, pin.path), await readFile(path.join(root, snapshot(pin))));
  assert.equal((await verifyProductionSources(register, { root: dir })).metadata, 'verified');
});

test('missing, modified or symlinked source snapshots fail instead of using the current recipe', async (t) => {
  const dir = await fixture(t),
    pin = index.entries[0],
    target = path.join(dir, snapshot(pin));
  await rm(target);
  await assert.rejects(verifyProductionSources(register, { root: dir }), /ENOENT/);
  await writeFile(target, 'changed retained source');
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
  await rm(target);
  await symlink(path.join(root, snapshot(pin)), target);
  await assert.rejects(verifyProductionSources(register, { root: dir }), /Symlink/);
});

test('source history has finite exact identities and cannot choose arbitrary source or snapshot paths', async (t) => {
  const dir = await fixture(t),
    old = index.entries[0];
  for (const entries of [
    [old, old],
    Array.from({ length: 65 }, () => old),
    [{ ...old, snapshot: '../elsewhere.mjs' }],
    [{ ...old, path: '../render-character.mjs' }],
    [{ ...old, path: 'game/ui/foreign.mjs' }],
    [{ ...old, path: 'game/content/themes.json' }],
    [{ ...old, bytes: 4194305 }],
    [{ ...old, sha256: [old.sha256] }],
  ]) {
    await writeFile(path.join(dir, indexPath), JSON.stringify({ ...index, entries }));
    await assert.rejects(verifyProductionSources(register, { root: dir }), /source history/);
  }
  const unrelated = { ...old, path: 'game/ui/actor-presentation.mjs' };
  await writeFile(path.join(dir, indexPath), JSON.stringify({ ...index, entries: [unrelated] }));
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
});

test('a new source pin reads current bytes while the retained old pin remains immutable', async (t) => {
  const dir = await fixture(t),
    old = index.entries[0],
    next = structuredClone(register),
    bytes = await readFile(path.join(dir, old.path));
  assert.notEqual(hash(bytes), old.sha256);
  for (const pin of pins(next))
    if (pin.path === old.path) Object.assign(pin, { bytes: bytes.length, sha256: hash(bytes) });
  assert.equal((await verifyProductionSources(next, { root: dir })).metadata, 'verified');
  await writeFile(path.join(dir, old.path), 'changed live source');
  await assert.rejects(verifyProductionSources(next, { root: dir }), /changed authority/);
  assert.equal((await verifyProductionSources(register, { root: dir })).metadata, 'verified');
});

test('archived source bytes are authenticated but never imported or executed', async (t) => {
  const dir = await fixture(t),
    old = index.entries[0],
    next = structuredClone(register),
    bytes = Buffer.from('throw new Error("Archived source must never execute");\n'),
    pin = { path: old.path, bytes: bytes.length, sha256: hash(bytes) };
  for (const declared of pins(next)) if (declared.path === old.path) Object.assign(declared, pin);
  await writeFile(path.join(dir, snapshot(pin)), bytes);
  await writeFile(
    path.join(dir, indexPath),
    JSON.stringify({ ...index, entries: [...index.entries, pin] }),
  );
  assert.equal((await verifyProductionSources(next, { root: dir })).metadata, 'verified');
});
