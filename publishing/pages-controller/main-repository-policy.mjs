/** New releases stay in the main repository; retired archive routes cannot be re-admitted. */
import { createHash } from 'node:crypto';
import { validateArchivePlan, canonicalArchiveSite } from '../../scripts/pages-archive.mjs';

export const MAIN_REPOSITORY_POLICY = 'main-repository-only';
// The retired frozen publication registry is deliberately empty. New retained
// releases require fresh source qualification; archived approvals cannot return.
const ALLOCATION_SHA256 = 'ad32000b1d5efeb010efac326d94827920f002641322a2e935bfcfdb3d1d1900';
const ADMISSIONS_SHA256 = '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
const LEGACY_RECORDS = Object.freeze({});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function requireMainRepositoryPolicy(configuration) {
  if (configuration.hostingPolicy !== MAIN_REPOSITORY_POLICY)
    throw new Error('Publication requires the main-repository-only hosting policy.');
}

export function mainRepositoryRoutes(configuration, allocationBytes, metadata) {
  requireMainRepositoryPolicy(configuration);
  if (
    configuration.allocationSha256 !== ALLOCATION_SHA256 ||
    digest(allocationBytes) !== ALLOCATION_SHA256 ||
    digest(JSON.stringify(configuration.admissions)) !== ADMISSIONS_SHA256
  )
    throw new Error(
      'Legacy archive registry is frozen; do not create, append or admit an archive.',
    );
  const allocation = JSON.parse(Buffer.from(allocationBytes).toString('utf8'));
  const admitted = new Set(configuration.admissions.map((row) => row.id));
  const plan = {
    formatVersion: 1,
    shards: allocation.shards
      .filter((shard) => admitted.has(shard.id))
      .map((shard) => ({
        ...shard,
        versions: shard.versions.filter(
          (version) => metadata.has(version) && version !== configuration.currentVersion,
        ),
      }))
      .filter((shard) => shard.versions.length),
  };
  const shards = validateArchivePlan(
    plan,
    [...metadata.values()].map((item) => item.record),
    'mekhovov/revealline',
    configuration.currentVersion,
  );
  const canonicalSites = Object.fromEntries(
    shards.flatMap((shard) =>
      shard.versions.map((version) => [version, canonicalArchiveSite(shard, version)]),
    ),
  );
  for (const version of Object.keys(canonicalSites)) {
    if (
      !metadata.get(version).recordBytes ||
      digest(metadata.get(version).recordBytes) !== LEGACY_RECORDS[version]
    )
      throw new Error('Legacy archive metadata no longer matches its accepted record: ' + version);
  }
  for (const [version, site] of Object.entries(configuration.testingRoutes))
    if (canonicalSites[version] !== site)
      throw new Error('Testing routes may only retain an already accepted legacy archive.');
  return {
    plan,
    canonicalSites,
    admissions: [],
    downloadOnlyVersions: [...metadata.keys()].filter(
      (version) => version !== configuration.currentVersion && !canonicalSites[version],
    ),
  };
}
