import {
  readSourceBytes,
  loadProductionImage,
  sourceURL,
} from '../../../../production/preview.mjs';
import { PREPARED_REVEAL_MANIFEST } from './review-sources.mjs';

export function revealReviewURLs(asset, pageURL = import.meta.url) {
  if (!/^[a-f0-9]{64}$/.test(asset?.file?.sha256) || asset.file.mime !== 'image/png')
    throw new Error('Invalid prepared reveal image reference.');
  const page = new URL(pageURL),
    local = ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname);
  const filename = asset.file.path.split('/').at(-1);
  if (!/^[a-z0-9-]+\.png$/.test(filename)) throw new Error('Invalid prepared reveal filename.');
  const source = asset.provenance?.source?.path;
  return {
    compiled: new URL(
      '../../../../../game/presentation/compiled/assets/' + asset.file.sha256 + '.png',
      page,
    ).href,
    sourceDerivative: local ? new URL('./' + filename, page).href : null,
    sourceOriginal:
      local &&
      /^authoring\/library\/fpv-field-kit\/originals\/reveals\/[a-z0-9-]+\.png$/.test(source ?? '')
        ? new URL('../../../../../' + source, page).href
        : null,
  };
}

export const PREPARED_REVEAL_MANIFEST_BYTES = 266665;
const ROOT_URL = new URL('../../../../../', import.meta.url);
export async function readPreparedRevealText({
  signal,
  window: win = globalThis.window,
  rootURL = ROOT_URL,
} = {}) {
  const pin = PREPARED_REVEAL_MANIFEST;
  if (pin.bytes !== PREPARED_REVEAL_MANIFEST_BYTES)
    throw new Error('Historical manifest size mismatch');
  const bytes = await readSourceBytes(
    sourceURL(pin.path, rootURL),
    PREPARED_REVEAL_MANIFEST_BYTES,
    {
      signal,
      fetchSource: (url, options) => win.fetch(url, options),
    },
  );
  const hash = [...new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (signal?.aborted || bytes.length !== pin.bytes || hash !== pin.sha256)
    throw new Error('Historical manifest identity mismatch');
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
export function validatePreparedRevealManifest(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (
    !data ||
    !Array.isArray(data.assets) ||
    data.assets.length !== 44 ||
    data.produced?.compositions !== 38 ||
    data.produced.exports !== 44 ||
    data.produced.owners !== 56 ||
    data.produced.totalPNGBytes !== 2083975 ||
    data.missingCompositions?.length !== 0
  )
    throw new Error('Historical prepared inventory mismatch');
  const ids = new Set(),
    owners = new Set(),
    compositions = new Set();
  let bytes = 0;
  for (const asset of data.assets) {
    const f = asset.file,
      s = asset.provenance?.source;
    if (
      !/^[a-z0-9-]+$/.test(asset.id) ||
      ids.has(asset.id) ||
      f?.path !== `authoring/library/fpv-field-kit/prepared/reveals/${asset.id}.png` ||
      f.mime !== 'image/png' ||
      !Number.isSafeInteger(f.bytes) ||
      f.bytes < 1 ||
      f.bytes > 8 * 1024 * 1024 ||
      !Number.isSafeInteger(f.width) ||
      f.width < 1 ||
      f.width > 4096 ||
      !Number.isSafeInteger(f.height) ||
      f.height < 1 ||
      f.height > 4096 ||
      f.width * f.height > 8 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !/^authoring\/library\/fpv-field-kit\/originals\/reveals\/[a-z0-9-]+\.png$/.test(
        s?.path ?? '',
      ) ||
      !/^[a-f0-9]{64}$/.test(s.sha256) ||
      !Number.isSafeInteger(s.bytes) ||
      s.bytes < 1 ||
      s.bytes > 8 * 1024 * 1024 ||
      !Number.isSafeInteger(s.width) ||
      !Number.isSafeInteger(s.height) ||
      s.width < 1 ||
      s.height < 1 ||
      s.width > 4096 ||
      s.height > 4096 ||
      s.width * s.height > 8 * 1024 * 1024 ||
      !Array.isArray(asset.slotIds) ||
      !asset.slotIds.length ||
      typeof asset.provenance.prompt !== 'string' ||
      !asset.preparation
    )
      throw new Error('Invalid prepared asset');
    ids.add(asset.id);
    compositions.add(asset.compositionId);
    bytes += f.bytes;
    for (const owner of asset.slotIds) {
      if (typeof owner !== 'string' || owners.has(owner)) throw new Error('Invalid exact owner');
      owners.add(owner);
    }
  }
  if (compositions.size !== 38 || owners.size !== 56 || bytes !== 2083975)
    throw new Error('Prepared inventory totals differ');
  return data;
}
export async function readPreparedRevealManifest(options = {}) {
  return validatePreparedRevealManifest(await readPreparedRevealText(options));
}
export async function loadPreparedRevealImage(
  asset,
  { signal, window: win = globalThis.window, pageURL = import.meta.url } = {},
) {
  const urls = revealReviewURLs(asset, pageURL),
    rootURL = new URL('../../../../../', pageURL),
    load = (path) =>
      loadProductionImage(
        {
          role: 'original',
          file: { ...asset.file, path },
          width: asset.file.width,
          height: asset.file.height,
        },
        {
          rootURL,
          signal,
          fetchSource: (url, options) => win.fetch(url, options),
          cryptoSource: win.crypto,
          urlAPI: win.URL,
          makeImage: () => win.document.createElement('img'),
        },
      );
  const compiledPath = `game/presentation/compiled/assets/${asset.file.sha256}.png`;
  try {
    return { ...(await load(compiledPath)), path: compiledPath };
  } catch (error) {
    if (signal?.aborted || !urls.sourceDerivative) throw error;
    return { ...(await load(asset.file.path)), path: asset.file.path };
  }
}
