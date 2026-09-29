import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import {
  FORMATS,
  LIMITS,
  validateThemeBundle,
  resolvePresentation,
} from '../presentation/model.mjs';
import {
  importThemeBundle,
  exportThemeBundle,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  REFERENCE_ASSET,
  validateReferencedBundle,
  migrateThemeReferences,
  resolveReferencedPresentation,
  openReferencedAssets,
  referenceOf as ref,
} from '../presentation/reference-model.mjs';
import {
  importReferencedBundle,
  exportReferencedBundle,
} from '../presentation/reference-bundle.mjs';
import {
  reviseReferencedTheme,
  retainReferencedProductionHistory,
  adoptReferencedBundle,
} from '../presentation/reference-session.mjs';
import { createReferencedStudioStore } from '../presentation/reference-store.mjs';
import {
  compilePresentation,
  compileReferencedPresentation,
} from '../../scripts/compile-presentation.mjs';

const bytes = (value) => Buffer.byteLength(canonicalJSON(value));
const clone = (value) => structuredClone(value);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const originalHash = '287cddba3f92cf9730b3d0eefece7fbf690aca7c6fe88ca77308d9873851d1a4';
let actualPromise;
const actual = () =>
  (actualPromise ??= (async () => {
    assert.ok(
      process.env.P04_LEDGER_PATH,
      'Use the exact retained r5 ledger as the external capacity fixture.',
    );
    const raw = await fs.readFile(process.env.P04_LEDGER_PATH);
    assert.equal(hash(raw), originalHash);
    const imported = await importThemeBundle(new Blob([raw]), { decodeImage: null });
    return { ...imported, raw };
  })());
async function smallReference() {
  const legacy = createDefaultThemeBundle(),
    migrated = await migrateThemeReferences(legacy);
  const selected = await resolveReferencedPresentation(migrated);
  const targets = Object.entries(selected.assets).slice(0, 2);
  const revisions = targets.map(([, asset]) => ({
    ...clone(asset),
    revision: asset.revision + 1,
    provenance: { ...clone(asset.provenance), parent: ref(asset) },
  }));
  const document = await reviseReferencedTheme(migrated, {
    assets: revisions,
    bindings: Object.fromEntries(targets.map(([slot], i) => [slot, ref(revisions[i])])),
  });
  assert.equal(document.assets.filter((row) => row.format === REFERENCE_ASSET).length, 2);
  return { legacy, migrated, document };
}
async function assertStored(store, snapshot) {
  const now = await store.load();
  assert.equal(now.generation, snapshot.generation);
  assert.deepEqual(now.document, snapshot.document);
  assert.deepEqual([...now.assets.keys()], [...snapshot.assets.keys()]);
  for (const [id, blob] of now.assets)
    assert.deepEqual(
      new Uint8Array(await blob.arrayBuffer()),
      new Uint8Array(await snapshot.assets.get(id).arrayBuffer()),
    );
}

