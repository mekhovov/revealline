import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { reviseStudioTheme, adoptStudioBundle } from '../presentation/studio-session.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import fs from 'node:fs/promises';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { createFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';

function desired(
  description = 'First production recipe',
  quality = { stage: 'source', evidence: [] },
) {
  const document = createDefaultThemeBundle();
  const original = structuredClone(resolvePresentation(document).assets['ui.button.primary']);
  const asset = {
    ...original,
    id: 'ui.button.primary.field-kit',
    description,
    quality,
    provenance: {
      ...original.provenance,
      parent: { id: original.id, revision: original.revision },
    },
  };
  return reviseStudioTheme(document, {
    assets: [asset],
    bindings: { 'ui.button.primary': { id: asset.id, revision: asset.revision } },
  });
}

test('unchanged production preserves its exact document and appends changed revisions', () => {
  const first = desired();
  assert.deepEqual(retainProductionHistory(first, first), first);
  const changed = retainProductionHistory(desired('Updated production recipe'), first);
  validateThemeBundle(changed, { previous: first });
  const asset = resolvePresentation(changed).assets['ui.button.primary'];
  assert.equal(asset.revision, 2);
  assert.deepEqual(asset.provenance.parent, { id: asset.id, revision: 1 });
  assert.deepEqual(
    changed.assets.find((a) => a.id === asset.id && a.revision === 1),
    first.assets.at(-1),
  );
  assert.deepEqual(retainProductionHistory(desired('Updated production recipe'), changed), changed);
});

test('review evidence gets an immutable successor and normal reproduction keeps the review', () => {
  const first = desired();
  const reviewed = retainProductionHistory(
    desired(undefined, {
      stage: 'reviewed',
      evidence: ['Observed actual focus, pressed and disabled states.'],
    }),
    first,
  );
  assert.equal(resolvePresentation(reviewed).assets['ui.button.primary'].revision, 2);
  assert.equal(first.assets.at(-1).quality.stage, 'source');
  assert.deepEqual(retainProductionHistory(desired(), reviewed), reviewed);
  const changed = retainProductionHistory(desired('New drawing requiring a new review'), reviewed);
  assert.equal(resolvePresentation(changed).assets['ui.button.primary'].revision, 3);
  assert.equal(resolvePresentation(changed).assets['ui.button.primary'].quality.stage, 'source');
});

test('production refuses silent slot contract mutation and can explicitly return to an old revision', () => {
  const first = desired(),
    changed = retainProductionHistory(desired('Second recipe'), first);
  const reset = retainProductionHistory(first, changed);
  assert.equal(resolvePresentation(reset).assets['ui.button.primary'].revision, 1);
  assert.equal(reset.assets.length, changed.assets.length);
  const incompatible = structuredClone(first);
  incompatible.slots[0].required = false;
  assert.throws(
    () => retainProductionHistory(incompatible, first),
    /explicit compatible migration/,
  );
});

test('the whole production collection has capacity for immutable review successors', async () => {
  const prior = await importThemeBundle(
    new Blob([
      await fs.readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const production = await createFieldKitProduction();
  const proposed = structuredClone(production.document);
  const selected = resolvePresentation(proposed);
  // Capacity fixture only: it never writes or qualifies production artwork.
  for (const slot of proposed.slots.filter((entry) => entry.required)) {
    const selectedAsset = selected.assets[slot.id];
    const asset = proposed.assets.find(
      (entry) => entry.id === selectedAsset.id && entry.revision === selectedAsset.revision,
    );
    asset.quality = {
      stage: 'reviewed',
      evidence: ['Capacity fixture only; not production qualification. '.repeat(4)],
    };
  }
  const next = retainProductionHistory(proposed, prior.document);
  validateThemeBundle(next, { previous: prior.document });
  assert.ok(next.assets.length > prior.document.assets.length);
  for (const old of prior.document.assets)
    assert.deepEqual(
      next.assets.find((entry) => entry.id === old.id && entry.revision === old.revision),
      old,
    );
  const bytes = new Map([...prior.assets, ...production.assets]);
  const portable = await exportThemeBundle(next, bytes);
  const restored = await importThemeBundle(portable, { decodeImage: null });
  assert.deepEqual(restored.document, next);
  const adopted = adoptStudioBundle(next, restored.document);
  assert.deepEqual(
    adopted.assets,
    next.assets,
    'a complete native round trip reuses exact history',
  );
  assert.deepEqual(resolvePresentation(adopted).assets, resolvePresentation(next).assets);
  const reexport = await exportThemeBundle(adopted, restored.assets);
  assert.ok(
    reexport.size >= portable.size,
    'collection history is retained within existing bounds',
  );
});
