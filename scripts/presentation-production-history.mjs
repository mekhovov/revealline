import { canonicalJSON } from '../game/data-json.mjs';
import { validateThemeBundle, resolvePresentation } from '../game/presentation/model.mjs';
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
export function retainProductionHistory(desiredSource, priorSource = null) {
  const desired = validateThemeBundle(desiredSource);
  if (!priorSource) return desired;
  const prior = validateThemeBundle(priorSource);
  if (
    prior.id !== desired.id ||
    prior.selection.theme.id !== desired.selection.theme.id ||
    !same(prior.slots, desired.slots)
  )
    throw new Error('Production slot contracts changed; provide an explicit compatible migration.');
  const wanted = resolvePresentation(desired),
    previous = resolvePresentation(prior);
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
  if (!assets.length && !Object.keys(bindings).length && !Object.keys(tokens).length) return prior;
  return reviseStudioTheme(prior, { assets, bindings, tokens });
}
