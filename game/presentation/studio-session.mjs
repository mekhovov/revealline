import { FORMATS, validateThemeBundle, resolvePresentation } from './model.mjs';
import { canonicalJSON } from '../data-json.mjs';

const reference = (record) => ({ id: record.id, revision: record.revision });
const same = (a, b) => a.id === b.id && a.revision === b.revision;
export function nextAssetRevision(document, slotId) {
  const id = `${slotId}.custom`;
  return {
    id,
    revision:
      Math.max(
        0,
        ...document.assets.filter((asset) => asset.id === id).map((asset) => asset.revision),
      ) + 1,
  };
}
/** Append immutable records; historical files remain referenced in the bundle. */
export function reviseStudioTheme(source, { assets = [], bindings = {}, tokens = {} } = {}) {
  const previous = validateThemeBundle(source);
  const next = structuredClone(previous);
  const current = next.themes.find((theme) => same(theme, next.selection.theme));
  const collection =
    next.selection.collection &&
    next.collections.find((item) => same(item, next.selection.collection));
  next.assets.push(...structuredClone(assets));
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(
        ...next.themes.filter((item) => item.id === current.id).map((item) => item.revision),
      ) + 1,
    parent: reference(current),
    tokens: { ...tokens },
    bindings: { ...collection?.bindings, ...bindings },
  };
  next.themes.push(theme);
  next.selection.theme = reference(theme);
  next.selection.collection = null;
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
/** A whole collection is checked before it becomes the selected presentation. */
export function replaceStudioCollection(
  source,
  { id, name, requiredSlots, bindings, assets = [] },
) {
  const previous = validateThemeBundle(source);
  const next = structuredClone(previous);
  const collection = {
    format: FORMATS.collection,
    id,
    name,
    revision:
      Math.max(
        0,
        ...next.collections.filter((item) => item.id === id).map((item) => item.revision),
      ) + 1,
    themeId: next.selection.theme.id,
    requiredSlots,
    bindings,
  };
  next.assets.push(...structuredClone(assets));
  next.collections.push(collection);
  next.selection.collection = reference(collection);
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
/** Identical immutable revisions are shared; conflicting/new IDs are namespaced.
 * Neither imported nor current history is rewritten.
 * The caller retains the old byte table and merges the verified imported bytes. */
export function adoptStudioBundle(source, incomingSource) {
  const previous = validateThemeBundle(source);
  const incoming = validateThemeBundle(incomingSource);
  const presentation = resolvePresentation(incoming);
  const next = structuredClone(previous);
  const used = new Set([...next.assets, ...next.collections].map((record) => record.id));
  const prefix = `import-${next.revision + 1}`;
  let namespace = prefix;
  for (
    let suffix = 1;
    [...used].some((id) => id === namespace || id.startsWith(namespace + '-'));
    suffix++
  )
    namespace = `${prefix}-${suffix}`;
  const key = (asset) => `${asset.id}@${asset.revision}`;
  const imports = new Map();
  const local = new Map(previous.assets.map((asset) => [key(asset), asset]));
  const foreign = new Map(incoming.assets.map((asset, index) => [key(asset), { asset, index }]));
  const adopt = (target) => {
    const identity = key(target);
    if (imports.has(identity)) return imports.get(identity);
    const { asset, index } = foreign.get(identity);
    const candidate = structuredClone(asset);
    // Resolve parents first: an otherwise identical child cannot retain a local
    // parent when the imported revision of that parent has different content.
    candidate.provenance.parent = asset.provenance.parent ? adopt(asset.provenance.parent) : null;
    const existing = local.get(identity);
    let result;
    if (existing && canonicalJSON(existing) === canonicalJSON(candidate)) {
      result = reference(existing);
    } else {
      result = { id: `${namespace}-${index}`, revision: 1 };
      next.assets.push({ ...candidate, ...result });
    }
    imports.set(identity, result);
    return result;
  };
  for (const asset of incoming.assets) adopt(asset);
  const current = next.themes.find((theme) => same(theme, next.selection.theme));
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(
        ...next.themes.filter((item) => item.id === current.id).map((item) => item.revision),
      ) + 1,
    tokens: { ...presentation.tokens },
  };
  next.themes.push(theme);
  next.selection.theme = reference(theme);
  const collection = {
    format: FORMATS.collection,
    id: namespace,
    revision: 1,
    name: presentation.theme.name,
    themeId: theme.id,
    requiredSlots: next.slots.filter((slot) => slot.required).map((slot) => slot.id),
    bindings: Object.fromEntries(
      Object.entries(presentation.bindings).map(([id, target]) => [
        id,
        imports.get(`${target.id}@${target.revision}`),
      ]),
    ),
  };
  next.collections.push(collection);
  next.selection.collection = reference(collection);
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
export function generateAssetPrompt(slot, resolved, action = 'variation') {
  const asset = resolved.assets[slot.id];
  const intent =
    action === 'edit'
      ? 'Edit the attached current asset. Preserve its approved silhouette and locked geometry.'
      : action === 'collection'
        ? 'Replace this asset as part of one coherent collection. Match all related slots; do not alter their identities or mechanics.'
        : 'Create a new original variation of this asset.';
  return `${intent}\n\n${slot.prompt}\n\nTHEME: ${resolved.theme.name}\nSLOT: ${slot.id}\nUSED ON: ${slot.screens.join(', ')}\nSTATES: ${slot.states.join(', ')}\nDIMENSIONS: ${slot.dimensions ? `${slot.dimensions.width}×${slot.dimensions.height}` : 'Registered scalable/procedural recipe'}\nTRANSPARENCY: ${slot.alpha}\nPIXEL SAMPLING: ${slot.sampling}\nRESOLVED TOKENS:\n${JSON.stringify(resolved.tokens, null, 2)}\n\nREQUIREMENTS:\n${slot.requirements.map((line) => `- ${line}`).join('\n')}\n\nCURRENT REVISION: ${asset.id}@${asset.revision}\nCURRENT FILE AND LOCKED GEOMETRY (takes precedence over baseline geometry for edits):\n${JSON.stringify({ file: asset.file, geometry: asset.geometry }, null, 2)}\n\nCURRENT PRODUCTION BRIEF (reference context, subject to the slot requirements above):\n${asset.provenance.prompt}\n\nBASELINE SLOT CONTRACT:\n${JSON.stringify(slot, null, 2)}\n\nReturn the unmodified source and a separate prepared ${slot.id.replaceAll('.', '-')}.png (or the declared font/audio format), complete prompt, creator/license, and validation evidence. Do not bake words, telemetry, collision geometry, propeller motion or reference-game artwork into the image. Verify dimensions, alpha, occupied bounds, anchors, byte budget, native-size readability and every affected screen. A candidate is not an approved release.`;
}
