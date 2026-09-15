import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { reviseStudioTheme, adoptStudioBundle } from '../presentation/studio-session.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('the current source-pinned motion and feedback recipe reviews remain selected', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  for (const slotId of [
    'player.scout.rotors',
    'player.bomber.rotors',
    'player.carrier.rotors',
    'player.interceptor.rotors',
    'player.fiber.rotors',
    'player.impact.rotors',
    'player.trapper.rotors',
    'trail.active',
    'trail.secured',
    'trail.head',
    'effect.capture',
    'effect.failure',
    'effect.victory',
    'effect.pickup',
    'effect.shield',
    'effect.respawn',
    'effect.pressure',
  ]) {
    const asset = resolved.assets[slotId];
    assert.equal(asset.quality.stage, 'reviewed', slotId);
    assert.ok(asset.quality.evidence.some((entry) => entry.includes('Scoped v0.54 source review')));
  }
});

test('P01 UI and P02-A audio reviews cover exact current inputs', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const reviewed = production.document.slots.filter((slot) => ['ui', 'audio'].includes(slot.group));
  assert.equal(reviewed.length, 32);
  for (const slot of reviewed) {
    const asset = resolved.assets[slot.id];
    assert.equal(asset.quality.stage, 'reviewed', slot.id);
    const review = slot.group === 'ui' ? 'Scoped P01 source review' : 'Scoped P02-A source review';
    assert.ok(
      asset.quality.evidence.some((entry) => entry.includes(review)),
      slot.id,
    );
    if (slot.group === 'ui') {
      assert.match(asset.provenance.source, /game\/ui\/operation-status\.css/);
      assert.match(asset.provenance.source, /game\/ui\/operation-status\.mjs/);
    } else {
      assert.match(asset.provenance.source, /game\/ui\/audio-master\.mjs/);
    }
  }
});

test('changed loading and shared-master inputs reopen only their own reviewed recipe group', async (t) => {
  const production = await createFieldKitProduction();
  const prior = structuredClone(production.document);
  const reviewed = prior.slots.filter((slot) => ['ui', 'audio'].includes(slot.group));
  const selected = resolvePresentation(prior);
  // Review-state fixture only. Actual current approvals are asserted separately above.
  for (const slot of reviewed) {
    const ref = selected.assets[slot.id];
    const asset = prior.assets.find(
      (asset) => asset.id === ref.id && asset.revision === ref.revision,
    );
    if (asset.quality.stage !== 'reviewed')
      asset.quality = {
        stage: 'reviewed',
        evidence: ['Synthetic source-invalidation fixture; not production approval.'],
      };
  }
  const resolved = resolvePresentation(prior);
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-source-invalidation-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const inputs = new Map([
    ['operation-status.css', 'ui'],
    ['operation-status.mjs', 'ui'],
    ['soundtrack-player.mjs', 'audio'],
    ['audio-master.mjs', 'audio'],
  ]);
  // Read unchanged inputs through links; only the named fixture files are writable.
  await fs.mkdir(path.join(fixture, 'game', 'ui'), { recursive: true });
  for (const entry of ['authoring', 'site'])
    await fs.symlink(path.join(root, entry), path.join(fixture, entry));
  for (const entry of await fs.readdir(path.join(root, 'game')))
    if (entry !== 'ui')
      await fs.symlink(path.join(root, 'game', entry), path.join(fixture, 'game', entry));
  for (const entry of await fs.readdir(path.join(root, 'game', 'ui'))) {
    const source = path.join(root, 'game', 'ui', entry);
    const target = path.join(fixture, 'game', 'ui', entry);
    if (inputs.has(entry)) await fs.copyFile(source, target);
    else await fs.symlink(source, target);
  }
  for (const [input, group] of inputs) {
    const target = path.join(fixture, 'game', 'ui', input);
    const original = await fs.readFile(target);
    await fs.appendFile(target, '\n/* Unreviewed fixture change. */\n');
    const changed = await createFieldKitProduction({ projectRoot: fixture });
    const next = retainProductionHistory(changed.document, prior);
    validateThemeBundle(next, { previous: prior });
    const assets = resolvePresentation(next).assets;
    for (const slot of reviewed) {
      assert.equal(assets[slot.id].quality.stage, slot.group === group ? 'source' : 'reviewed');
      if (slot.group === group) {
        assert.notEqual(
          assets[slot.id].provenance.source,
          resolved.assets[slot.id].provenance.source,
        );
        assert.equal(assets[slot.id].revision, resolved.assets[slot.id].revision + 1);
      } else assert.deepEqual(assets[slot.id], resolved.assets[slot.id]);
    }
    assert.deepEqual(next.assets.slice(0, prior.assets.length), prior.assets);
    await fs.writeFile(target, original);
  }
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
  // An administrator must also be able to replace the complete reviewed set.
  const variation = structuredClone(next),
    variationResolved = resolvePresentation(next);
  for (const slot of variation.slots.filter((entry) => entry.required)) {
    const current = variationResolved.assets[slot.id];
    variation.assets.find(
      (entry) => entry.id === current.id && entry.revision === current.revision,
    ).description += ' / coordinated replacement capacity fixture';
  }
  const replaced = retainProductionHistory(variation, next);
  validateThemeBundle(replaced, { previous: next });
  assert.equal(
    replaced.assets.length,
    next.assets.length + proposed.slots.filter((s) => s.required).length,
  );
  for (const old of next.assets)
    assert.deepEqual(
      replaced.assets.find((entry) => entry.id === old.id && entry.revision === old.revision),
      old,
    );
  const bytes = new Map([...prior.assets, ...production.assets]);
  const replacementExport = await exportThemeBundle(replaced, bytes);
  const replacementImport = await importThemeBundle(replacementExport, { decodeImage: null });
  assert.deepEqual(replacementImport.document, replaced);

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
