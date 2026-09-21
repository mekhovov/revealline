import { canonicalJSON, exactKeys, required } from '../game/data-json.mjs';
import {
  validateAssetSlotSpec,
  validateThemeBundle,
  resolvePresentation,
} from '../game/presentation/model.mjs';
import { reviseStudioTheme } from '../game/presentation/studio-session.mjs';

const ref = (value) => ({ id: value.id, revision: value.revision });
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const content = (asset) => {
  const copy = structuredClone(asset);
  delete copy.revision;
  delete copy.quality;
  delete copy.provenance.parent;
  return copy;
};

/** Reproduction keeps the accepted ledger. A changed file, geometry or brief
 * creates a successor; a quality review is itself an immutable new revision. */
export function retainProductionHistory(desiredSource, priorSource = null, options = {}) {
  exactKeys(options, ['appendSlots'], 'production slot migration');
  const requested = options.appendSlots === undefined ? [] : options.appendSlots;
  required(Array.isArray(requested), 'Production appendSlots must be an array.');
  const contracts = requested.map(validateAssetSlotSpec);
  const migrationError =
    'Production slot contracts changed; provide an explicit compatible migration.';
  required(
    new Set(contracts.map((slot) => slot.id)).size === contracts.length &&
      contracts.every((slot) => !slot.required && slot.revision === 1),
    migrationError,
  );
  const desired = validateThemeBundle(desiredSource);
  required(
    contracts.every((slot) =>
      same(
        slot,
        desired.slots.find((entry) => entry.id === slot.id),
      ),
    ),
    migrationError,
  );
  const wanted = resolvePresentation(desired);
  required(
    contracts.every((slot) => wanted.assets[slot.id]),
    'Every appended slot needs a bound production asset.',
  );
  if (!priorSource) return desired;
  const prior = validateThemeBundle(priorSource);
  const additions = desired.slots.slice(prior.slots.length);
  if (
    prior.id !== desired.id ||
    prior.selection.theme.id !== desired.selection.theme.id ||
    !same(prior.slots, desired.slots.slice(0, prior.slots.length)) ||
    additions.some((slot) => !contracts.some((contract) => same(contract, slot)))
  )
    throw new Error(migrationError);
  const previous = resolvePresentation(prior);
  const assets = [],
    bindings = {};
  for (const [slotId, proposed] of Object.entries(wanted.assets)) {
    const before = previous.assets[slotId];
    const unchanged = before && same(content(before), content(proposed));
    const reviewed = proposed.quality.stage === 'reviewed';
    if (unchanged && (!reviewed || same(before.quality, proposed.quality))) continue;
    // Reusing an existing matching revision is safe (for example an explicit
    // reset). New metadata never replaces an existing id/revision pair.
    const reusable = [...prior.assets, ...assets]
      .sort((a, b) => b.revision - a.revision)
      .find(
        (asset) =>
          same(content(asset), content(proposed)) &&
          (!reviewed || same(asset.quality, proposed.quality)),
      );
    if (reusable) {
      bindings[slotId] = ref(reusable);
      continue;
    }
    const history = [...prior.assets, ...assets].filter((asset) => asset.id === proposed.id);
    const last = history.sort((a, b) => b.revision - a.revision)[0];
    const asset = {
      ...structuredClone(proposed),
      revision: (last?.revision ?? 0) + 1,
      provenance: {
        ...structuredClone(proposed.provenance),
        parent: last ? ref(last) : structuredClone(proposed.provenance.parent),
      },
    };
    assets.push(asset);
    bindings[slotId] = ref(asset);
  }
  const tokens = Object.fromEntries(
    Object.entries(wanted.tokens).filter(([key, value]) => !same(value, previous.tokens[key])),
  );
  if (
    !additions.length &&
    !assets.length &&
    !Object.keys(bindings).length &&
    !Object.keys(tokens).length
  )
    return prior;
  // New optional contracts cannot invalidate retained selections. Keep the
  // original ledger intact and advance it once with the actual asset changes.
  const extended = structuredClone(prior);
  extended.slots.push(...structuredClone(additions));
  const next = reviseStudioTheme(extended, { assets, bindings, tokens });
  return validateThemeBundle(next, { previous: prior, expectedRevision: prior.revision });
}
