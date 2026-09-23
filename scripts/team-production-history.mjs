import { canonicalJSON } from '../game/data-json.mjs';
import { validateThemeBundle } from '../game/presentation/model.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { TEAM_RUNTIME_IMAGE_SLOTS } from '../game/presentation/team-runtime-slots.mjs';
import { retainProductionHistory } from './presentation-production-history.mjs';

/** Explicit additive Team migration for the production builder. The generic
 * history writer remains strict: no arbitrary slot changes become admissible. */
export function retainFieldKitProductionHistory(desiredSource, priorSource = null) {
  const desired = validateThemeBundle(desiredSource);
  if (!priorSource) return retainProductionHistory(desired);
  const prior = validateThemeBundle(priorSource);
  if (canonicalJSON(prior.slots) === canonicalJSON(desired.slots))
    return retainProductionHistory(desired, prior);
  const defaults = createDefaultThemeBundle();
  if (TEAM_RUNTIME_IMAGE_SLOTS.length !== 42)
    throw new Error('A new Team role set requires an explicit production migration revision.');
  const approved = new Map(
    defaults.slots
      .filter((slot) => TEAM_RUNTIME_IMAGE_SLOTS.includes(slot.id))
      .map((slot) => [slot.id, slot]),
  );
  const old = new Map(prior.slots.map((slot) => [slot.id, slot]));
  const wanted = new Map(desired.slots.map((slot) => [slot.id, slot]));
  const fail = () => {
    throw new Error(
      'Team production migration permits only the exact additive Team slot contract.',
    );
  };
  for (const [id, slot] of old)
    if (!wanted.has(id) || canonicalJSON(wanted.get(id)) !== canonicalJSON(slot)) fail();
  const added = desired.slots.filter((slot) => !old.has(slot.id));
  for (const slot of added)
    if (!approved.has(slot.id) || canonicalJSON(approved.get(slot.id)) !== canonicalJSON(slot))
      fail();
  // Every published Team role must be present; this migration is atomic.
  for (const id of approved.keys()) if (!wanted.has(id)) fail();
  const upgraded = structuredClone(prior);
  for (const slot of added) {
    upgraded.slots.push(structuredClone(slot));
    const original = defaults.assets.find((asset) => asset.id === `${slot.id}.default`);
    const recorded = upgraded.assets.find(
      (asset) => asset.id === original.id && asset.revision === original.revision,
    );
    if (recorded && canonicalJSON(recorded) !== canonicalJSON(original)) fail();
    if (!recorded) upgraded.assets.push(structuredClone(original));
  }
  validateThemeBundle(upgraded);
  if (upgraded.slots.length !== desired.slots.length) fail();
  // Preserve the historical slot sequence and append new contracts. Later
  // reproduction may normalize only this equivalent, already validated order.
  const aligned = { ...desired, slots: upgraded.slots };
  const next = retainProductionHistory(aligned, upgraded);
  // Slot installation and production bindings are one adopted document change.
  // Do not create an intermediate theme revision just to install defaults.
  return added.length
    ? validateThemeBundle(next, { previous: prior, expectedRevision: prior.revision })
    : next;
}
