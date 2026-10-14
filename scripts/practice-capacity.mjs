/** Read-only lower-bound planning; never release admission or a replacement publisher. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MAIN_PAGES_BUDGET_BYTES } from './pages-archive.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha = /^[a-f0-9]{64}$/;
const versionPattern = /^v\d+\.\d+\.\d+$/;
const packagePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const safePath = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(value) &&
  !value.split('/').some((part) => part === '.' || part === '..');
function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid capacity byte count.');
  return value;
}
const sum = (values) => values.reduce((total, value) => integer(total + integer(value)), 0);

/** Packages describe actual distinct immutable versions. A future generation
 * without an allocated version belongs in reserveBytes, never a fictitious release. */
export function inspectPracticeCapacity({ coreInspection, packages = [], reserveBytes = 0 }) {
  if (
    coreInspection?.format !== 'revealline-default-build-inspection.v1' ||
    coreInspection.publicationProfile !== 'main-pages' ||
    !/^[a-f0-9]{40,64}$/.test(coreInspection.sourceRevision) ||
    coreInspection.completeHostedOutput !== false ||
    !Array.isArray(packages) ||
    packages.length > 512
  )
    throw new Error('Capacity planning needs a main-pages inspection and bounded package list.');
  const coreBytes = integer(coreInspection.payloadBytesIncludingManifest);
  if (!coreBytes) throw new Error('Core inspection must describe a nonempty payload.');
  const coreManifest = coreInspection.manifest;
  if (
    !Array.isArray(coreManifest?.files) ||
    coreManifest.files.length > 100_000 ||
    coreManifest.sourceRevision !== coreInspection.sourceRevision ||
    coreInspection.manifestDescriptor?.path !== 'manifest.json' ||
    !sha.test(coreInspection.manifestDescriptor.sha256)
  )
    throw new Error('Core inspection needs its complete source-bound manifest.');
  if (
    sum(coreManifest.files.map((file) => file.bytes)) !== coreManifest.totalBytes ||
    sum([coreManifest.totalBytes, coreInspection.manifestDescriptor.bytes]) !== coreBytes
  )
    throw new Error('Core inspection manifest byte totals differ.');
  integer(reserveBytes);
  const identities = new Set(),
    activeIDs = new Set();
  const records = packages.map(({ version, manifestBytes, active }) => {
    if (
      !versionPattern.test(version) ||
      !(manifestBytes instanceof Uint8Array) ||
      manifestBytes.length > 1024 * 1024 ||
      typeof active !== 'boolean'
    )
      throw new Error('Invalid capacity package input.');
    const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
    const identity = `${manifest.id}/${version}`;
    if (
      manifest.format !== 'revealline-optional-practice-package.v1' ||
      !packagePattern.test(manifest.id) ||
      !sha.test(manifest.revision) ||
      !/^[a-f0-9]{40,64}$/.test(manifest.engineCommit) ||
      !safePath(manifest.entry) ||
      identities.has(identity) ||
      (active && activeIDs.has(manifest.id)) ||
      !Array.isArray(manifest.files) ||
      !manifest.files.length ||
      manifest.files.length > 4096
    )
      throw new Error('Invalid or conflicting immutable capacity package.');
    identities.add(identity);
    if (active) activeIDs.add(manifest.id);
    const paths = new Set();
    for (const file of manifest.files) {
      if (
        !safePath(file.path) ||
        file.path === 'optional-package.json' ||
        paths.has(file.path) ||
        !sha.test(file.sha256)
      )
        throw new Error('Invalid or duplicate capacity file descriptor.');
      integer(file.bytes);
      paths.add(file.path);
    }
    if (!paths.has(manifest.entry)) throw new Error('Capacity package entry is missing.');
    const archiveBytes = sum([manifestBytes.length, ...manifest.files.map((file) => file.bytes)]);
    const stableLauncherBytes = active
      ? sum(
          manifest.files
            .filter((file) => file.path.startsWith('launcher/'))
            .map((file) => file.bytes),
        )
      : 0;
    if (active && !paths.has('launcher/index.html'))
      throw new Error('Active capacity package has no stable launcher.');
    const pointerBytes = active
      ? Buffer.byteLength(
          JSON.stringify({
            id: manifest.id,
            version,
            scope: `../releases/${version}/site/`,
            entry: manifest.entry,
          }) + '\n',
        )
      : 0;
    return {
      id: manifest.id,
      version,
      revision: manifest.revision,
      sourceRevision: manifest.engineCommit,
      manifestSha256: hash(manifestBytes),
      active,
      archiveBytes,
      stableLauncherBytes,
      pointerBytes,
    };
  });
  const packageBytes = sum(
    records.flatMap((item) => [item.archiveBytes, item.stableLauncherBytes, item.pointerBytes]),
  );
  const hostedPayloadLowerBound = sum([coreBytes, packageBytes]);
  const plannedPayloadLowerBound = sum([hostedPayloadLowerBound, reserveBytes]);
  return {
    format: 'revealline-practice-capacity-plan.v1',
    sourceRevision: coreInspection.sourceRevision,
    budgetBytes: MAIN_PAGES_BUDGET_BYTES,
    corePayloadBytes: coreBytes,
    coreFiles: coreManifest.files.length + 1,
    coreManifest: coreInspection.manifestDescriptor,
    packageBytes,
    hostedPayloadLowerBound,
    reserveBytes,
    plannedPayloadLowerBound,
    headroomUpperBoundBytes: MAIN_PAGES_BUDGET_BYTES - plannedPayloadLowerBound,
    minimumReductionRequiredBytes: Math.max(0, plannedPayloadLowerBound - MAIN_PAGES_BUDGET_BYTES),
    verdict:
      plannedPayloadLowerBound > MAIN_PAGES_BUDGET_BYTES ? 'cannot-fit' : 'requires-exact-build',
    packages: records,
    completeHostedOutput: false,
    publicEligible: false,
    admissionPerformed: false,
    missingComponents: [
      'Generated practice directory HTML, script, index and details',
      'Other hosted overlays, root routing and final publication metadata',
    ],
    note: 'Inputs are sizing evidence, not verified archive bodies or release approval. Reserve is a planning allowance, not a published or allocated release. A lower bound below budget is not a capacity pass; assemble and inventory the complete site.',
  };
}

