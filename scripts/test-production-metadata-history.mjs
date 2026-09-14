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
const sourceIndex = JSON.parse(await readFile(path.join(root, historyRoot, 'source-index.json')));
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
  await mkdir(path.join(root, '.cache'), { recursive: true });
  const dir = await mkdtemp(path.join(root, '.cache/metadata-history-fixture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of new Set([
    ...pins(register).map((p) => p.path),
    `${historyRoot}/index.json`,
    ...index.entries.map(
      (entry) => `${historyRoot}/${entry.sha256}${path.posix.extname(entry.path)}`,
    ),
    `${historyRoot}/source-index.json`,
    ...sourceIndex.entries.map((pin) => `${historyRoot}/${pin.sha256}.source`),
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
  for (const pin of pins(register)) {
    const retained = index.entries.find(
      (entry) =>
        entry.path === pin.path && entry.sha256 === pin.sha256 && entry.bytes === pin.bytes,
    );
    if (retained)
      await writeFile(
        path.join(dir, pin.path),
        await readFile(
          path.join(root, `${historyRoot}/${retained.sha256}${path.posix.extname(retained.path)}`),
        ),
      );
  }
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
test('the preserved FPV preset revision remains exact after a later runtime change', async (t) => {
  const retained = index.entries[1];
  assert.equal(index.entries.length, 3);
  assert.deepEqual(retained, {
    path: old.path,
    bytes: 36911,
    sha256: 'e857a548bccaa9649d86ccb6443fbf9fd37f8ff4de8e3f6a7a7da900b92ed8cb',
  });
  const name = `${historyRoot}/${retained.sha256}.json`;
  const bytes = await readFile(path.join(root, name));
  assert.equal(bytes.length, retained.bytes);
  assert.equal(hash(bytes), retained.sha256);
  const dir = await fixture(t),
    next = clone(register);
  for (const pin of pins(next)) if (pin.path === old.path) Object.assign(pin, retained);
  // A private fixture declaration proves exact history lookup, not a new approval.
  await writeFile(path.join(dir, old.path), '{}');
  const result = await verifyProductionSources(next, { root: dir });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, false);
  await writeFile(path.join(dir, name), '{}');
  await assert.rejects(verifyProductionSources(next, { root: dir }), /changed authority/);
});
test('a newly declared unarchived preset revision reads the current file and still refuses changed current bytes', async (t) => {
  const dir = await fixture(t),
    next = clone(register),
    future = Buffer.concat([current, Buffer.from('\n')]);
  assert.ok(!index.entries.some((entry) => entry.sha256 === hash(future)));
  await writeFile(path.join(dir, old.path), future);
  for (const pin of pins(next))
    if (pin.path === old.path) Object.assign(pin, { bytes: future.length, sha256: hash(future) });
  assert.equal((await verifyProductionSources(next, { root: dir })).metadata, 'verified');
  // This test candidate is not a successor approval and is never published.
  await writeFile(path.join(dir, old.path), '{}');
  await assert.rejects(verifyProductionSources(next, { root: dir }), /changed authority/);
});

test('v2 preserves the exact prior renderer as inert source bytes and v1 still accepts JSON-only history', async (t) => {
  const retained = index.entries[2];
  assert.equal(index.format, 'revealline-production-metadata-history.v2');
  assert.deepEqual(retained, {
    path: 'game/ui/actor-presentation.mjs',
    bytes: 25033,
    sha256: '4676dbca131440742815a3ed7a5e1e2ec89c121f813e5d8c0ff45f01360dde4a',
  });
  const bytes = await readFile(path.join(root, `${historyRoot}/${retained.sha256}.mjs`));
  assert.equal(bytes.length, retained.bytes);
  assert.equal(hash(bytes), retained.sha256);
  const dir = await fixture(t);
  await writeFile(path.join(dir, retained.path), bytes);
  await writeFile(
    path.join(dir, historyRoot, 'index.json'),
    JSON.stringify({
      format: 'revealline-production-metadata-history.v1',
      entries: index.entries.slice(0, 2),
    }),
  );
  assert.equal((await verifyProductionSources(register, { root: dir })).metadata, 'verified');
  await writeFile(
    path.join(dir, historyRoot, 'index.json'),
    JSON.stringify({ ...index, format: 'revealline-production-metadata-history.v1' }),
  );
  await assert.rejects(verifyProductionSources(register, { root: dir }), /history entry/);
});
test('v2 module history refuses absent, changed and symlinked snapshots without reading the changed live renderer', async (t) => {
  const dir = await fixture(t),
    retained = index.entries[2];
  // Isolate this v2 metadata contract from the separate exact source-history adapter.
  // A matching source snapshot legitimately takes precedence when both indexes retain it.
  await writeFile(
    path.join(dir, historyRoot, 'source-index.json'),
    JSON.stringify({
      ...sourceIndex,
      entries: sourceIndex.entries.filter(
        (pin) =>
          pin.path !== retained.path ||
          pin.bytes !== retained.bytes ||
          pin.sha256 !== retained.sha256,
      ),
    }),
  );
  const target = path.join(dir, `${historyRoot}/${retained.sha256}.mjs`);
  await rm(target);
  await assert.rejects(verifyProductionSources(register, { root: dir }), /ENOENT/);
  await writeFile(target, 'changed');
  await assert.rejects(verifyProductionSources(register, { root: dir }), /changed authority/);
  await rm(target);
  await symlink(path.join(root, retained.path), target);
  await assert.rejects(verifyProductionSources(register, { root: dir }), /Symlink/);
  for (const document of [
    { ...index, format: 'revealline-production-metadata-history.v3' },
    {
      ...index,
      entries: [
        ...index.entries.slice(0, 2),
        { ...retained, path: 'game/ui/actor-presentation.js' },
      ],
    },
  ]) {
    await writeFile(path.join(dir, historyRoot, 'index.json'), JSON.stringify(document));
    await assert.rejects(verifyProductionSources(register, { root: dir }), /history/);
  }
});
test('a private exact module snapshot is authenticated as bytes and never executed', async (t) => {
  const dir = await fixture(t),
    candidate = clone(register),
    retained = index.entries[2];
  const bytes = Buffer.from('throw new Error("A history snapshot must never execute");\n');
  const pin = { path: retained.path, bytes: bytes.length, sha256: hash(bytes) };
  for (const item of pins(candidate)) if (item.path === pin.path) Object.assign(item, pin);
  await writeFile(path.join(dir, `${historyRoot}/${pin.sha256}.mjs`), bytes);
  await writeFile(
    path.join(dir, historyRoot, 'index.json'),
    JSON.stringify({ ...index, entries: [...index.entries, pin] }),
  );
  const result = await verifyProductionSources(candidate, { root: dir });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, false);
});