test('actual 194-asset review and replacement preserve history, 127 payloads and complete portable adoption under existing bounds', async () => {
  const original = await actual(),
    migrated = await migrateThemeReferences(original.document);
  const reexport = await exportThemeBundle(original.document, original.assets);
  assert.deepEqual(
    new Uint8Array(await reexport.arrayBuffer()),
    new Uint8Array(original.raw),
    'legacy export bytes remain exact',
  );
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(migrated[field], original.document[field]);
  const desired = clone(migrated),
    selected = await resolveReferencedPresentation(desired);
  const required = desired.slots.filter((slot) => slot.required);
  assert.equal(required.length, 194);
  assert.equal(original.assets.size, 127);
  for (const slot of required) {
    const target = selected.assets[slot.id];
    desired.assets.find((row) => row.id === target.id && row.revision === target.revision).quality =
      {
        stage: 'reviewed',
        evidence: ['Capacity fixture only; not production qualification. '.repeat(4)],
      };
  }
  const reviewed = await retainReferencedProductionHistory(desired, migrated);
  assert.equal(reviewed.assets.length, migrated.assets.length + 194);
  assert.deepEqual(reviewed.assets.slice(0, migrated.assets.length), migrated.assets);
  const variation = clone(reviewed),
    resolved = await resolveReferencedPresentation(reviewed);
  for (const slot of required) {
    const target = resolved.assets[slot.id];
    variation.assets.find(
      (row) => row.id === target.id && row.revision === target.revision,
    ).description += ' / coordinated replacement capacity fixture';
  }
  const replaced = await retainReferencedProductionHistory(variation, reviewed);
  assert.equal(replaced.assets.length, reviewed.assets.length + 194);
  assert.deepEqual(replaced.assets.slice(0, reviewed.assets.length), reviewed.assets);
  const exported = await exportReferencedBundle(replaced, original.assets),
    raw = new Uint8Array(await exported.arrayBuffer());
  const manifestBytes = new DataView(raw.buffer).getUint32(8);
  assert.ok(manifestBytes <= LIMITS.manifestBytes);
  assert.ok(raw.length <= LIMITS.bundleBytes);
  const imported = await importReferencedBundle(exported, { decodeImage: null });
  assert.deepEqual(imported.document, replaced);
  assert.equal(imported.assets.size, 127);
  for (const [id, blob] of imported.assets)
    assert.equal(await hashPresentationBytes(new Uint8Array(await blob.arrayBuffer())), id);
  const compiled = await compileReferencedPresentation(replaced, imported.assets);
  assert.deepEqual(compiled.resolved, await resolveReferencedPresentation(replaced));
  assert.deepEqual(
    JSON.parse(new TextDecoder().decode(compiled.files.get('studio.json'))),
    replaced,
  );
  const compiledPayloads = [...compiled.files].filter(([name]) => name.startsWith('assets/'));
  assert.equal(compiledPayloads.length, 127);
  for (const [name, raw] of compiledPayloads)
    assert.equal(await hashPresentationBytes(raw), name.slice(7, 71));
  const adopted = await adoptReferencedBundle(replaced, imported.document);
  assert.deepEqual(
    adopted.assets,
    replaced.assets,
    'portable native round trip reuses all exact history',
  );
  assert.deepEqual(
    (await resolveReferencedPresentation(adopted)).assets,
    (await resolveReferencedPresentation(replaced)).assets,
  );
  const adoptedExport = await exportReferencedBundle(adopted, imported.assets);
  assert.ok(adoptedExport.size >= exported.size);
  const reader = await openReferencedAssets(replaced);
  const expanded = {
    ...clone(replaced),
    format: FORMATS.bundle,
    assets: replaced.assets.map((row) => reader.get(row)),
  };
  assert.ok(bytes(expanded) > LIMITS.manifestBytes);
  assert.throws(
    () => validateThemeBundle(expanded),
    /byte budget/,
    'expanded over-budget v1 is still rejected',
  );
  const fixture = managedIndexedDB(),
    oldStore = createStudioStore({ indexedDB: fixture.indexedDB });
  const saved = await oldStore.save(original.document, original.assets);
  const newStore = createReferencedStudioStore({ indexedDB: fixture.indexedDB });
  const successor = await newStore.save(replaced, imported.assets, {
    expectedGeneration: saved.generation,
  });
  assert.equal(successor.generation, 2);
  await assertStored(newStore, successor);
  await assert.rejects(
    oldStore.save(original.document, original.assets, { expectedGeneration: 2 }),
    /bundle|format/,
    'an old tab cannot overwrite v2',
  );
  fixture.failAnyPutAt = 1;
  await assert.rejects(
    newStore.save(adopted, imported.assets, { expectedGeneration: 2 }),
    /write failure/,
  );
  fixture.failAnyPutAt = null;
  await assertStored(newStore, successor);
  await oldStore.close();
  await newStore.close();
  assert.equal(hash(await fs.readFile(process.env.P04_LEDGER_PATH)), originalHash);
  console.log(
    JSON.stringify({
      capacityProof: {
        oldDocumentBytes: bytes(original.document),
        migratedBytes: bytes(migrated),
        reviewedBytes: bytes(reviewed),
        replacedBytes: bytes(replaced),
        expandedLegacyBytes: bytes(expanded),
        actualTransferManifestBytes: manifestBytes,
        manifestHeadroomBytes: LIMITS.manifestBytes - manifestBytes,
        transferBytes: raw.length,
        transferHeadroomBytes: LIMITS.bundleBytes - raw.length,
        preservedOldAssetRecords: original.document.assets.length,
        totalAssetRecords: replaced.assets.length,
        payloads: imported.assets.size,
        payloadBytes: [...imported.assets.values()].reduce((sum, blob) => sum + blob.size, 0),
      },
    }),
  );
});