async function readBounded(file, limit) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size > limit)
    throw new Error('Capacity input must be a bounded ordinary file.');
  const bytes = await fs.readFile(file);
  if (bytes.length > limit) throw new Error('Capacity input grew beyond its bound.');
  return bytes;
}

/** Config paths are relative to that config, not the shell's working directory. */
export async function practiceCapacityFromConfig(configPath) {
  const directory = path.dirname(path.resolve(configPath));
  const config = JSON.parse(await readBounded(configPath, 64 * 1024));
  if (
    config.format !== 'revealline-practice-capacity-input.v1' ||
    typeof config.coreInspection !== 'string' ||
    !Array.isArray(config.releases) ||
    config.releases.length > 64
  )
    throw new Error('Invalid practice capacity input document.');
  const coreInspection = JSON.parse(
    await readBounded(path.resolve(directory, config.coreInspection), 8 * 1024 * 1024),
  );
  const packages = [];
  for (const release of config.releases) {
    if (typeof release.directory !== 'string' || !Array.isArray(release.activePackageIds))
      throw new Error('Invalid capacity release directory.');
    const root = path.resolve(directory, release.directory);
    const envelope = JSON.parse(
      await readBounded(path.join(root, 'optional-packages.json'), 1024 * 1024),
    );
    const selected = release.packageIds ?? envelope.packages?.map((item) => item.id);
    if (
      envelope.format !== 'revealline-optional-packages.v1' ||
      !versionPattern.test(envelope.version) ||
      !Array.isArray(envelope.packages) ||
      !envelope.packages.length ||
      envelope.packages.length > 8 ||
      !Array.isArray(selected) ||
      !selected.length ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !envelope.packages.some((item) => item.id === id)) ||
      new Set(release.activePackageIds).size !== release.activePackageIds.length ||
      release.activePackageIds.some((id) => !selected.includes(id))
    )
      throw new Error('Invalid capacity candidate envelope.');
    for (const item of envelope.packages.filter((item) => selected.includes(item.id))) {
      if (!safePath(item.manifest?.path)) throw new Error('Unsafe capacity manifest path.');
      const manifestBytes = await readBounded(path.join(root, item.manifest.path), 1024 * 1024);
      if (
        manifestBytes.length !== item.manifest.bytes ||
        hash(manifestBytes) !== item.manifest.sha256
      )
        throw new Error('Capacity manifest differs from its candidate envelope.');
      const manifest = JSON.parse(manifestBytes);
      if (manifest.id !== item.id || manifest.engineCommit !== envelope.sourceRevision)
        throw new Error('Capacity package differs from its candidate identity.');
      packages.push({
        version: envelope.version,
        manifestBytes,
        active: release.activePackageIds.includes(item.id),
      });
    }
  }
  return inspectPracticeCapacity({
    coreInspection,
    packages,
    reserveBytes: config.reserveBytes ?? 0,
  });
}
