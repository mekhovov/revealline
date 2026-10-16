/** Small candidate metadata only. This is capacity planning, never release admission. */
import { MAIN_PAGES_BUDGET_BYTES } from '../scripts/pages-archive.mjs';
import { validateEditionId } from '../game/edition-context.mjs';
import { editionDescriptor, editionJSON } from './edition-candidate.mjs';
import { editionHash } from './edition-zip.mjs';
import { editionLauncherCurrentBytes } from './edition-promotion.mjs';

export const EDITION_CAPACITY_REPORT = 'capacity-inventory.json';
export const EDITION_CAPACITY_PACKET_MAX_BYTES = 16 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const fail = (message) => {
  throw new Error(message);
};
const decode = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
function read(files, name, limit = 8_000_000) {
  const bytes = files.get(name);
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > limit)
    fail(`Missing or oversized capacity metadata: ${name}`);
  return bytes;
}
function pinned(files, descriptor, expectedPath) {
  if (descriptor?.path !== expectedPath || !SHA.test(descriptor.sha256))
    fail('Capacity metadata descriptor differs.');
  const bytes = read(files, expectedPath);
  if (bytes.length !== descriptor.bytes || editionHash(bytes) !== descriptor.sha256)
    fail('Capacity metadata bytes differ from the candidate envelope.');
  return bytes;
}
function sum(rows, property) {
  const total = rows.reduce((n, row) => n + row[property], 0);
  if (!Number.isSafeInteger(total) || total < 0) fail('Capacity total exceeds integer bounds.');
  return total;
}
const sameIdentity = (a, b) =>
  ['version', 'sourceRevision', 'sourceTree'].every((key) => a?.[key] === b?.[key]);

/** Called only after the ordinary candidate's source, two-build and ZIP-member
 * checks. The packet binds that existing receipt; it cannot reverify omitted
 * archive bodies or turn the receipt into human/publication evidence. */
export function createEditionCapacityReport(files) {
  if (!(files instanceof Map)) fail('Capacity planning needs candidate metadata.');
  const envelopeBytes = read(files, 'editions.json'),
    envelope = decode(envelopeBytes);
  const verificationBytes = read(files, 'candidate-verification.json'),
    verification = decode(verificationBytes);
  if (
    envelope.format !== 'revealline-editions.v1' ||
    !/^v\d+\.\d+\.\d+$/.test(envelope.version) ||
    !COMMIT.test(envelope.sourceRevision) ||
    !COMMIT.test(envelope.sourceTree) ||
    !Array.isArray(envelope.editions) ||
    !envelope.editions.length ||
    envelope.editions.length > 32 ||
    verification.format !== 'revealline-edition-candidate-verification.v1' ||
    !sameIdentity(envelope, verification) ||
    verification.envelopeSha256 !== editionHash(envelopeBytes) ||
    verification.publicEligible !== false ||
    verification.reproducibleBuilds !== 2 ||
    verification.sourceEligibility?.status !== 'verified' ||
    verification.sourceEligibility?.format !== 'revealline-public-source-eligibility.v1' ||
    verification.admission?.format !== 'revealline-editions-admission.v1' ||
    !sameIdentity(envelope, verification.admission) ||
    verification.admission.zipMembersVerified !== true ||
    verification.admission.publicEligible !== false ||
    !Array.isArray(verification.admission.editions) ||
    verification.admission.editions.length !== envelope.editions.length
  )
    fail('Capacity inputs must bind the exact nonpromoted verified candidate.');
  const ids = new Set(),
    editions = [];
  for (const edition of envelope.editions) {
    validateEditionId(edition.id);
    if (ids.has(edition.id)) fail('Duplicate capacity edition.');
    ids.add(edition.id);
    const manifestBytes = pinned(files, edition.manifest, `manifest-${edition.id}.json`);
    const manifest = decode(manifestBytes);
    const admitted = verification.admission.editions.filter((row) => row.id === edition.id);
    if (
      manifest.format !== 'revealline-edition-manifest.v1' ||
      !sameIdentity(envelope, manifest) ||
      manifest.editionId !== edition.id ||
      !SHA.test(edition.contentSha256) ||
      manifest.contentSha256 !== edition.contentSha256 ||
      manifest.entry !== 'game/company.html' ||
      !Array.isArray(manifest.files) ||
      !manifest.files.length ||
      manifest.files.length > 20000 ||
      admitted.length !== 1 ||
      admitted[0].distributionSha256 !== edition.distribution?.sha256 ||
      admitted[0].sourceArchiveSha256 !== edition.sourceArchive?.sha256
    )
      fail('Capacity manifest differs from its admitted edition.');
    const paths = new Set();
    for (const row of manifest.files) {
      if (
        typeof row.path !== 'string' ||
        row.path.length > 400 ||
        !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(row.path) ||
        row.path === 'manifest.json' ||
        paths.has(row.path) ||
        !Number.isSafeInteger(row.bytes) ||
        row.bytes < 0 ||
        !SHA.test(row.sha256)
      )
        fail('Invalid capacity file inventory.');
      paths.add(row.path);
    }
    const runtimeBytes = sum(manifest.files, 'bytes');
    if (
      manifest.totalBytes !== runtimeBytes ||
      admitted[0].totalBytes !== runtimeBytes ||
      admitted[0].files !== manifest.files.length ||
      !paths.has('app/current.json') ||
      !paths.has('app/manifest.webmanifest')
    )
      fail('Capacity totals differ from the admitted inventory.');
    const immutableBytes = runtimeBytes + manifestBytes.length;
    const launcherOriginals = manifest.files.filter(
      (row) => row.path.startsWith('app/') && row.path !== 'app/current.json',
    );
    const pointer = editionLauncherCurrentBytes({
      editionId: edition.id,
      version: envelope.version,
      entry: manifest.entry,
    });
    const stableLauncherBytes = sum(launcherOriginals, 'bytes') + pointer.length;
    editions.push({
      id: edition.id,
      contentSha256: edition.contentSha256,
      manifest: edition.manifest,
      immutable: { files: manifest.files.length + 1, bytes: immutableBytes },
      stableLauncher: {
        files: launcherOriginals.length + 1,
        bytes: stableLauncherBytes,
        currentPointer: editionDescriptor(`editions/${edition.id}/app/current.json`, pointer),
      },
      immutableAndActiveLauncherBytes: immutableBytes + stableLauncherBytes,
    });
  }
  editions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    format: 'revealline-edition-capacity.v1',
    version: envelope.version,
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    inputs: {
      envelope: editionDescriptor('editions.json', envelopeBytes),
      candidateVerification: editionDescriptor('candidate-verification.json', verificationBytes),
    },
    basis:
      'Exact manifest lengths after candidate admission; archive bodies are not included or reverified by this metadata packet.',
    publicEligible: false,
    promotable: false,
    completeHostedOutput: false,
    publicationAssessment: 'not-performed',
    hostedBudgetBytes: MAIN_PAGES_BUDGET_BYTES,
    editions,
    allEditionComponentsBytes: sum(editions, 'immutableAndActiveLauncherBytes'),
    aggregateAssumption:
      'Every envelope edition hosted with an active launcher at this single candidate revision; this is not a deployment selection.',
    missingComponents: [
      'Exact future default artifact and generated root routes',
      'Previously retained edition versions and launcher ownership',
      'Selected-edition hub including download-only links',
      'Optional packages, launchers and any other hosted files',
    ],
  };
}

