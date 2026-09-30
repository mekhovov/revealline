import { readSourceBytes, sourceURL, loadProductionImage } from '../../production/preview.mjs';

export const RESERVE_MANIFEST = Object.freeze({
  id: 'manifest',
  kind: 'text',
  path: 'authoring/library/reserve-illustrations-catalog/manifest.json',
  bytes: 71251,
  sha256: '2b6f772031c46a6c59784ea2fffdfb5459900d7913503f7415c5da9cc495b9d2',
});
export const RESERVE_README = Object.freeze({
  id: 'readme',
  kind: 'text',
  path: 'authoring/library/reserve-illustrations-catalog/README.md',
  bytes: 4533,
  sha256: '612a70e6246b6f31f161712fdd363fadbb423edd609ab04ca8ec8e1382616685',
});
const rootURL = new URL('../../../', import.meta.url);
export function validateReserveManifest(value) {
  if (
    value?.format !== 'revealline-reserve-catalog.v1' ||
    value.sourceOnly !== true ||
    value.sourceRevision !== '091936e27c3b9f1c061081ca93827014a927d963' ||
    value.selectedWorks !== 40 ||
    value.entries?.length !== 40 ||
    new Set(value.entries.map((entry) => entry.id)).size !== 40
  )
    throw new Error('Invalid reserve catalog');
  const pins = new Map();
  const pin = (file) => {
    if (
      !/^authoring\/library\/reserve-illustrations-wave-(?:[1-9]|10)\/[A-Za-z0-9/_-]+\.(png|txt|json|md)$/.test(
        file?.path,
      ) ||
      file.url !== '../' + file.path.slice('authoring/library/'.length) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > 8 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !/^[a-f0-9]{40}$/.test(file.gitBlob)
    )
      throw new Error('Invalid reserve source');
    const old = pins.get(file.path);
    if (old && JSON.stringify(old) !== JSON.stringify(file))
      throw new Error('Conflicting reserve source');
    pins.set(file.path, file);
    return Object.freeze(file);
  };
  for (const entry of value.entries) {
    if (
      entry.sourceOnly !== true ||
      typeof entry.id !== 'string' ||
      typeof entry.title !== 'string' ||
      !['fpv', 'ukraine', 'retro', 'coupa'].includes(entry.themeId) ||
      !value.themes?.[entry.themeId] ||
      !Number.isInteger(entry.wave) ||
      entry.wave < 1 ||
      entry.wave > 10 ||
      entry.width !== 1774 ||
      entry.height !== 887 ||
      !entry.original?.path.endsWith('.png') ||
      !Array.isArray(entry.prompts) ||
      entry.prompts.length < 1 ||
      entry.prompts.length > 2
    )
      throw new Error('Invalid reserve illustration');
    pin(entry.original);
    for (const source of [...entry.prompts, entry.provenance, entry.notes]) {
      pin(source);
      if (source.path.endsWith('.png') || source.bytes > 256 * 1024)
        throw new Error('Invalid reserve text');
    }
    Object.freeze(entry.prompts);
    Object.freeze(entry);
  }
  Object.freeze(value.entries);
  Object.freeze(value.themes);
  return Object.freeze(value);
}
export async function readReserveManifest({ signal, window: win = globalThis.window } = {}) {
  const file = RESERVE_MANIFEST;
  const bytes = await readSourceBytes(sourceURL(file.path, rootURL), file.bytes, {
    signal,
    fetchSource: (url, options) => win.fetch(url, options),
  });
  const hash = [...new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (signal?.aborted || bytes.length !== file.bytes || hash !== file.sha256)
    throw new Error('Reserve catalog identity mismatch');
  return validateReserveManifest(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
  );
}
export function loadReserveImage(entry, { signal, window: win = globalThis.window } = {}) {
  return loadProductionImage(
    { role: 'original', file: entry.original, width: entry.width, height: entry.height },
    {
      rootURL,
      signal,
      fetchSource: (url, options) => win.fetch(url, options),
      cryptoSource: win.crypto,
      urlAPI: win.URL,
      makeImage: () => win.document.createElement('img'),
    },
  );
}
