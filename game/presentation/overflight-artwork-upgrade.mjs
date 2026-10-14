import { canonicalJSON, required } from '../data-json.mjs';
import { createDefaultThemeBundle } from './catalog.mjs';
import { validateThemeBundle } from './model.mjs';
import { addPresentationSlots, needsPresentationSlots } from './team-anchor-upgrade.mjs';
import { OVERFLIGHT_WORLD_IMAGE_SLOTS } from './overflight-world-slots.mjs';
import { OVERFLIGHT_ACTOR_SLOT_IDS } from './overflight-actor-slots.mjs';

export const OVERFLIGHT_ARTWORK_SLOTS = Object.freeze([
  ...OVERFLIGHT_WORLD_IMAGE_SLOTS,
  ...OVERFLIGHT_ACTOR_SLOT_IDS,
]);
let defaults;
function registered() {
  if (!defaults) {
    const bundle = createDefaultThemeBundle();
    defaults = {
      slots: new Map(bundle.slots.map((slot) => [slot.id, slot])),
      assets: new Map(bundle.assets.map((asset) => [asset.id, asset])),
    };
  }
  return defaults;
}

export const needsOverflightArtworkSlots = (source) =>
  needsPresentationSlots(source, OVERFLIGHT_ARTWORK_SLOTS);

/** An explicit append-only draft revision. Preserve selected custom images,
 * sprite clips, collection bindings and every previous source revision. */
export function addOverflightArtworkSlots(source) {
  const previous = validateThemeBundle(source);
  const contracts = registered().slots;
  for (const id of OVERFLIGHT_ARTWORK_SLOTS) {
    const contract = contracts.get(id);
    const existing = previous.slots.find((slot) => slot.id === id);
    required(contract, `FPV Survivals artwork contract is unavailable: ${id}.`);
    required(
      !existing || canonicalJSON(existing) === canonicalJSON(contract),
      `Unsupported FPV Survivals artwork contract: ${id}.`,
    );
  }
  return addPresentationSlots(previous, OVERFLIGHT_ARTWORK_SLOTS, 'FPV Survivals artwork');
}

/** Token-only theme assignments may ignore newly admitted unchanged native
 * fallbacks. Edited images and recipes still need the full runtime-art path. */
export function isNativeOverflightArtworkFallback(slot, asset) {
  if (!slot || !asset || !OVERFLIGHT_ARTWORK_SLOTS.includes(slot.id)) return false;
  const contract = registered().slots.get(slot.id);
  const original = registered().assets.get(`${slot.id}.default`);
  if (canonicalJSON(slot) !== canonicalJSON(contract) || asset.kind !== 'recipe') return false;
  const content = ({ id: _id, revision: _revision, ...value }) => value;
  return canonicalJSON(content(asset)) === canonicalJSON(content(original));
}
