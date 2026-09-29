import { canonicalJSON } from '../data-json.mjs';
import {
  validateReferencedBundle,
  resolveReferencedPresentation,
  openReferencedAssets,
  encodeReferencedRevision,
  referenceOf as ref,
  referenceKey as key,
} from './reference-model.mjs';

/** Explicit v2 operation; v1 session functions retain their original contracts. */
export async function reviseReferencedTheme(
  source,
  { assets = [], bindings = {}, tokens = {} } = {},
) {
  const previous = await validateReferencedBundle(source),
    next = structuredClone(previous);
  const current = next.themes.find((row) => key(row) === key(next.selection.theme));
  const collection =
    next.selection.collection &&
    next.collections.find((row) => key(row) === key(next.selection.collection));
  for (const asset of assets) next.assets.push(await encodeReferencedRevision(next, asset));
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(...next.themes.filter((row) => row.id === current.id).map((row) => row.revision)) +
      1,
    parent: ref(current),
    tokens: { ...tokens },
    bindings: { ...collection?.bindings, ...bindings },
  };
  next.themes.push(theme);
  next.selection.theme = ref(theme);
  next.selection.collection = null;
  next.revision++;
  return validateReferencedBundle(next, { previous, expectedRevision: previous.revision });
}
const content = (asset) => {
  const copy = structuredClone(asset);
  delete copy.revision;
  delete copy.quality;
  delete copy.provenance.parent;
  return canonicalJSON(copy);
};
/** Append and validate the complete collection before changing its selection. */
export async function replaceReferencedCollection(
  source,
  { id, name, requiredSlots, bindings, assets = [] },
) {
  const previous = await validateReferencedBundle(source),
    next = structuredClone(previous);
  for (const asset of assets) next.assets.push(await encodeReferencedRevision(next, asset));
  const collection = {
    format: 'revealline-asset-collection.v1',
    id,
    name,
    revision:
      Math.max(0, ...next.collections.filter((row) => row.id === id).map((row) => row.revision)) +
      1,
    themeId: next.selection.theme.id,
    requiredSlots,
    bindings,
  };
  next.collections.push(collection);
  next.selection.collection = ref(collection);
  next.revision++;
  return validateReferencedBundle(next, { previous, expectedRevision: previous.revision });
}
/** Same production succession semantics, with new revisions encoded explicitly. */
export async function retainReferencedProductionHistory(desiredSource, priorSource) {
  const desired = await validateReferencedBundle(desiredSource),
    prior = await validateReferencedBundle(priorSource);
  if (
    prior.id !== desired.id ||
    prior.selection.theme.id !== desired.selection.theme.id ||
    canonicalJSON(prior.slots) !== canonicalJSON(desired.slots)
  )
    throw new Error('Production slot contracts changed; provide an explicit compatible migration.');
  const wanted = await resolveReferencedPresentation(desired),
    previous = await resolveReferencedPresentation(prior);
  const reader = await openReferencedAssets(prior),
    reusable = new Map(),
    newest = new Map();
  for (const encoded of prior.assets) {
    const asset = reader.get(encoded),
      identity = content(asset);
    if (!reusable.has(identity)) reusable.set(identity, []);
    reusable.get(identity).push({ reference: ref(asset), quality: canonicalJSON(asset.quality) });
    if (!newest.has(asset.id) || newest.get(asset.id).revision < asset.revision)
      newest.set(asset.id, ref(asset));
  }
  const assets = [],
    bindings = {};
  for (const [slot, proposed] of Object.entries(wanted.assets)) {
    const before = previous.assets[slot],
      identity = content(proposed),
      reviewed = proposed.quality.stage === 'reviewed';
    if (
      before &&
      content(before) === identity &&
      (!reviewed || canonicalJSON(before.quality) === canonicalJSON(proposed.quality))
    )
      continue;
    const match = (reusable.get(identity) ?? [])
      .filter((row) => !reviewed || row.quality === canonicalJSON(proposed.quality))
      .sort((a, b) => b.reference.revision - a.reference.revision)[0];
    if (match) {
      bindings[slot] = match.reference;
      continue;
    }
    const last = newest.get(proposed.id),
      asset = {
        ...structuredClone(proposed),
        revision: (last?.revision ?? 0) + 1,
        provenance: {
          ...structuredClone(proposed.provenance),
          parent: last ?? structuredClone(proposed.provenance.parent),
        },
      };
    assets.push(asset);
    bindings[slot] = ref(asset);
    newest.set(asset.id, ref(asset));
    if (!reusable.has(identity)) reusable.set(identity, []);
    reusable.get(identity).push({ reference: ref(asset), quality: canonicalJSON(asset.quality) });
  }
  const tokens = Object.fromEntries(
    Object.entries(wanted.tokens).filter(
      ([name, value]) => canonicalJSON(value) !== canonicalJSON(previous.tokens[name]),
    ),
  );
  if (!assets.length && !Object.keys(bindings).length && !Object.keys(tokens).length) return prior;
  return reviseReferencedTheme(prior, { assets, bindings, tokens });
}

/** Resolve foreign content and derivative ancestry before local dedup/remapping. */
export async function adoptReferencedBundle(source, incomingSource) {
  const localReader = await openReferencedAssets(source),
    foreignReader = await openReferencedAssets(incomingSource);
  const previous = localReader.document,
    incoming = foreignReader.document;
  const presentation = await resolveReferencedPresentation(incoming),
    next = structuredClone(previous);
  const used = new Set([...next.assets, ...next.collections].map((row) => row.id));
  const prefix = `import-${next.revision + 1}`;
  let namespace = prefix;
  for (
    let suffix = 1;
    [...used].some((id) => id === namespace || id.startsWith(namespace + '-'));
    suffix++
  )
    namespace = `${prefix}-${suffix}`;
  const imports = new Map(),
    local = new Map(previous.assets.map((row) => [key(row), row]));
  const foreign = new Map(incoming.assets.map((row, index) => [key(row), { row, index }]));
  const adopt = async (target) => {
    const identity = key(target);
    if (imports.has(identity)) return imports.get(identity);
    const { row, index } = foreign.get(identity),
      candidate = structuredClone(foreignReader.get(row));
    candidate.provenance.parent = candidate.provenance.parent
      ? await adopt(candidate.provenance.parent)
      : null;
    const existing = local.get(identity);
    let result;
    if (existing && canonicalJSON(localReader.get(existing)) === canonicalJSON(candidate))
      result = ref(existing);
    else {
      result = { id: `${namespace}-${index}`, revision: 1 };
      next.assets.push(await encodeReferencedRevision(next, { ...candidate, ...result }));
    }
    imports.set(identity, result);
    return result;
  };
  for (const row of incoming.assets) await adopt(row);
  const current = next.themes.find((row) => key(row) === key(next.selection.theme));
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(...next.themes.filter((row) => row.id === current.id).map((row) => row.revision)) +
      1,
    tokens: { ...presentation.tokens },
  };
  next.themes.push(theme);
  next.selection.theme = ref(theme);
  const collection = {
    format: 'revealline-asset-collection.v1',
    id: namespace,
    revision: 1,
    name: presentation.theme.name,
    themeId: theme.id,
    requiredSlots: next.slots.filter((slot) => slot.required).map((slot) => slot.id),
    bindings: Object.fromEntries(
      Object.entries(presentation.bindings).map(([id, target]) => [id, imports.get(key(target))]),
    ),
  };
  next.collections.push(collection);
  next.selection.collection = ref(collection);
  next.revision++;
  return validateReferencedBundle(next, { previous, expectedRevision: previous.revision });
}
