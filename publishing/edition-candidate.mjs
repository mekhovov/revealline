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

/** Pure artifact construction from already compiled selected bytes. Source ZIPs
 * are explicit input subsets, never an implied full repository source release. */
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
  const editionId = catalog.editions[0].id;
  const binding = {
    editionId,
    version,
    sourceRevision,
    sourceTree,
    contentSha256: editionHash(runtime.get('edition-catalog.json')),
  };
  const runtimeRows = inventory(runtime),
    sourceRows = inventory(sourceFiles);
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
    kind: 'selected-original-inputs',
    publication: 'public',
    eligible: true,
    description:
      'Original selected engine, campaign, lesson, boot and approved media inputs. Build tooling and unrelated repository sources are not included.',
    assets: catalog.assets,
    files: sourceRows,
    totalBytes: sourceRows.reduce((sum, row) => sum + row.bytes, 0),
  });
  const distribution = createEditionZip(new Map([...runtime, ['manifest.json', manifest]]));
  const sourceArchive = createEditionZip(
    new Map([...sourceFiles, ['source-inventory.json', sourceInventory]]),
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