/** Whitelist only publication-safe candidate metadata for the small CI artifact. */
export function editionCapacityPacket(files) {
  const reportBytes = read(files, EDITION_CAPACITY_REPORT, 256 * 1024);
  const report = createEditionCapacityReport(files);
  if (!Buffer.from(reportBytes).equals(editionJSON(report)))
    fail('Capacity report differs from its exact inputs.');
  const checksumsBytes = read(files, 'checksums.json'),
    checksums = decode(checksumsBytes);
  if (
    checksums.format !== 'revealline-edition-checksums.v1' ||
    !Array.isArray(checksums.files) ||
    checksums.files.length > 256
  )
    fail('Missing bounded candidate checksums.');
  const expected = new Map([
    ['editions.json', report.inputs.envelope],
    ['candidate-verification.json', report.inputs.candidateVerification],
    [EDITION_CAPACITY_REPORT, editionDescriptor(EDITION_CAPACITY_REPORT, reportBytes)],
  ]);
  for (const edition of decode(read(files, 'editions.json')).editions)
    for (const [role, name] of [
      ['manifest', `manifest-${edition.id}.json`],
      ['distribution', `distribution-${edition.id}.zip`],
      ['sourceInventory', `source-inventory-${edition.id}.json`],
      ['sourceArchive', `source-${edition.id}.zip`],
    ]) {
      if (edition[role]?.path !== name) fail('Capacity packet has an unknown artifact descriptor.');
      expected.set(name, edition[role]);
    }
  if (checksums.files.length !== expected.size) fail('Capacity packet checksum inventory differs.');
  const seen = new Set();
  for (const row of checksums.files) {
    const reference = expected.get(row.path);
    if (
      !reference ||
      seen.has(row.path) ||
      row.bytes !== reference.bytes ||
      row.sha256 !== reference.sha256
    )
      fail('Capacity packet contains unknown or changed artifact checksums.');
    seen.add(row.path);
  }
  const names = [
    'editions.json',
    'candidate-verification.json',
    EDITION_CAPACITY_REPORT,
    ...report.editions.map((edition) => edition.manifest.path),
  ];
  const packet = new Map();
  for (const name of names) {
    const descriptors = checksums.files.filter((row) => row.path === name);
    if (descriptors.length !== 1) fail('Capacity packet checksum coverage differs.');
    packet.set(name, pinned(files, descriptors[0], name));
  }
  packet.set('checksums.json', checksumsBytes);
  if (
    sum(
      [...packet.values()].map((bytes) => ({ bytes: bytes.length })),
      'bytes',
    ) > EDITION_CAPACITY_PACKET_MAX_BYTES
  )
    fail('Capacity metadata packet exceeds 16 MiB.');
  return packet;
}
