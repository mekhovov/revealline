import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { duplicateStudioSnapshot, reviseStudioTheme } from '../presentation/studio-session.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { inspectStudioTheme, tokenContrast } from '../presentation/studio-inspection.mjs';

const clone = (source, id = 'industrial-draft') =>
  duplicateStudioSnapshot(source, { id, name: 'Industrial draft' });

test('duplicate flattens selected appearance without carrying theme history', () => {
  const original = createDefaultThemeBundle();
  const changed = reviseStudioTheme(original, { tokens: { amber: '#f0bc66' } });
  const duplicate = clone(changed);
  assert.equal(duplicate.themes.length, 1);
  assert.equal(duplicate.revision, 1);
  assert.equal(duplicate.id, 'industrial-draft');
  assert.deepEqual(resolvePresentation(duplicate).tokens, resolvePresentation(changed).tokens);
  assert.deepEqual(resolvePresentation(duplicate).assets, resolvePresentation(changed).assets);
  assert.equal(original.themes.length, 2);
});

test('workspace migration is atomic, idempotent and leaves the legacy recovery copy', async () => {
  const fixture = memoryIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  const original = createDefaultThemeBundle();
  await store.save(original, new Map());
  fixture.failAnyPutAt = 2;
  await assert.rejects(store.migrateLegacyWorkspace(), /write failure/);
  assert.equal((await store.listWorkspaces()).migrated, false);
  assert.equal((await store.load()).document.id, original.id);
  fixture.failAnyPutAt = null;
  const first = await store.migrateLegacyWorkspace();
  const second = await store.migrateLegacyWorkspace();
  assert.deepEqual(first, second);
  assert.equal(first.entries.length, 1);
  assert.deepEqual((await store.loadWorkspace(first.activeId)).document, original);
  assert.deepEqual((await store.load()).document, original);
});

test('independent workspaces reject identity collisions and stale saves without growing each other', async () => {
  const store = createStudioStore({ indexedDB: memoryIndexedDB().indexedDB });
  const original = createDefaultThemeBundle();
  const a = await store.createWorkspace(original, new Map());
  const b = await store.createWorkspace(clone(original), new Map());
  await assert.rejects(
    store.createWorkspace(original, new Map(), { id: 'another-local-id' }),
    /identity already/,
  );
  await store.saveWorkspace(
    b.id,
    reviseStudioTheme(b.document, { tokens: { amber: '#e4ba56' } }),
    b.assets,
    { expectedGeneration: 1 },
  );
  await assert.rejects(
    store.saveWorkspace(b.id, b.document, b.assets, { expectedGeneration: 1 }),
    /changed in another tab/,
  );
  assert.deepEqual((await store.loadWorkspace(a.id)).document, original);
  assert.equal((await store.loadWorkspace(b.id)).generation, 2);
  await store.selectWorkspace(a.id);
  assert.equal((await store.listWorkspaces()).activeId, a.id);
  assert.equal((await store.listWorkspaces()).entries.length, 2);
});

test('failed independent workspace creation publishes neither entry nor bytes', async () => {
  const fixture = memoryIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  fixture.failAnyPutAt = 2;
  await assert.rejects(
    store.createWorkspace(createDefaultThemeBundle(), new Map()),
    /write failure/,
  );
  assert.equal((await store.listWorkspaces()).entries.length, 0);
  assert.equal(await store.loadWorkspace('field-kit'), null);
});

test('explicit replacement preserves imported identity and a recoverable prior generation', async () => {
  const fixture = memoryIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  const original = createDefaultThemeBundle();
  const created = await store.createWorkspace(original, new Map());
  const changed = reviseStudioTheme(original, { tokens: { text: '#eeeeee' } });
  fixture.failAnyPutAt = 3;
  await assert.rejects(
    store.replaceWorkspace(created.id, changed, new Map(), { expectedGeneration: 1 }),
    /write failure/,
  );
  assert.equal((await store.listWorkspaces()).entries.length, 1);
  assert.deepEqual((await store.loadWorkspace(created.id)).document, original);
  fixture.failAnyPutAt = null;
  await store.replaceWorkspace(created.id, changed, new Map(), { expectedGeneration: 1 });
  const library = await store.listWorkspaces();
  const recovery = library.entries.find((row) => row.recovery);
  assert.ok(recovery);
  assert.deepEqual((await store.loadWorkspace(recovery.id)).document, original);
  assert.deepEqual((await store.loadWorkspace(created.id)).document, changed);
  await assert.rejects(
    store.replaceWorkspace(created.id, clone(original), new Map(), { expectedGeneration: 2 }),
    /same imported theme identity/,
  );
});

