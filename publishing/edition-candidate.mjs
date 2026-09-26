import { canonicalJSON } from '../game/data-json.mjs';
import { createEditionZip, editionHash } from './edition-zip.mjs';
import {
  validateEditionSourceInventory,
  validatePublicSourceEligibility,
} from './edition-admission.mjs';

export const editionJSON = (value) => Buffer.from(canonicalJSON(value) + '\n');
export const editionDescriptor = (path, bytes) => ({
  path,
  bytes: bytes.length,
  sha256: editionHash(bytes),
});
const inventory = (files) =>
  [...files]
    .map(([path, bytes]) => editionDescriptor(path, bytes))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

/** Pure artifact construction from already compiled selected bytes. Aggregate
 * inputs are replaced by the compiler's selected projection, with both original
 * and output hashes recorded. Source ZIPs are never full repository releases. */
export function createEditionCandidate({
  compiled,
  sourceFiles,
  version,
  sourceRevision,
  sourceTree,
}) {
  const { files: runtime, runtimeCatalog: catalog } = compiled;
  if (!(runtime instanceof Map) || !(sourceFiles instanceof Map) || catalog.editions.length !== 1)
    throw new Error('One isolated compiled edition and its original source inputs are required.');
  validateEditionSourceInventory({ files: runtime, assets: catalog.assets });
  validateEditionSourceInventory({ files: sourceFiles, assets: catalog.assets });
  validatePublicSourceEligibility({ files: sourceFiles, assets: catalog.assets });
  const selectedSource = new Map(sourceFiles),
    projections = [];
  for (const [name, original] of sourceFiles) {
    const output = runtime.get(name);
    if (!output || editionHash(original) === editionHash(output)) continue;
    const kind =
      /^game\/(?:company\.html|index\.html|(?:controller-lab|replay-theater)\/index\.html)$/.test(
        name,
      )
        ? 'selected-entry'
        : /^game\/i18n\/(?:catalogs|bootstrap|content-registry)\.mjs$/.test(name)
          ? 'selected-locales'
          : catalog.editions.some((edition) => edition.boot?.themes === name)
            ? 'selected-themes'
            : name === 'game/content/scenarios/line-impact-demo.json'
              ? 'selected-practice-presentation'
              : /\.(?:mjs|js)$/.test(name)
                ? 'selected-runtime-imports'
                : null;
    if (!kind) throw new Error(`Unclassified selected source projection: ${name}`);
    selectedSource.set(name, output);
    projections.push({
      kind,
      original: editionDescriptor(name, original),
      output: editionDescriptor(name, output),
    });
  }
  projections.sort((a, b) =>
    a.original.path < b.original.path ? -1 : a.original.path > b.original.path ? 1 : 0,
  );
  const editionId = catalog.editions[0].id;
  const binding = {
    editionId,
    version,
    sourceRevision,
    sourceTree,
    contentSha256: editionHash(runtime.get('edition-catalog.json')),
  };
  const runtimeRows = inventory(runtime),
    sourceRows = inventory(selectedSource);
  const manifest = editionJSON({
    format: 'revealline-edition-manifest.v1',
    ...binding,
    entry: 'game/company.html',
    files: runtimeRows,
    totalBytes: runtimeRows.reduce((sum, row) => sum + row.bytes, 0),
  });
  const sourceInventory = editionJSON({
    format: 'revealline-edition-source-inventory.v1',
    ...binding,
    kind: projections.length ? 'selected-inputs-and-projections' : 'selected-original-inputs',
    publication: 'public',
    eligible: true,
    description:
      'Selected engine, campaign, lesson, boot and approved media inputs. Aggregate locale, theme, guide-presentation, entry and runtime-import inputs use exact compiler projections where listed; each projection records its original committed-input hash and output hash. Build tooling and unrelated repository sources are not included.',
    ...(projections.length ? { projections } : {}),
    assets: catalog.assets,
    files: sourceRows,
    totalBytes: sourceRows.reduce((sum, row) => sum + row.bytes, 0),
  });
  const distribution = createEditionZip(new Map([...runtime, ['manifest.json', manifest]]));
  const sourceArchive = createEditionZip(
    new Map([...selectedSource, ['source-inventory.json', sourceInventory]]),
  );
  const files = new Map([
    [`manifest-${editionId}.json`, manifest],
    [`distribution-${editionId}.zip`, distribution],
    [`source-inventory-${editionId}.json`, sourceInventory],
    [`source-${editionId}.zip`, sourceArchive],
  ]);
  const edition = {
    id: editionId,
    contentSha256: binding.contentSha256,
    packs: catalog.campaigns.map((campaign) => ({
      id: campaign.id,
      revision: campaign.revision,
      sha256: editionHash(runtime.get(campaign.sourcePath)),
    })),
    manifest: editionDescriptor(`manifest-${editionId}.json`, manifest),
    distribution: editionDescriptor(`distribution-${editionId}.zip`, distribution),
    sourceInventory: editionDescriptor(`source-inventory-${editionId}.json`, sourceInventory),
    sourceArchive: editionDescriptor(`source-${editionId}.zip`, sourceArchive),
  };
  return { edition, files };
}