test('malformed second anchors, reference chains, parent cycles and shared-SHA conflicts never install a draft', async () => {
  const { migrated, document } = await smallReference();
  const fixture = managedIndexedDB(),
    store = createReferencedStudioStore({ indexedDB: fixture.indexedDB });
  const saved = await store.save(migrated, new Map());
  for (const [name, mutate, message] of [
    [
      'missing',
      (doc) => {
        doc.assets.at(-1).provenance.anchor.id = 'missing';
      },
      /direct inline/,
    ],
    [
      'hash',
      (doc) => {
        doc.assets.at(-1).provenance.anchor.sha256 = '0'.repeat(64);
      },
      /hash mismatch/,
    ],
    [
      'reference cycle',
      (doc) => {
        const a = doc.assets.at(-1),
          b = doc.assets.at(-2);
        a.provenance.anchor = { ...ref(b), sha256: '0'.repeat(64) };
        b.provenance.anchor = { ...ref(a), sha256: '0'.repeat(64) };
      },
      /direct inline/,
    ],
    [
      'self',
      (doc) => {
        const row = doc.assets.at(-1);
        row.provenance.anchor = { ...ref(row), sha256: '0'.repeat(64) };
      },
      /direct inline/,
    ],
    [
      'parent cycle',
      (doc) => {
        doc.assets.at(-1).provenance.parent = ref(doc.assets.at(-1));
      },
      /derivative cycle/,
    ],
  ]) {
    const bad = clone(document);
    mutate(bad);
    const beforePuts = fixture.allPuts.length;
    await assert.rejects(store.save(bad, new Map(), { expectedGeneration: 1 }), message, name);
    assert.equal(fixture.allPuts.length, beforePuts);
    await assertStored(store, saved);
  }
  const production = await actual(),
    collision = await migrateThemeReferences(production.document);
  const bad = clone(collision),
    source = bad.assets.find((row) => row.file),
    copy = clone(source);
  copy.id = 'conflicting-shared-file';
  copy.revision = 1;
  copy.file.bytes++;
  bad.assets.push(copy);
  await assert.rejects(
    validateReferencedBundle(bad),
    /Conflicting facts/,
    'identical SHA cannot carry different file facts',
  );
  await store.close();
});

