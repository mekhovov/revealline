/** Studio-only format dispatch. The existing v1 APIs remain strict and unchanged. */
import { boundedJSON, required } from '../data-json.mjs';
import {
  FORMATS,
  LIMITS,
  validateThemeBundle,
  resolvePresentation,
  presentationCoverageFromView,
} from './model.mjs';
import { verifyThemeAssets, importThemeBundle, exportThemeBundle } from './bundle.mjs';
import {
  reviseStudioTheme,
  replaceStudioCollection,
  adoptStudioBundle,
} from './studio-session.mjs';
import { createStudioStore } from './studio-store.mjs';
import {
  REFERENCE_FORMAT,
  validateReferencedBundle,
  resolveReferencedPresentation,
  openReferencedAssets,
  migrateThemeReferences,
  checkReferenceAbort,
  referenceKey,
} from './reference-model.mjs';
import {
  verifyReferencedAssets,
  importReferencedBundle,
  exportReferencedBundle,
} from './reference-bundle.mjs';
import {
  reviseReferencedTheme,
  replaceReferencedCollection,
  adoptReferencedBundle,
} from './reference-session.mjs';
import { createReferencedStudioStore } from './reference-store.mjs';

function isReference(document) {
  const format =
    document && typeof document === 'object' && Object.getOwnPropertyDescriptor(document, 'format');
  required(
    format &&
      Object.hasOwn(format, 'value') &&
      [FORMATS.bundle, REFERENCE_FORMAT].includes(format.value),
    'Unsupported Studio workspace format.',
  );
  return format.value === REFERENCE_FORMAT;
}
export async function validateStudioDocument(source, options = {}) {
  const document = boundedJSON(source, {
    maxBytes: LIMITS.manifestBytes,
    maxNodes: 100000,
    maxArray: 2048,
    maxDepth: 18,
    maxString: 8192,
  });
  checkReferenceAbort(options.signal);
  return isReference(document)
    ? validateReferencedBundle(document, options)
    : validateThemeBundle(document, options);
}
export function verifyStudioAssets(document, assets, options = {}) {
  return (isReference(document) ? verifyReferencedAssets : verifyThemeAssets)(
    document,
    assets,
    options,
  );
}
/** A view and history reader belong to the same immutable encoded draft. */
export async function prepareStudioSnapshot(source, sourceAssets, { signal } = {}) {
  const document = await validateStudioDocument(source, { signal });
  const referenced = isReference(document);
  const view = referenced
    ? await resolveReferencedPresentation(document, { signal })
    : resolvePresentation(document);
  const reader = referenced ? await openReferencedAssets(document, { signal }) : null;
  const history = reader ? null : new Map(document.assets.map((row) => [referenceKey(row), row]));
  checkReferenceAbort(signal);
  return Object.freeze({
    document,
    assets: new Map(sourceAssets),
    view,
    coverage: presentationCoverageFromView(document.slots, view),
    asset(target) {
      const value = reader ? reader.get(target) : history.get(referenceKey(target));
      required(value, 'Missing asset revision.');
      return value;
    },
  });
}
export function reviseStudioDocument(document, change) {
  return (isReference(document) ? reviseReferencedTheme : reviseStudioTheme)(document, change);
}
export function replaceStudioDocumentCollection(document, change) {
  return (isReference(document) ? replaceReferencedCollection : replaceStudioCollection)(
    document,
    change,
  );
}
export async function selectStudioTheme(document, id) {
  const previous = await validateStudioDocument(document);
  const next = structuredClone(previous);
  const theme = next.themes.filter((row) => row.id === id).at(-1);
  required(theme, 'Missing selected theme.');
  next.selection.theme = { id: theme.id, revision: theme.revision };
  next.selection.collection = null;
  next.revision++;
  return validateStudioDocument(next, { previous, expectedRevision: previous.revision });
}
export async function upgradeStudioDocument(document, assets, options = {}) {
  required(!isReference(document), 'This workspace already uses v2 references.');
  const verified = await verifyThemeAssets(document, assets, options);
  const next = await migrateThemeReferences(document, options);
  return prepareStudioSnapshot(next, verified, options);
}
export async function adoptStudioDocument(document, incoming) {
  if (!isReference(document)) {
    required(
      !isReference(incoming),
      'This collection uses v2 references. Export a backup and explicitly Upgrade workspace before importing it.',
    );
    return adoptStudioBundle(document, incoming);
  }
  // Only the incoming reader changes: the existing workspace never upgrades implicitly.
  const foreign = isReference(incoming) ? incoming : await migrateThemeReferences(incoming);
  return adoptReferencedBundle(document, foreign);
}
export function exportStudioBundle(document, assets, options = {}) {
  return (isReference(document) ? exportReferencedBundle : exportThemeBundle)(
    document,
    assets,
    options,
  );
}
export async function importStudioBundle(source, options = {}) {
  checkReferenceAbort(options.signal);
  const size = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(source);
  required(size >= 12 && size <= LIMITS.bundleBytes, 'File exceeds its byte budget.');
  const header = new TextDecoder().decode(
    await Blob.prototype.slice.call(source, 0, 8).arrayBuffer(),
  );
  checkReferenceAbort(options.signal);
  required(header === 'RLTHM1\r\n' || header === 'RLTHM2\r\n', 'Unsupported Studio theme bundle.');
  return (header === 'RLTHM2\r\n' ? importReferencedBundle : importThemeBundle)(source, options);
}
export function createFormatStudioStore(options = {}) {
  const legacy = createStudioStore(options),
    reference = createReferencedStudioStore(options);
  return Object.freeze({
    load: reference.load,
    save(document, assets, settings = {}) {
      return (isReference(document) ? reference : legacy).save(document, assets, settings);
    },
    async close() {
      await Promise.all([legacy.close(), reference.close()]);
    },
  });
}
