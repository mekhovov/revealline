/** Read-only container feasibility. Does not create an archive or alter build entries. */
import { createHash } from 'node:crypto';
import { constants, deflateRawSync, inflateRawSync } from 'node:zlib';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ZIP32_MAX = 0xffffffff;
const OPTIONS = Object.freeze({
  level: 9,
  windowBits: 15,
  memLevel: 8,
  strategy: constants.Z_DEFAULT_STRATEGY,
});

function memberName(name) {
  if (
    typeof name !== 'string' ||
    !name ||
    /[\\\x00-\x1f\x7f:]/.test(name) ||
    name.split('/').some((part) => !part || part === '.' || part === '..') ||
    Buffer.byteLength(name) > 65535
  )
    throw new Error(`Unsafe ZIP member name: ${JSON.stringify(name)}`);
}

/** Include the exact prepared manifest as an additional member. Every prepared
 * byte is hashed against that manifest before compression. Per-member deflate,
 * bounded inflate and a second deflate run retain only small descriptors.
 * The projected layout has the canonical writer's fixed headers and no extras,
 * comments, data descriptors or ZIP64; it is not an accepted production format.
 */
export function measureReleaseZipCapacity(prepared, { onProgress = () => {} } = {}) {
  const { entries, manifest, manifestBytes } = prepared;
  if (
    !Array.isArray(entries) ||
    !Array.isArray(manifest?.files) ||
    !Buffer.isBuffer(manifestBytes) ||
    !manifestBytes.equals(Buffer.from(`${JSON.stringify(manifest)}\n`))
  )
    throw new Error('Exact prepared entries and canonical manifest bytes are required.');
  if (entries.length > 65535) throw new Error('ZIP64 is outside this measurement.');
  const expected = new Map();
  for (const descriptor of manifest.files) {
    memberName(descriptor.path);
    if (
      descriptor.path === 'manifest.json' ||
      expected.has(descriptor.path) ||
      !Number.isSafeInteger(descriptor.bytes) ||
      descriptor.bytes < 0 ||
      descriptor.bytes > ZIP32_MAX ||
      !/^[a-f0-9]{64}$/.test(descriptor.sha256)
    )
      throw new Error(`Invalid or duplicate manifest member: ${descriptor.path}`);
    expected.set(descriptor.path, descriptor);
  }
  if ([...expected.values()].reduce((sum, entry) => sum + entry.bytes, 0) !== manifest.totalBytes)
    throw new Error('Manifest total differs from its member descriptors.');
  expected.set('manifest.json', {
    path: 'manifest.json',
    bytes: manifestBytes.length,
    sha256: sha256(manifestBytes),
  });
  if (entries.length !== expected.size) throw new Error('Prepared member count differs.');
  const names = new Set();
  for (const entry of entries) {
    memberName(entry.name);
    if (!Buffer.isBuffer(entry.bytes) || !expected.has(entry.name) || names.has(entry.name))
      throw new Error(`Unexpected, duplicate or non-byte prepared member: ${entry.name}`);
    names.add(entry.name);
  }

  let storedBytes = 22,
    deflatedBytes = 22,
    selectedBytes = 22;
  const members = [];
  for (const { name, bytes } of [...entries].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const descriptor = expected.get(name);
    if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256)
      throw new Error(`Prepared bytes differ from the manifest: ${name}`);
    const compressed = deflateRawSync(bytes, OPTIONS);
    const restored = inflateRawSync(compressed, { maxOutputLength: Math.max(1, bytes.length) });
    if (!restored.equals(bytes) || sha256(restored) !== descriptor.sha256)
      throw new Error(`Deflate round trip changed member: ${name}`);
    if (!deflateRawSync(bytes, OPTIONS).equals(compressed))
      throw new Error(`Repeated deflate bytes differ: ${name}`);
    const method = compressed.length < bytes.length ? 'deflate' : 'stored';
    const compressedBytes = method === 'deflate' ? compressed.length : bytes.length;
    const headerBytes = 76 + 2 * Buffer.byteLength(name);
    storedBytes += headerBytes + bytes.length;
    deflatedBytes += headerBytes + compressed.length;
    selectedBytes += headerBytes + compressedBytes;
    members.push({
      ...descriptor,
      deflatedBytes: compressed.length,
      deflatedSha256: sha256(compressed),
      selectedMethod: method,
      selectedBytes: compressedBytes,
      headerBytes,
    });
    onProgress({ members: members.length, totalMembers: entries.length, selectedBytes });
  }
  if (Math.max(storedBytes, deflatedBytes, selectedBytes) > ZIP32_MAX)
    throw new Error('ZIP64 is outside this measurement.');
  return {
    format: 'revealline-release-zip-capacity.v1',
    sourceRevision: manifest.sourceRevision,
    version: manifest.version,
    publicationProfile: null,
    scope: 'All complete prepared members plus their exact manifest; container feasibility only.',
    publicEligible: false,
    promotable: false,
    archiveProduced: false,
    expandedSiteProduced: false,
    productionCompressionSupportVerified: false,
    runtime: { node: process.versions.node, zlib: process.versions.zlib },
    compression: { format: 'raw-deflate', ...OPTIONS, selection: 'smaller; stored on ties' },
    layout:
      'ZIP32; UTF-8 names; 30-byte local and 46-byte central headers; 22-byte end; no extras/comments/descriptors',
    manifest: expected.get('manifest.json'),
    payloadMembers: manifest.files.length,
    archiveMembers: members.length,
    payloadBytes: manifest.totalBytes,
    payloadBytesIncludingManifest: manifest.totalBytes + manifestBytes.length,
    verification: {
      manifestMatchedMembers: members.length,
      exactRoundTripMembers: members.length,
      repeatedCompressionMatchedMembers: members.length,
      completeBuildRepetitions: 0,
    },
    projections: {
      allStoredBytes: storedBytes,
      allDeflatedBytes: deflatedBytes,
      chooseSmallerBytes: selectedBytes,
      bytesSaved: storedBytes - selectedBytes,
      storedMembers: members.filter((member) => member.selectedMethod === 'stored').length,
      deflatedMembers: members.filter((member) => member.selectedMethod === 'deflate').length,
    },
    limits: {
      releaseZipBytes: 950_000_000,
      releaseZipHeadroom: 950_000_000 - selectedBytes,
      releaseZipFits: selectedBytes <= 950_000_000,
      nativeExtractedBytes: 805_306_368,
      nativeExtractedHeadroom: 805_306_368 - manifest.totalBytes,
      nativeExtractedFits: manifest.totalBytes <= 805_306_368,
      note: 'Existing limits are observations, not changed policies or publication admission.',
    },
    members,
  };
}
