import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import {
  freezePresentation,
  resolvePresentation,
  validateThemeBundle,
} from '../game/presentation/model.mjs';
import { reviseStudioTheme } from '../game/presentation/studio-session.mjs';
import { retainProductionHistory } from './presentation-production-history.mjs';

const hash = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const contract = JSON.parse(
  readFileSync(new URL('./picture-production-migration.json', import.meta.url), 'utf8'),
);
if (hash(contract) !== '3aac241e0ebebcd9220c6d3de0d4dcb4bc31c14ea7d5c9196ec549a1284e6fea')
  throw new Error(
    'Picture migration contract changed; an explicit migration revision is required.',
  );
export const PICTURE_PRODUCTION_MIGRATION = freezePresentation(contract);
const { baseline, additions } = PICTURE_PRODUCTION_MIGRATION;
const fail = (detail) => {
  throw new Error(`Picture production migration: ${detail}`);
};

/** Exact candidate-only continuation of the published 335-slot production104.
 * This is not a general picture wildcard or an artwork approval. The separate
 * generic and historical Team writers remain strict and unchanged. */
export function retainPictureProductionHistory(desiredSource, priorSource) {
  if (!priorSource) fail('the pinned published predecessor is required.');
  const prior = validateThemeBundle(priorSource),
    desired = validateThemeBundle(desiredSource),
    count = baseline.slots.count + additions.count;
  if (
    prior.id !== baseline.id ||
    desired.id !== baseline.id ||
    prior.revision < baseline.revision ||
    !same(prior.selection.base, baseline.selection.base) ||
    !same(desired.selection.base, baseline.selection.base) ||
    prior.selection.theme.id !== baseline.selection.theme.id ||
    desired.selection.theme.id !== baseline.selection.theme.id ||
    prior.selection.collection !== null ||
    desired.selection.collection !== null
  )
    fail('only the pinned Field Kit production lineage is supported.');
  // Complete history prefixes bind the immutable approval/evidence records, not
  // only the selected artwork. A relabelled old asset cannot be a new baseline.
  for (const key of ['slots', 'assets', 'themes', 'collections']) {
    const pin = baseline[key];
    if (prior[key].length < pin.count || hash(prior[key].slice(0, pin.count)) !== pin.sha256)
      fail(`the published ${key} prefix changed.`);
  }
  const installing = prior.slots.length === baseline.slots.count;
  if (installing ? hash(prior) !== baseline.documentSha256 : prior.slots.length !== count)
    fail('the predecessor is neither exact production104 nor its admitted picture successor.');
  if (!installing && prior.revision <= baseline.revision)
    fail('an installed successor must advance the published revision.');
  if (desired.slots.length !== count) fail('install all 54 pinned picture slots atomically.');

  const wanted = new Map(desired.slots.map((slot) => [slot.id, slot])),
    defaults = createDefaultThemeBundle(),
    defaultAssets = new Map(defaults.assets.map((asset) => [asset.id, asset])),
    added = [],
    originals = [];
  for (const slot of prior.slots.slice(0, baseline.slots.count))
    if (!wanted.has(slot.id) || !same(slot, wanted.get(slot.id)))
      fail(`existing slot ${slot.id} changed or disappeared.`);
  for (const pin of additions.slots) {
    const slot = wanted.get(pin.id),
      original = defaultAssets.get(`${pin.id}.default`);
    if (!slot || hash(slot) !== pin.sha256 || !same(slot.owner, pin.owner))
      fail(`unapproved picture definition or owner: ${pin.id}.`);
    if (
      !original ||
      hash(original) !== pin.defaultAssetSha256 ||
      original.quality.stage !== 'source'
    )
      fail(`the source-only default changed: ${pin.id}.`);
    added.push(slot);
    originals.push(original);
  }
  if (hash(added) !== additions.sha256 || hash(originals) !== additions.defaultsSha256)
    fail('the additive picture contract changed.');
  if (!installing && !same(prior.slots.slice(baseline.slots.count), added))
    fail('the installed picture contract changed.');
  const resolved = resolvePresentation(desired);
  for (const slot of added) {
    const proposed = resolved.assets[slot.id];
    if (!proposed) fail(`the candidate must explicitly bind ${slot.id}.`);
    if (proposed.quality.stage === 'reviewed')
      fail(`this slot migration cannot approve new picture artwork: ${slot.id}.`);
  }

  const upgraded = structuredClone(prior);
  if (installing) {
    upgraded.slots.push(...structuredClone(added));
  }
  for (const original of originals) {
    const recorded = upgraded.assets.find(
      (asset) => asset.id === original.id && asset.revision === original.revision,
    );
    if ((!recorded && !installing) || (recorded && !same(recorded, original)))
      fail(`default revision conflict: ${original.id}.`);
    if (!recorded) upgraded.assets.push(structuredClone(original));
  }
  validateThemeBundle(upgraded);
  // Preserve the published sequence even when today's catalogue interleaves its
  // additions. Adoption creates one successor, never an intermediate release.
  let next = retainProductionHistory({ ...desired, slots: upgraded.slots }, upgraded);
  if (installing && next.revision === prior.revision)
    next = reviseStudioTheme(upgraded, {
      bindings: Object.fromEntries(added.map((slot) => [slot.id, resolved.bindings[slot.id]])),
    });
  const accepted = resolvePresentation(next);
  if (added.some((slot) => accepted.assets[slot.id]?.quality.stage === 'reviewed'))
    fail('candidate picture bindings cannot inherit an unapproved reviewed status.');
  if (next.revision === prior.revision) return prior;
  return validateThemeBundle(next, { previous: prior, expectedRevision: prior.revision });
}