test('concurrent stale generations, aborted writes and close/cancel during verification preserve saved state', async () => {
  const { migrated, document } = await smallReference(),
    fixture = managedIndexedDB();
  const first = createReferencedStudioStore({ indexedDB: fixture.indexedDB }),
    second = createReferencedStudioStore({ indexedDB: fixture.indexedDB });
  await first.save(migrated, new Map());
  const results = await Promise.allSettled([
    first.save(document, new Map(), { expectedGeneration: 1 }),
    second.save(document, new Map(), { expectedGeneration: 1 }),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  assert.match(
    results.find((row) => row.status === 'rejected').reason.message,
    /changed in another tab/,
  );
  const winner = await first.load();
  assert.equal(winner.generation, 2);
  const next = await reviseReferencedTheme(document, { tokens: { amber: '#ffcc00' } });
  fixture.onAnyPut = ({ tx }) => tx.abort();
  await assert.rejects(first.save(next, new Map(), { expectedGeneration: 2 }), /cancelled/);
  fixture.onAnyPut = null;
  await assertStored(first, winner);
  const abort = new AbortController(),
    saving = first.save(next, new Map(), { expectedGeneration: 2, signal: abort.signal });
  abort.abort();
  await assert.rejects(saving, { name: 'AbortError' });
  await assertStored(first, winner);
  const closing = second.save(next, new Map(), { expectedGeneration: 2 });
  await second.close();
  await assert.rejects(closing, /closed/);
  await assertStored(first, winner);
  await first.close();
});

test('v2 pending put cancellation and close retain the complete prior ledger and all payloads', async () => {
  const original = await actual(),
    migrated = await migrateThemeReferences(original.document),
    next = await reviseReferencedTheme(migrated, { tokens: { amber: '#ffcc00' } });
  for (const mode of ['signal', 'close']) {
    const fixture = managedIndexedDB(),
      store = createReferencedStudioStore({ indexedDB: fixture.indexedDB }),
      reader = createReferencedStudioStore({ indexedDB: fixture.indexedDB }),
      controller = new AbortController(),
      saved = await store.save(migrated, original.assets);
    let reachedPut = false;
    fixture.onAnyPut = () => {
      reachedPut = true;
      if (mode === 'signal') controller.abort();
      else void store.close();
    };
    await assert.rejects(
      store.save(next, original.assets, {
        expectedGeneration: saved.generation,
        signal: controller.signal,
      }),
      mode === 'signal' ? { name: 'AbortError' } : /closed/,
    );
    assert.equal(reachedPut, true);
    fixture.onAnyPut = null;
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    await assertStored(reader, saved);
    await store.close();
    await reader.close();
  }
});

test('v2 completed commits are not reported as rolled back and listeners detach on terminal outcomes', async () => {
  const { migrated, document } = await smallReference();
  for (const outcome of ['success', 'already-committed', 'quota']) {
    const fixture = managedIndexedDB(),
      store = createReferencedStudioStore({ indexedDB: fixture.indexedDB }),
      reader = createReferencedStudioStore({ indexedDB: fixture.indexedDB }),
      controller = new AbortController(),
      prior = await store.save(migrated, new Map());
    if (outcome === 'already-committed')
      fixture.afterAnyCommit = () => {
        controller.abort();
        void store.close();
      };
    if (outcome === 'quota') fixture.failAnyPutAt = 1;
    const saving = store.save(document, new Map(), {
      expectedGeneration: 1,
      signal: controller.signal,
    });
    let saved;
    if (outcome === 'quota') await assert.rejects(saving, { name: 'QuotaExceededError' });
    else saved = await saving;
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    fixture.afterAnyCommit = null;
    fixture.failAnyPutAt = null;
    controller.abort();
    await store.close();
    await assertStored(reader, saved ?? prior);
    await reader.close();
  }
});

test('v2 owner close does not abort another connection and legacy close retains its prior semantics', async () => {
  const { migrated, document, legacy } = await smallReference(),
    fixture = managedIndexedDB(),
    first = createReferencedStudioStore({ indexedDB: fixture.indexedDB }),
    other = createReferencedStudioStore({ indexedDB: fixture.indexedDB });
  await first.save(migrated, new Map());
  await other.load();
  fixture.onAnyPut = () => void other.close();
  const saved = await first.save(document, new Map(), { expectedGeneration: 1 });
  fixture.onAnyPut = null;
  await assertStored(first, saved);
  await first.close();
  const legacyFixture = managedIndexedDB(),
    old = createStudioStore({ indexedDB: legacyFixture.indexedDB });
  await old.save(legacy, new Map());
  legacyFixture.onAnyPut = () => void old.close();
  const oldSaved = await old.save(legacy, new Map(), { expectedGeneration: 1 });
  legacyFixture.onAnyPut = null;
  const oldReader = createStudioStore({ indexedDB: legacyFixture.indexedDB });
  await assertStored(oldReader, oldSaved);
  await oldReader.close();
});

test('foreign same-ID ancestry is remapped before reference deduplication', async () => {
  const legacy = createDefaultThemeBundle(),
    local = await migrateThemeReferences(legacy),
    foreign = clone(legacy);
  foreign.assets[0].provenance.prompt += ' Foreign parent context.';
  foreign.assets[1].provenance.source += ' Foreign child provenance.';
  foreign.assets[1].provenance.parent = ref(foreign.assets[0]);
  const incoming = await migrateThemeReferences(foreign),
    child = clone(foreign.assets[1]);
  child.revision++;
  child.provenance.parent = ref(foreign.assets[1]);
  const slot = Object.entries(resolvePresentation(foreign).bindings).find(
    ([, value]) => value.id === child.id,
  )[0];
  const withReference = await reviseReferencedTheme(incoming, {
    assets: [child],
    bindings: { [slot]: ref(child) },
  });
  const snapshot = canonicalJSON(withReference),
    adopted = await adoptReferencedBundle(local, withReference);
  assert.deepEqual(adopted.assets.slice(0, local.assets.length), local.assets);
  assert.equal(canonicalJSON(withReference), snapshot);
  const selected = await resolveReferencedPresentation(adopted),
    reader = await openReferencedAssets(adopted),
    target = selected.assets[slot];
  assert.notEqual(target.id, child.id);
  assert.equal(target.provenance.source, child.provenance.source);
  const parent = reader.get(target.provenance.parent),
    grandparent = reader.get(parent.provenance.parent);
  assert.notEqual(parent.id, foreign.assets[1].id);
  assert.notEqual(grandparent.id, foreign.assets[0].id);
  assert.equal(grandparent.provenance.prompt, foreign.assets[0].provenance.prompt);
  assert.equal(target.provenance.prompt, child.provenance.prompt);
});

test('actual wrapper overhead and transfer limits reject before returning or saving a candidate', async () => {
  const original = await actual(),
    document = clone(await migrateThemeReferences(original.document));
  const target = LIMITS.manifestBytes - 1000;
  for (const row of document.assets) {
    const needed = target - bytes(document);
    if (needed <= 0) break;
    row.provenance.prompt += 'x'.repeat(Math.min(needed, 8192 - row.provenance.prompt.length));
  }
  assert.equal(bytes(document), target);
  await validateReferencedBundle(document);
  await assert.rejects(
    exportReferencedBundle(document, original.assets),
    /manifest exceeds its budget/,
  );
  const tooLarge = clone(document);
  tooLarge.assets[0].provenance.prompt = 'x'.repeat(8193);
  await assert.rejects(validateReferencedBundle(tooLarge), /budget|prompt/);
  await assert.rejects(
    importReferencedBundle(new Blob([new Uint8Array(LIMITS.bundleBytes + 1)])),
    /byte budget/,
  );
  const { document: small } = await smallReference(),
    portable = await exportReferencedBundle(small);
  const abort = new AbortController(),
    imported = importReferencedBundle(portable, { signal: abort.signal, decodeImage: null });
  abort.abort();
  await assert.rejects(imported, { name: 'AbortError' });
  await assert.rejects(
    importThemeBundle(portable, { decodeImage: null }),
    /Unsupported theme bundle/,
  );
});

test('compiler shares unchanged runtime assembly while carrying encoded v2 studio history', async () => {
  const legacy = createDefaultThemeBundle(),
    migrated = await migrateThemeReferences(legacy);
  const before = await compilePresentation(legacy),
    after = await compileReferencedPresentation(migrated);
  assert.deepEqual(after.resolved, before.resolved);
  assert.deepEqual(after.files.get('theme.css'), before.files.get('theme.css'));
  const runtime = JSON.parse(new TextDecoder().decode(after.files.get('runtime.json')));
  assert.deepEqual(runtime.resolved, before.resolved);
  assert.equal(runtime.source.revision, migrated.revision);
  const studio = JSON.parse(new TextDecoder().decode(after.files.get('studio.json')));
  assert.deepEqual(studio, migrated);
  assert.equal(studio.format, 'revealline-theme-bundle.v2');
});

test('malformed reference imports and corrupted payload imports leave the previous complete workspace intact', async () => {
  const { migrated, document } = await smallReference(),
    fixture = managedIndexedDB();
  const store = createReferencedStudioStore({ indexedDB: fixture.indexedDB });
  const saved = await store.save(migrated, new Map()),
    portable = await exportReferencedBundle(document);
  const raw = new Uint8Array(await portable.arrayBuffer()),
    length = new DataView(raw.buffer).getUint32(8);
  const originalManifest = JSON.parse(new TextDecoder().decode(raw.slice(12, 12 + length)));
  for (const mutation of ['missing', 'hash']) {
    const manifest = clone(originalManifest),
      anchor = manifest.document.assets.at(-1).provenance.anchor;
    if (mutation === 'missing') anchor.id = 'missing';
    else anchor.sha256 = '0'.repeat(64);
    const encoded = new TextEncoder().encode(canonicalJSON(manifest)),
      header = raw.slice(0, 12);
    new DataView(header.buffer).setUint32(8, encoded.length);
    const puts = fixture.allPuts.length;
    await assert.rejects(
      (async () => {
        const accepted = await importReferencedBundle(new Blob([header, encoded]), {
          decodeImage: null,
        });
        await store.save(accepted.document, accepted.assets, { expectedGeneration: 1 });
      })(),
      /direct inline|hash mismatch/,
    );
    assert.equal(fixture.allPuts.length, puts);
    await assertStored(store, saved);
  }
  const original = await actual(),
    full = await exportReferencedBundle(
      await migrateThemeReferences(original.document),
      original.assets,
    );
  const corrupted = new Uint8Array(await full.arrayBuffer());
  corrupted[corrupted.length - 1] ^= 1;
  const puts = fixture.allPuts.length;
  await assert.rejects(
    (async () => {
      const accepted = await importReferencedBundle(new Blob([corrupted]), { decodeImage: null });
      await store.save(accepted.document, accepted.assets, { expectedGeneration: 1 });
    })(),
    /bytes\/hash/,
  );
  assert.equal(fixture.allPuts.length, puts);
  await assertStored(store, saved);
  await store.close();
});

test('encoded shape and count boundaries reject before reading unsafe fields or resolving anchors', async () => {
  const { document } = await smallReference();
  let reads = 0;
  const accessor = clone(document);
  Object.defineProperty(accessor.assets.at(-1).provenance.anchor, 'sha256', {
    enumerable: true,
    get() {
      reads++;
      return '0'.repeat(64);
    },
  });
  await assert.rejects(validateReferencedBundle(accessor), /accessors/);
  assert.equal(reads, 0);
  const slots = clone(document);
  slots.slots = Array.from({ length: LIMITS.slots + 1 }, () => clone(document.slots[0]));
  await assert.rejects(validateReferencedBundle(slots), /slots count/);
  const hidden = clone(document);
  hidden.assets.at(-1).provenance.anchor.url = 'https://example.invalid/history';
  await assert.rejects(validateReferencedBundle(hidden), /not supported/);
});

test('one transition cannot invent two revisions of one identity while a saved batch retains valid separate actions', async () => {
  const { migrated, document } = await smallReference();
  const selected = await resolveReferencedPresentation(document),
    [slot, current] = Object.entries(selected.assets)[0];
  const row = clone(current);
  row.revision++;
  row.provenance.parent = ref(current);
  const second = await reviseReferencedTheme(document, {
    assets: [row],
    bindings: { [slot]: ref(row) },
  });
  const collapsed = { ...clone(second), revision: migrated.revision + 1 };
  await assert.rejects(
    validateReferencedBundle(collapsed, { previous: migrated }),
    /next revision|complete history/,
  );
  const fixture = managedIndexedDB(),
    store = createReferencedStudioStore({ indexedDB: fixture.indexedDB });
  await store.save(migrated, new Map());
  const saved = await store.save(second, new Map(), { expectedGeneration: 1 });
  assert.equal(saved.generation, 2);
  assert.deepEqual(saved.document.assets.slice(0, migrated.assets.length), migrated.assets);
  await store.close();
});