test('inspection reports exact role provenance and token contrast without claiming visual approval', () => {
  const source = createDefaultThemeBundle();
  const report = inspectStudioTheme(source, 'ui.panel');
  assert.equal(report.role.id, 'ui.panel');
  assert.equal(report.coverage.requiredReady, false);
  assert.equal(report.role.asset.quality.stage, 'source');
  assert.ok(report.role.asset.provenance.source);
  assert.ok(report.bytes.metadata > 0 && report.bytes.metadata < report.bytes.metadataLimit);
  assert.equal(report.bytes.historyFiles, 0);
  assert.equal(tokenContrast('#ffffff', '#000000'), 21);
  assert.equal(tokenContrast('#ffffff', '#ffffff'), 1);
  assert.ok(
    report.contrast.every((row) =>
      [
        'solid-token-only',
        'resolved-component-solid-center',
        'focus-ring-adjacent-surface',
      ].includes(row.scope),
    ),
  );
  assert.ok(report.contrast.some((row) => row.role === 'primary' && row.state === 'pressed'));
  assert.ok(report.contrast.some((row) => row.role === 'input' && row.state === 'focus'));
  assert.equal(report.candidate.sourcePalette.document.revision, source.revision);
  assert.ok(report.candidate.reviewRequired.includes('textured edges'));
});

test('maximum-length identities migrate and replace into bounded loadable recovery IDs', async () => {
  const store = createStudioStore({ indexedDB: memoryIndexedDB().indexedDB });
  const original = { ...createDefaultThemeBundle(), id: 'a'.repeat(80) };
  await store.save(original, new Map());
  const migrated = await store.migrateLegacyWorkspace();
  assert.ok(migrated.activeId.length <= 128);
  assert.equal((await store.loadWorkspace(migrated.activeId)).document.id, original.id);
  const changed = reviseStudioTheme(original, { tokens: { amber: '#e4ba56' } });
  await store.replaceWorkspace(migrated.activeId, changed, new Map(), { expectedGeneration: 1 });
  const recovery = (await store.listWorkspaces()).entries.find((entry) => entry.recovery);
  assert.ok(recovery.id.length <= 128);
  assert.deepEqual((await store.loadWorkspace(recovery.id)).document, original);
  for (const expectedGeneration of [0, -1, 1.5, Number.MAX_SAFE_INTEGER])
    await assert.rejects(
      store.replaceWorkspace(migrated.activeId, changed, new Map(), { expectedGeneration }),
      /Invalid expected/,
    );
  const independent = await store.createWorkspace({ ...original, id: 'b'.repeat(80) }, new Map(), {
    id: 'w'.repeat(128),
  });
  assert.equal((await store.loadWorkspace(independent.id)).document.id, 'b'.repeat(80));
});

test('snapshot drops unbound historical assets while preserving derivative provenance', () => {
  const source = createDefaultThemeBundle();
  const prior = resolvePresentation(source).assets['ui.panel'];
  const unused = { ...structuredClone(prior), id: 'unused-history', revision: 1 };
  const selected = {
    ...structuredClone(prior),
    id: 'custom-panel',
    revision: 1,
    provenance: { ...prior.provenance, parent: { id: prior.id, revision: prior.revision } },
  };
  const changed = reviseStudioTheme(source, {
    assets: [unused, selected],
    bindings: { 'ui.panel': { id: selected.id, revision: 1 } },
  });
  const duplicated = clone(changed);
  assert.ok(!duplicated.assets.some((asset) => asset.id === unused.id));
  assert.ok(duplicated.assets.some((asset) => asset.id === prior.id));
  assert.deepEqual(
    resolvePresentation(duplicated).assets['ui.panel'].provenance,
    selected.provenance,
  );
});
