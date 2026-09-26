import { boundedJSON, canonicalJSON, required } from '../../game/data-json.mjs';
import {
  editionRelativePath,
  validateEditionRuntimeCatalog,
  validateEditionAsset,
} from '../../game/editions/model.mjs';
import { hashPresentationBytes } from '../../game/presentation/bundle.mjs';
import {
  validateStudioReport,
  validateStudioHistory,
  studioPreviewURL,
  projectStudioSelection,
  assertMatchingStudioSelection,
} from './model.mjs';

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const same = (a, b, message) => required(canonicalJSON(a) === canonicalJSON(b), message);
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Preview verification cancelled.', 'AbortError');
};

/** A consistency check over this local artifact, not an independent publisher,
 * rights decision, security signature, or human playtest approval. */
export async function verifyStudioPreview({
  catalog,
  editionId,
  files,
  report: input,
  baseURL,
  runtimeAssets = [],
  fetcher = globalThis.fetch,
  signal,
  onProgress = () => {},
}) {
  const report = validateStudioReport(input);
  required(report.editionId === editionId, 'The report belongs to another selected edition.');
  const preview = studioPreviewURL(report, baseURL),
    root = new URL('../', preview);
  const expected = projectStudioSelection(catalog, editionId, files);
  const retained = await validateStudioHistory(catalog, files, { editionId, signal });
  required(
    report.brandId === expected.brand.id && report.name === expected.edition.name,
    'The compiler report identity differs from this applied draft.',
  );
  async function read(path, fact) {
    abort(signal);
    required(
      editionRelativePath(path) &&
        Number.isSafeInteger(fact.bytes) &&
        fact.bytes >= 0 &&
        fact.bytes <= MAX_FILE_BYTES &&
        /^[a-f0-9]{64}$/.test(fact.sha256),
      'Invalid bounded artifact file.',
    );
    const url = new URL(path, root);
    const response = await fetcher(url.href, { cache: 'no-store', redirect: 'error', signal });
    required(
      response?.ok && (!response.url || response.url === url.href),
      `Artifact file is unavailable: ${path}`,
    );
    const reader = response.body?.getReader();
    required(reader, 'The preview server must support bounded file reads.');
    const chunks = [];
    let length = 0;
    try {
      for (;;) {
        abort(signal);
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        required(length <= fact.bytes, `Artifact byte count differs: ${path}`);
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel();
      throw error;
    }
    required(length === fact.bytes, `Artifact byte count differs: ${path}`);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    required(
      (await hashPresentationBytes(bytes)) === fact.sha256,
      `Artifact hash differs: ${path}`,
    );
    abort(signal);
    return bytes;
  }
  const manifestBytes = await read(report.artifact.path, report.artifact);
  const manifest = boundedJSON(new TextDecoder().decode(manifestBytes), {
    maxBytes: 4 * 1024 * 1024,
    maxArray: 8192,
    maxNodes: 60000,
  });
  required(
    manifest.format === 'revealline-edition-build.v1' &&
      Array.isArray(manifest.files) &&
      manifest.files.length > 0 &&
      manifest.files.length <= 8192,
    'Invalid bounded preview inventory.',
  );
  same(manifest.editionIds, [editionId], 'The preview inventory contains another edition.');
  const inventory = new Map();
  let totalBytes = manifestBytes.length;
  for (const fact of manifest.files) {
    required(
      editionRelativePath(fact.path) &&
        fact.path !== 'edition-build.json' &&
        !inventory.has(fact.path) &&
        Number.isSafeInteger(fact.bytes) &&
        fact.bytes >= 0 &&
        fact.bytes <= MAX_FILE_BYTES &&
        /^[a-f0-9]{64}$/.test(fact.sha256),
      'Invalid or duplicate preview inventory path.',
    );
    inventory.set(fact.path, fact);
    totalBytes += fact.bytes;
  }
  required(totalBytes <= MAX_BYTES, 'Whole-game verification exceeds its 256 MB preview budget.');
  const admitted = [...inventory.keys(), report.artifact.path].sort();
  same(
    report.admittedPaths,
    admitted,
    'The report admitted paths differ from its actual inventory.',
  );
  required(
    inventory.has('game/company.html') && inventory.has('game/index.html'),
    'The preview inventory is missing the complete Solo entry.',
  );
  const catalogFact = inventory.get('edition-catalog.json');
  required(
    catalogFact && catalogFact.sha256 === manifest.catalogSha256,
    'The preview catalog is not bound to its inventory.',
  );
  const catalogBytes = await read('edition-catalog.json', catalogFact);
  const built = validateEditionRuntimeCatalog(new TextDecoder().decode(catalogBytes));
  same(
    built.editions.map(({ id }) => id),
    [editionId],
    'The compiled catalog contains another edition.',
  );
  const selection = assertMatchingStudioSelection(catalog, built, editionId, files);
  same(built.brands, [selection.brand], 'The compiled catalog contains another brand.');
  same(
    built.campaigns,
    selection.campaigns,
    'The compiled catalog contains an unselected campaign.',
  );
  required(
    Array.isArray(runtimeAssets) && runtimeAssets.length <= 128,
    'Invalid trusted engine asset ledger.',
  );
  const sharedAssets = runtimeAssets
    .map(validateEditionAsset)
    .filter((asset) => inventory.has(asset.path));
  same(
    built.assets,
    [...selection.assets, ...sharedAssets],
    'The compiled catalog contains unselected media.',
  );
  const publicationAssets = new Map();
  for (const asset of [
    ...built.assets,
    ...retained.flatMap((snapshot) => snapshot.catalog.assets),
  ]) {
    const previous = publicationAssets.get(asset.path);
    required(
      !previous || (previous.sha256 === asset.sha256 && previous.bytes === asset.bytes),
      'Retained media conflicts with an immutable asset path.',
    );
    publicationAssets.set(asset.path, asset);
    const fact = inventory.get(asset.path);
    required(
      fact?.sha256 === asset.sha256 && fact.bytes === asset.bytes,
      `Artifact media differs from its selected original: ${asset.path}`,
    );
  }
  const retainedPaths = new Set(
    (selection.edition.presentationHistory ?? []).map((record) => record.path),
  );
  const selectedPaths = new Set([
    ...retainedPaths,
    ...Object.values(selection.edition.boot),
    ...selection.campaigns.flatMap((campaign) => [
      campaign.sourcePath,
      ...(campaign.lessonPath ? [campaign.lessonPath] : []),
    ]),
  ]);
  for (const path of selectedPaths)
    required(inventory.has(path) && expected.files.has(path), `Missing selected source: ${path}`);
  const selectedData = new Map();
  const pending = [...inventory].filter(([path]) => path !== 'edition-catalog.json');
  let next = 0,
    completed = 1,
    failure = null;
  await Promise.all(
    Array.from({ length: Math.min(6, pending.length) }, async () => {
      try {
        while (next < pending.length && !failure) {
          const [path, fact] = pending[next++];
          const bytes = await read(path, fact);
          if (selectedPaths.has(path)) {
            const original = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            const data = retainedPaths.has(path) ? original : boundedJSON(original);
            same(
              data,
              expected.files.get(path),
              `Compiled source differs at ${path}. Compile the applied draft again.`,
            );
            selectedData.set(path, data);
          }
          completed++;
          if (!failure) onProgress(completed, inventory.size);
        }
      } catch (error) {
        failure ??= error;
      }
    }),
  );
  if (failure) throw failure;
  const summary = {
    campaigns: selection.campaigns.length,
    missions: selection.campaigns.reduce(
      (sum, campaign) => sum + selectedData.get(campaign.sourcePath).missions.length,
      0,
    ),
    lessons: selection.campaigns.reduce(
      (sum, campaign) =>
        sum + (campaign.lessonPath ? selectedData.get(campaign.lessonPath).length : 0),
      0,
    ),
    assets: publicationAssets.size,
    runtimeFiles: admitted.length,
    runtimeBytes: totalBytes,
  };
  same(report.summary, summary, 'The compiler summary differs from the verified artifact.');
  const excluded = {};
  for (const [key, field] of [
    ['editionIds', 'editions'],
    ['brandIds', 'brands'],
    ['campaignIds', 'campaigns'],
  ])
    excluded[key] = catalog[field]
      .filter((item) => !built[field].some((record) => record.id === item.id))
      .map((item) => item.id);
  excluded.assetIds = catalog.assets
    .filter((asset) => {
      const admitted = publicationAssets.get(asset.path);
      return !admitted || admitted.sha256 !== asset.sha256;
    })
    .map((asset) => asset.id);
  same(
    report.excluded,
    excluded,
    'The exclusion report differs from the applied source selection.',
  );
  abort(signal);
  return { url: preview, summary, excluded, verifiedFiles: admitted.length };
}
