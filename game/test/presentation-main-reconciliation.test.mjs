import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readTarEntries } from '../../scripts/game-cli.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { validateThemeBundle, resolvePresentation } from '../presentation/model.mjs';

const root = new URL('../../', import.meta.url);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const oracle = JSON.parse(
  await readFile(new URL('./fixtures/production-main-reconciliation.json', import.meta.url)),
);

// Prefix records are usable only after matching independently pinned group hashes.
// This keeps the historical transition test valid when later canonical editions append.
async function reconstruct(pin, current) {
  const source = {
    format: 'revealline-theme-bundle.v1',
    id: 'field-kit',
    revision: pin.revision,
    selection: {
      base: { id: 'base', revision: 1 },
      collection: null,
      theme: { id: 'fpv', revision: pin.revision },
    },
  };
  for (const group of ['slots', 'assets', 'themes', 'collections']) {
    const expected = oracle.shared[group] ?? pin[group];
    source[group] = current.document[group].slice(0, expected.count);
    assert.equal(source[group].length, expected.count);
    assert.equal(sha(canonicalJSON(source[group])), expected.sha256, group);
  }
  const document = validateThemeBundle(source);
  const assets = new Map();
  for (const asset of document.assets) {
    if (!asset.file || assets.has(asset.file.sha256)) continue;
    const blob = current.assets.get(asset.file.sha256);
    assert.ok(blob);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(bytes.length, asset.file.bytes);
    assert.equal(sha(bytes), asset.file.sha256);
    assets.set(asset.file.sha256, blob);
  }
  const raw = Buffer.from(await (await exportThemeBundle(document, assets)).arrayBuffer());
  assert.equal(raw.length, pin.bytes);
  assert.equal(sha(raw), pin.sha256, `complete canonical bundle ${pin.revision}`);
  return { document, assets };
}

test('canonical main56 remains exact while the alternate unpublished Journey ledger stays authenticated and inert', async () => {
  const archive = await readFile(new URL(oracle.archive.path, root));
  assert.equal(sha(archive), oracle.archive.sha256);
  const entries = readTarEntries(gunzipSync(archive));
  assert.deepEqual(
    entries.map((entry) => entry.name),
    [oracle.path],
  );
  assert.equal(entries[0].bytes.length, oracle.archive.bundleBytes);
  assert.equal(sha(entries[0].bytes), oracle.archive.bundleSha256);
  const archived = await importThemeBundle(new Blob([entries[0].bytes]), { decodeImage: null });
  assert.equal(archived.document.revision, 58);
  const current = await importThemeBundle(new Blob([await readFile(new URL(oracle.path, root))]), {
    decodeImage: null,
  });
  const main = await reconstruct(oracle.main, current);
  const canonical = await reconstruct(oracle.canonical, current);
  validateThemeBundle(canonical.document, { previous: main.document, expectedRevision: 56 });

  for (const revision of [55, 56, 57]) {
    const select = (bundle) =>
      bundle.document.themes.find((row) => row.id === 'fpv' && row.revision === revision);
    assert.notEqual(canonicalJSON(select(archived)), canonicalJSON(select(canonical)));
  }
  for (const group of ['slots', 'assets', 'themes', 'collections']) {
    const keys = canonical.document[group].map((row) => `${row.id}@${row.revision}`);
    assert.equal(new Set(keys).size, keys.length, `unique ${group} identities`);
  }
  assert.equal(archived.assets.size, 127);
  assert.equal(main.assets.size, 127);
  assert.equal(canonical.assets.size, 127);
  for (const [hash, blob] of archived.assets) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(sha(bytes), hash);
    assert.deepEqual(Buffer.from(await canonical.assets.get(hash).arrayBuffer()), bytes);
  }
  const before = resolvePresentation(main.document);
  const after = resolvePresentation(canonical.document);
  for (const slot of main.document.slots.filter((slot) => slot.group === 'audio'))
    assert.deepEqual(after.assets[slot.id], before.assets[slot.id], slot.id);

  const config = JSON.parse(await readFile(new URL('game/build-config.json', root)));
  assert.equal(
    config.include.some(
      (entry) => oracle.archive.path === entry || oracle.archive.path.startsWith(`${entry}/`),
    ),
    false,
    'historical alternate ledger is not deployed or selected as runtime content',
  );
});
