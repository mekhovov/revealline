import { createHash } from 'node:crypto';
import { required } from '../game/data-json.mjs';
import { resolveEditionAssets, validateEditionRuntimeCatalog } from '../game/editions/model.mjs';
import { validateRetainedPresentation } from '../game/editions/retained-presentation.mjs';
import { editionOfflinePackageId } from '../game/editions/offline-package-id.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Classify exact shipped originals before static core traversal. Metadata and
 * immutable retained JSON stay in core; no byte is removed from the distribution. */
export async function companyOfflinePackages(entries) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  const source = byPath.get('game/editions/catalog.json');
  if (!source) return { paths: new Set(), groups: [] };
  const catalog = validateEditionRuntimeCatalog(source.bytes.toString('utf8'));
  const paths = new Set(),
    groups = [],
    owned = new Set();
  const verify = (pin) => {
    const entry = byPath.get(pin.path);
    required(
      entries.filter((item) => item.name === pin.path).length === 1 &&
        entry.bytes.length === pin.bytes &&
        digest(entry.bytes) === pin.sha256,
      'Company offline dependency differs from its exact shipped original.',
    );
    return entry;
  };
  const verifyAsset = (asset) => {
    required(
      asset.path.startsWith('game/editions/assets/'),
      'Company optional assets must remain inside the explicit company asset boundary.',
    );
    verify(asset);
    paths.add(asset.path);
  };
  // Also classify unselected, retained originals. They must not fall into shared.
  for (const asset of catalog.assets) verifyAsset(asset);
  const add = (selectedCatalog, edition, presentationId = null) => {
    const assets = resolveEditionAssets(selectedCatalog, { editionId: edition.id });
    required(
      assets.reduce((sum, asset) => sum + asset.bytes, 0) <= 64 * 1024 * 1024,
      'Company presentation exceeds its offline budget.',
    );
    for (const asset of assets) {
      required(asset.approved === true, 'Company offline artwork is not approved.');
      required(
        edition.publication !== 'public' || asset.publication === 'public',
        'Company offline artwork is outside the selected publication.',
      );
      verifyAsset(asset);
      owned.add(asset.path);
    }
    groups.push({
      id: editionOfflinePackageId(edition.id, presentationId),
      title: presentationId ? edition.name + ' · ' + presentationId.slice(0, 12) : edition.name,
      kind: 'gameplay',
      category: presentationId ? 'archive' : 'chapter',
      current: !presentationId,
      modes: [...edition.modes],
      requires: [],
      files: assets.map((asset) => asset.path),
    });
  };
  for (const edition of catalog.editions) {
    add(catalog, edition);
    for (const descriptor of edition.presentationHistory || []) {
      const entry = verify(descriptor);
      const { snapshot } = await validateRetainedPresentation(entry.bytes.toString('utf8'), {
        edition,
      });
      required(
        snapshot.authoredPresentationSha256 === descriptor.id,
        'Company retained presentation differs from its registered identity.',
      );
      add(snapshot.catalog, snapshot.catalog.editions[0], descriptor.id);
    }
  }
  const unselected = [...paths].filter((name) => !owned.has(name));
  if (unselected.length)
    groups.push({
      id: 'tooling:company-artwork',
      title: 'Company artwork reference originals',
      kind: 'gameplay',
      category: 'tooling',
      current: false,
      modes: [],
      requires: [],
      files: unselected,
    });
  return { paths, groups };
}
