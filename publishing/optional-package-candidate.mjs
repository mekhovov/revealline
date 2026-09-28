import { editionJSON, editionDescriptor } from './edition-candidate.mjs';
import { createEditionZip } from './edition-zip.mjs';
import { OPTIONAL_PACKAGE_POLICIES, optionalRuntimePaths } from './optional-package-policy.mjs';
import { validatePublicSourceEligibility } from './edition-admission.mjs';

const inventory = (files) =>
  [...files]
    .map(([name, bytes]) => editionDescriptor(name, bytes))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

/** Construct artifacts from a closed optional build. The frozen CLI separately
 * authenticates every original input against its clean committed source tree. */
export function createOptionalPackageCandidate({ built, version, sourceRevision, sourceTree }) {
  const { manifest, inputs } = built;
  const policy = OPTIONAL_PACKAGE_POLICIES[manifest.id];
  if (
    !policy ||
    !(inputs instanceof Map) ||
    manifest.engineCommit !== sourceRevision ||
    manifest.engineTree !== sourceTree ||
    manifest.qualification !== 'requires-release-qualification'
  )
    throw new Error('Optional candidate needs a bound package and its original inputs.');
  const runtime = new Map(built.entries.map((entry) => [entry.name, entry.bytes]));
  const manifestBytes = runtime.get('optional-package.json');
  const selectedSource = new Map(runtime);
  selectedSource.delete('optional-package.json');
  selectedSource.set(policy.template, inputs.get(policy.template));
  selectedSource.set(policy.launcherTemplate, inputs.get(policy.launcherTemplate));
  selectedSource.set(policy.root + 'app.webmanifest', inputs.get(policy.root + 'app.webmanifest'));
  validatePublicSourceEligibility({ files: selectedSource });
  const id = manifest.id;
  const sourceInventory = editionJSON({
    format: 'revealline-optional-package-source.v1',
    version,
    sourceRevision,
    sourceTree,
    packageId: id,
    packageRevision: manifest.revision,
    classification: 'public',
    kind: 'selected-inputs-and-projections',
    description:
      'Selected application and shared code; generated offline worker and icons; selected validator messages only. Original aggregate locale bytes and build tooling are omitted. Original input hashes bind the committed build inputs, not additional published files.',
    inputs: inventory(inputs),
    files: inventory(selectedSource),
    projections: [
      {
        kind: 'stable-installation-identity',
        output: editionDescriptor(
          policy.root + 'app.webmanifest',
          runtime.get(policy.root + 'app.webmanifest'),
        ),
        inputs: [policy.root + 'app.webmanifest'],
      },
      {
        kind: 'selected-validator-locales',
        output: editionDescriptor('game/i18n/catalogs.mjs', runtime.get('game/i18n/catalogs.mjs')),
        inputs: policy.localeInputs,
      },
    ],
    generated: [
      ...['worker.js', 'icons/icon-192.png', 'icons/icon-512.png'].map(
        (name) => policy.root + name,
      ),
      ...optionalRuntimePaths(policy, { launcher: true }).filter((name) =>
        name.startsWith('launcher/'),
      ),
    ],
    licenses: policy.licenses.map((license) => ({
      ...license,
      ...editionDescriptor(license.path, runtime.get(license.path)),
    })),
  });
  if (
    selectedSource.size + 1 > policy.limits.files ||
    [...selectedSource.values()].reduce(
      (sum, bytes) => sum + bytes.length,
      sourceInventory.length,
    ) > policy.limits.bytes
  )
    throw new Error('Complete optional source output exceeds package limits.');
  const files = new Map([
    [`manifest-optional-${id}.json`, manifestBytes],
    [`distribution-optional-${id}.zip`, built.zip],
    [`source-inventory-optional-${id}.json`, sourceInventory],
    [
      `source-optional-${id}.zip`,
      createEditionZip(new Map([...selectedSource, ['source-inventory.json', sourceInventory]])),
    ],
  ]);
  const row = {
    id,
    revision: manifest.revision,
    classification: 'public',
    core: false,
    entry: manifest.entry,
    manifest: editionDescriptor(`manifest-optional-${id}.json`, manifestBytes),
    distribution: editionDescriptor(
      `distribution-optional-${id}.zip`,
      files.get(`distribution-optional-${id}.zip`),
    ),
    sourceInventory: editionDescriptor(`source-inventory-optional-${id}.json`, sourceInventory),
    sourceArchive: editionDescriptor(
      `source-optional-${id}.zip`,
      files.get(`source-optional-${id}.zip`),
    ),
  };
  return { package: row, files };
}
