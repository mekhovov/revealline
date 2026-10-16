#!/usr/bin/env node
// Manual exact-pack qualification with isolated modeled storage, not browser/offline acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { worldLibraryPage } from '../optional-practice/civilian-fpv/world-library.mjs';
import {
  compilePlayable,
  inspectPack,
  preparePack,
  worldSHA256,
} from '../optional-practice/civilian-fpv/world-content.mjs';
import { openWorldStore } from '../optional-practice/civilian-fpv/world-store.mjs';

const [directory, output] = process.argv.slice(2);
if (!directory || !output)
  throw new Error('Usage: qualify-fpv-catalogue-storage.mjs INPUT_DIRECTORY NEW_RECEIPT.json');
const requireAuthoring = createRequire(
  new URL('../authoring/fpv-worlds/package.json', import.meta.url),
);
const { IDBFactory, IDBObjectStore } = requireAuthoring('fake-indexeddb');
const root = path.resolve(directory);
assert.ok(
  (await stat(path.join(root, 'index.json'))).size <= 32768,
  'Catalogue exceeds the page limit.',
);
const indexBytes = await readFile(path.join(root, 'index.json')),
  page = worldLibraryPage(indexBytes),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  name = 'isolated-catalogue-qualification',
  factory = new IDBFactory(),
  store = await openWorldStore({ indexedDB: factory, name }),
  receipt = {
    format: 'FPVCatalogueStorageQualification.v1',
    node: process.version,
    indexSHA256: hash(indexBytes),
    storage: 'fake-indexeddb; fresh in-memory factory, no player storage access',
    quota: 'Injected QuotaExceededError after queuing asset writes; not actual quota pressure',
    browserOfflineVerified: false,
    sources: {},
    worlds: [],
  };
// A partial page must never be described as the whole catalogue.
assert.equal(
  page.next,
  null,
  'Supply a complete bounded catalogue; continuation qualification is separate.',
);
assert.ok(page.worlds.length, 'The catalogue is empty.');
for (const file of [
  'scripts/qualify-fpv-catalogue-storage.mjs',
  'optional-practice/civilian-fpv/world-library.mjs',
  'optional-practice/civilian-fpv/world-content.mjs',
  'optional-practice/civilian-fpv/world-store.mjs',
])
  receipt.sources[file] = hash(await readFile(new URL('../' + file, import.meta.url)));
const fingerprint = async (record) => ({
  sha256: record.sha256,
  project: hash(JSON.stringify(record.project)),
  assets: await Promise.all(
    [...record.assets].map(async ([asset, blob]) => [asset, await worldSHA256(blob)]),
  ),
});
const originals = new Map(),
  originalPut = IDBObjectStore.prototype.put;
let injectQuota = false;
IDBObjectStore.prototype.put = function (...args) {
  if (injectQuota && this.transaction.db.name === name && this.name === 'projects') {
    injectQuota = false;
    throw new DOMException('Named qualification fault after asset writes.', 'QuotaExceededError');
  }
  return originalPut.apply(this, args);
};
try {
  for (const row of page.worlds) {
    const filename = path.resolve(root, 'packs', row.id + '.rlpack');
    assert.equal(
      path.dirname(filename),
      path.join(root, 'packs'),
      'Pack name escapes input directory.',
    );
    assert.equal((await stat(filename)).size, row.bytes, 'Pack length differs from the catalogue.');
    const bytes = await readFile(filename);
    assert.equal(bytes.length, row.bytes);
    assert.equal(hash(bytes), row.sha256);
    const original = await inspectPack(bytes);
    assert.equal(original.project.id, row.id);
    assert.equal(original.project.courses.length, row.courses);
    assert.equal(original.sha256, row.sha256);
    assert.equal(compilePlayable(original.project).courses.length, row.courses);
    assert.equal(
      await worldSHA256(await preparePack(original.project, { assets: original.assets })),
      row.sha256,
    );
    await store.install({ ...original, expectedGeneration: await store.generation() });
    const before = await fingerprint(await store.get(row.id)),
      generation = await store.generation(),
      revisions = (await store.list({ includeRevisions: true })).map(({ id, sha256 }) => [
        id,
        sha256,
      ]);
    originals.set(row.id, before);
    const unchanged = async () => {
      assert.equal(await store.generation(), generation);
      assert.deepEqual(await fingerprint(await store.get(row.id)), before);
      assert.deepEqual(
        (await store.list({ includeRevisions: true })).map(({ id, sha256 }) => [id, sha256]),
        revisions,
      );
    };
    // Synthetic update is explicitly separate from the published authored revision.
    const project = structuredClone(original.project);
    project.title = 'Qualification-only update: ' + row.id;
    const update = await inspectPack(await preparePack(project, { assets: original.assets }));
    assert.notEqual(update.sha256, row.sha256);
    await assert.rejects(
      store.install({ ...update, expectedGeneration: generation - 1 }),
      (error) => error.code === 'generation-conflict',
    );
    await unchanged();
    injectQuota = true;
    await assert.rejects(
      store.install({ ...update, expectedGeneration: generation }),
      (error) => error.name === 'QuotaExceededError',
    );
    assert.equal(injectQuota, false, 'Fault must reach the intended project write.');
    await unchanged();
    const corrupt = Uint8Array.from(bytes);
    corrupt[corrupt.length - 1] ^= 1;
    await assert.rejects(inspectPack(corrupt), /hash mismatch/);
    await unchanged();
    await store.install({ ...update, expectedGeneration: generation });
    assert.equal((await store.get(row.id)).sha256, update.sha256);
    assert.deepEqual(await fingerprint(await store.get(row.id, { sha256: row.sha256 })), before);
    await store.activate(row.id, row.sha256, { expectedGeneration: await store.generation() });
    assert.deepEqual(await fingerprint(await store.get(row.id)), before);
    assert.equal((await store.get(row.id, { sha256: update.sha256 })).active, false);
    await store.removeRevision(row.id, update.sha256, {
      expectedGeneration: await store.generation(),
    });
    assert.equal(await store.get(row.id, { sha256: update.sha256 }), null);
    assert.deepEqual(await fingerprint(await store.get(row.id)), before);
    receipt.worlds.push({
      id: row.id,
      revision: row.revision,
      commit: row.commit,
      path: row.path,
      sha256: row.sha256,
      bytes: row.bytes,
      courses: row.courses,
      checks: [
        'digest-and-length',
        'import-and-compile',
        'exact-export',
        'install',
        'stale-generation-preserves-state',
        'injected-quota-preserves-state',
        'corrupt-pack-rejected',
        'synthetic-update-retains-original',
        'exact-rollback',
        'offload-inactive-revision-retains-active',
      ],
    });
  }
  assert.equal((await store.list()).length, page.worlds.length);
  assert.equal((await store.list({ includeRevisions: true })).length, page.worlds.length);
  store.close();
  const reopened = await openWorldStore({ indexedDB: factory, name });
  try {
    for (const row of receipt.worlds) {
      assert.deepEqual(await fingerprint(await reopened.get(row.id)), originals.get(row.id));
      row.checks.push('reopen-preserves-exact-active-project-and-assets');
    }
  } finally {
    reopened.close();
  }
  receipt.activeWorlds = page.worlds.length;
  receipt.totalPackBytes = page.worlds.reduce((total, row) => total + row.bytes, 0);
  receipt.status = 'passed';
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(
    `Qualified ${receipt.activeWorlds} exact packs (${receipt.totalPackBytes} bytes); modeled storage only.`,
  );
} finally {
  IDBObjectStore.prototype.put = originalPut;
  store.close();
}
