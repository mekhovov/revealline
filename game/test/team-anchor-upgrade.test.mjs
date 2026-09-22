import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { addTeamAnchorSlots, needsTeamAnchorSlots } from '../presentation/team-anchor-upgrade.mjs';
import { TEAM_ANCHOR_SLOTS } from '../couch/coop-anchor-presentation.mjs';
import {
  reviseStudioTheme,
  replaceStudioCollection,
  generateAssetPrompt,
} from '../presentation/studio-session.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
function historical() {
  const d = structuredClone(createDefaultThemeBundle());
  d.slots = d.slots.filter((s) => !TEAM_ANCHOR_SLOTS.includes(s.id));
  d.assets = d.assets.filter((a) => !TEAM_ANCHOR_SLOTS.some((id) => a.id === `${id}.default`));
  for (const t of d.themes) for (const id of TEAM_ANCHOR_SLOTS) delete t.bindings[id];
  return validateThemeBundle(d);
}
test('explicit upgrade retains all old records and selected collection appearance in one revision', () => {
  const old = historical(),
    slot = old.slots[0].id;
  const selected = replaceStudioCollection(old, {
    id: 'author-collection',
    name: 'Author collection',
    requiredSlots: [slot],
    bindings: { [slot]: resolvePresentation(old).bindings[slot] },
  });
  const before = structuredClone(selected),
    next = addTeamAnchorSlots(selected);
  assert(needsTeamAnchorSlots(selected));
  assert(!needsTeamAnchorSlots(next));
  assert.equal(next.revision, selected.revision + 1);
  for (const kind of ['slots', 'assets', 'themes', 'collections'])
    for (const record of selected[kind])
      assert.deepEqual(
        next[kind].find((x) => x.id === record.id && x.revision === record.revision),
        record,
      );
  assert.deepEqual(
    resolvePresentation(next).assets[slot],
    resolvePresentation(selected).assets[slot],
  );
  assert.deepEqual(selected, before);
  const pinned = structuredClone(next);
  pinned.selection = structuredClone(selected.selection);
  assert.equal(
    resolvePresentation(pinned).assets[TEAM_ANCHOR_SLOTS[0]],
    undefined,
    'Old exact theme remains unchanged.',
  );
  assert.throws(() => addTeamAnchorSlots(next), /already available/);
});
test('partial registration never replaces an existing selected custom anchor', () => {
  const old = structuredClone(historical()),
    defaults = createDefaultThemeBundle(),
    id = TEAM_ANCHOR_SLOTS[0];
  old.slots.push(structuredClone(defaults.slots.find((s) => s.id === id)));
  const asset = structuredClone(defaults.assets.find((a) => a.id === `${id}.default`));
  asset.id = 'custom-anchor';
  asset.description = 'Existing custom author choice';
  old.assets.push(asset);
  old.themes.at(-1).bindings[id] = { id: asset.id, revision: 1 };
  const next = addTeamAnchorSlots(old);
  assert.equal(resolvePresentation(next).assets[id].id, 'custom-anchor');
});
test('uploaded anchor bytes and immutable history survive export/import; prompt states the fixed role', async () => {
  const original = addTeamAnchorSlots(historical()),
    id = TEAM_ANCHOR_SLOTS[0],
    slot = original.slots.find((s) => s.id === id),
    prior = resolvePresentation(original).assets[id];
  const rgba = new Uint8Array(24 * 24 * 4);
  for (let y = 5; y < 19; y++)
    for (let x = 5; x < 19; x++) {
      const at = (y * 24 + x) * 4;
      rgba.set([120, 220, 232, 255], at);
    }
  const bytes = encodeSpritePNG({ width: 24, height: 24, rgba }),
    blob = new Blob([bytes], { type: 'image/png' }),
    hash = await hashPresentationBytes(bytes);
  const asset = {
    ...structuredClone(prior),
    id: 'anchor-upload',
    revision: 1,
    kind: 'image',
    recipe: null,
    file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 24, height: 24 },
    geometry: structuredClone(slot.geometry),
    provenance: {
      ...structuredClone(prior.provenance),
      parent: { id: prior.id, revision: prior.revision },
    },
  };
  const next = reviseStudioTheme(original, {
    assets: [asset],
    bindings: { [id]: { id: asset.id, revision: 1 } },
  });
  const packed = await exportThemeBundle(next, new Map([[hash, blob]]));
  const restored = await importThemeBundle(packed, {
    decodeImage: async () => ({ naturalWidth: 24, naturalHeight: 24 }),
  });
  assert.deepEqual(
    new Uint8Array(await restored.assets.get(hash).arrayBuffer()),
    new Uint8Array(bytes),
  );
  assert.deepEqual(restored.document, next);
  assert.match(generateAssetPrompt(slot, resolvePresentation(next)), /collision geometry/);
  assert.equal(resolvePresentation(original).assets[id].kind, 'recipe');
  const malformed = structuredClone(asset);
  malformed.id = 'bad-pivot';
  malformed.geometry.pivot.x = 0;
  assert.throws(
    () =>
      reviseStudioTheme(original, {
        assets: [malformed],
        bindings: { [id]: { id: malformed.id, revision: 1 } },
      }),
    /centered pivot/,
  );
});
