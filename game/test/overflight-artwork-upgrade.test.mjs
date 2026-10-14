import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { adoptStudioBundle, replaceStudioCollection } from '../presentation/studio-session.mjs';
import { unsupportedThemeAssignmentSlots } from '../presentation/theme-preview.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import {
  OVERFLIGHT_ARTWORK_SLOTS,
  addOverflightArtworkSlots,
  needsOverflightArtworkSlots,
  isNativeOverflightArtworkFallback,
} from '../presentation/overflight-artwork-upgrade.mjs';

function historical() {
  const source = structuredClone(createDefaultThemeBundle());
  source.slots = source.slots.filter((slot) => !OVERFLIGHT_ARTWORK_SLOTS.includes(slot.id));
  source.assets = source.assets.filter(
    (asset) => !OVERFLIGHT_ARTWORK_SLOTS.some((slot) => asset.id === `${slot}.default`),
  );
  for (const theme of source.themes)
    for (const id of OVERFLIGHT_ARTWORK_SLOTS) delete theme.bindings[id];
  return validateThemeBundle(source);
}

test('old workspaces explicitly stage all decorative and actor slots without rewriting selected assets or history', async () => {
  const old = historical();
  const selected = replaceStudioCollection(old, {
    id: 'my-existing-kit',
    name: 'Existing kit',
    requiredSlots: ['terrain.wall'],
    bindings: { 'terrain.wall': resolvePresentation(old).bindings['terrain.wall'] },
  });
  const before = structuredClone(selected);
  const next = addOverflightArtworkSlots(selected);
  assert.equal(needsOverflightArtworkSlots(selected), true);
  assert.equal(needsOverflightArtworkSlots(next), false);
  assert.equal(next.revision, selected.revision + 1);
  assert.deepEqual(selected, before);
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(next[field].slice(0, selected[field].length), selected[field]);
  const previous = resolvePresentation(selected),
    current = resolvePresentation(next);
  for (const [id, asset] of Object.entries(previous.assets))
    assert.deepEqual(current.assets[id], asset);
  for (const id of OVERFLIGHT_ARTWORK_SLOTS) {
    const slot = next.slots.find((entry) => entry.id === id);
    assert.equal(slot.required, false);
    assert.equal(current.assets[id].kind, 'recipe');
    assert.equal(isNativeOverflightArtworkFallback(slot, current.assets[id]), true);
  }
  const pinned = structuredClone(next);
  pinned.selection = structuredClone(selected.selection);
  assert.equal(resolvePresentation(pinned).assets[OVERFLIGHT_ARTWORK_SLOTS[0]], undefined);
  assert.throws(() => addOverflightArtworkSlots(next), /already available/);
  const exported = await exportThemeBundle(next, new Map());
  assert.deepEqual((await importThemeBundle(exported)).document, next);
});

test('partially admitted custom actor artwork stays selected while missing world slots gain native fallback', () => {
  const source = structuredClone(historical());
  const defaults = createDefaultThemeBundle();
  const id = 'overflight.soldier.patroller.tactical';
  const contract = defaults.slots.find((entry) => entry.id === id);
  const asset = {
    ...structuredClone(defaults.assets.find((entry) => entry.id === `${id}.default`)),
    id: 'my-patroller',
    kind: 'image',
    recipe: null,
    file: { sha256: 'a'.repeat(64), bytes: 256, mime: 'image/png', width: 32, height: 32 },
    geometry: structuredClone(contract.geometry),
  };
  source.slots.push(structuredClone(contract));
  source.assets.push(asset);
  source.themes.at(-1).bindings[id] = { id: asset.id, revision: asset.revision };
  const accepted = validateThemeBundle(source);
  const next = addOverflightArtworkSlots(accepted);
  assert.deepEqual(resolvePresentation(next).assets[id], asset);
  assert.equal(isNativeOverflightArtworkFallback(contract, asset), false);
  assert.equal(resolvePresentation(next).assets['world.overflight.material.earth'].kind, 'recipe');
  const imported = adoptStudioBundle(historical(), next);
  assert.equal(resolvePresentation(imported).assets[id].file.sha256, asset.file.sha256);
});

test('altered registered contracts and arbitrary matching prefixes cannot be silently admitted', () => {
  const old = historical();
  const next = structuredClone(addOverflightArtworkSlots(old));
  const id = OVERFLIGHT_ARTWORK_SLOTS[0];
  next.slots.find((slot) => slot.id === id).requirements.push('Invented collision meaning');
  assert.throws(
    () => addOverflightArtworkSlots(next),
    /Unsupported FPV Survivals artwork contract/,
  );
  assert.throws(() => adoptStudioBundle(old, next), /Unsupported imported slot contract/);
  const unknown = structuredClone(addOverflightArtworkSlots(old));
  unknown.slots.push({
    ...structuredClone(unknown.slots.find((slot) => slot.id === id)),
    id: 'world.overflight.prop.unregistered',
  });
  assert.throws(() => adoptStudioBundle(old, unknown), /Unsupported imported slot contract/);
  assert.equal(needsOverflightArtworkSlots(old), true);
});

test('token-only assignments admit native fallback additions but still reject actual custom art or changed recipes', () => {
  const old = historical();
  const next = addOverflightArtworkSlots(old);
  assert.deepEqual(unsupportedThemeAssignmentSlots(next, old), []);
  const changed = structuredClone(next);
  const id = OVERFLIGHT_ARTWORK_SLOTS[0];
  changed.assets.find((asset) => asset.id === `${id}.default`).description += ' edited';
  assert.deepEqual(unsupportedThemeAssignmentSlots(changed, old), [id]);
});
