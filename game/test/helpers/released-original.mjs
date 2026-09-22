import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CURRENT_PICTURES } from '../../presentation/current-pictures.mjs';

const presentation = JSON.parse(
  await readFile(new URL('../../presentation/compiled/runtime.json', import.meta.url)),
);

// These external-install fixtures assert against the actual published collection,
// independently of the runtime selection code. Non-FPV editions keep their
// descriptor originals; fresh FPV installs select the exact registered override.
export function releasedExternalOriginal(descriptor, index) {
  const original = descriptor.originals[index];
  assert.ok(original, 'The exact descriptor original must exist.');
  if (descriptor.themeId !== 'fpv') return original;
  const slot = CURRENT_PICTURES.find(
    (row) =>
      row.owner.baseCampaignKey === descriptor.campaignKey &&
      row.owner.levelId === original.levelId &&
      row.owner.levelRevision === original.levelRevision &&
      row.owner.themeId === descriptor.themeId,
  );
  assert.ok(slot, 'The exact FPV owner must have a registered picture slot.');
  const asset = presentation.resolved.assets[slot.id];
  assert.equal(asset?.kind, 'image', 'The released collection must bind its exact picture.');
  assert.deepEqual(presentation.resolved.bindings[slot.id], {
    id: asset.id,
    revision: asset.revision,
  });
  return asset.file;
}
