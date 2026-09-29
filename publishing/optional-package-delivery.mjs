import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { additiveReleaseAssetBudget } from './fastline-release-publisher.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const fail = (message) => {
  throw new Error(message);
};
const assetPin = ({ id, name, size, state, digest }) => ({ id, name, size, state, digest });
const inventory = (release) => {
  if (!Array.isArray(release.assets)) fail('Optional release asset inventory is missing.');
  const result = new Map();
  const ids = new Set();
  for (const asset of release.assets) {
    if (
      !positive(asset.id) ||
      typeof asset.name !== 'string' ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 0 ||
      asset.state !== 'uploaded' ||
      !/^sha256:[a-f0-9]{64}$/.test(asset.digest) ||
      result.has(asset.name) ||
      ids.has(asset.id)
    )
      fail('Optional release asset inventory is ambiguous or incomplete.');
    result.set(asset.name, assetPin(asset));
    ids.add(asset.id);
  }
  return result;
};

// A later read-only reconciliation may report EXISTING_VERIFIED for the same
// immutable asset. Preserve the first receipt; compare all pins, not that label.
export function sameOptionalDeliveryReceipt(original, current) {
  const stable = (receipt) => {
    if (!Array.isArray(receipt?.assets)) fail('Optional delivery receipt is incomplete.');
    return {
      ...receipt,
      assets: receipt.assets.map(({ status, ...pin }) => {
        if (!['UPLOADED_VERIFIED', 'EXISTING_VERIFIED'].includes(status))
          fail('Optional delivery receipt has an unresolved asset.');
        return pin;
      }),
    };
  };
  return isDeepStrictEqual(stable(original), stable(current));
}

/** Deliver already-admitted originals to one explicitly selected draft ID.
 * Adapters perform I/O; no retry, tag-based upload, release creation or promotion exists here. */
export async function deliverOptionalPackageDraft({
  repository,
  releaseId,
  envelope,
  envelopeBytes,
  reviewBytes,
  files,
  readRelease,
  readTagRelease,
  readTagIdentity,
  readAsset,
  uploadAsset,
  record,
}) {
  if (
    repository !== 'mekhovov/revealline' ||
    !positive(releaseId) ||
    !/^v\d+\.\d+\.\d+$/.test(envelope?.version) ||
    !/^[a-f0-9]{40}$/.test(envelope.sourceRevision) ||
    !/^[a-f0-9]{40}$/.test(envelope.sourceTree) ||
    !(files instanceof Map) ||
    !files.has('optional-packages.json') ||
    ![
      'readRelease',
      'readTagRelease',
      'readTagIdentity',
      'readAsset',
      'uploadAsset',
      'record',
    ].every(
      (name) =>
        typeof { readRelease, readTagRelease, readTagIdentity, readAsset, uploadAsset, record }[
          name
        ] === 'function',
    )
  )
    fail('Optional delivery requires an explicit release ID and complete adapters.');
  const frozen = new Map();
  for (const [name, bytes] of files) {
    if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name) || !(bytes instanceof Uint8Array))
      fail('Optional delivery file is invalid.');
    frozen.set(name, Buffer.from(bytes));
  }
  const proposed = [...frozen].map(([name, bytes]) => ({
    name,
    size: bytes.length,
    digest: `sha256:${hash(bytes)}`,
  }));
  const endpoint = `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets`;
  let expected;
  const validateRelease = (release) => {
    if (
      release?.id !== releaseId ||
      release.draft !== true ||
      release.prerelease !== false ||
      release.tag_name !== envelope.version ||
      release.target_commitish !== envelope.sourceRevision ||
      release.upload_url !== `${endpoint}{?name,label}`
    )
      fail('Optional draft identity changed; delivery is stopped.');
    return inventory(release);
  };
  const guard = async () => {
    const direct = validateRelease(await readRelease(releaseId));
    const tagged = validateRelease(await readTagRelease(envelope.version));
    if (!isDeepStrictEqual(direct, tagged) || (expected && !isDeepStrictEqual(direct, expected)))
      fail('Optional draft asset inventory changed; delivery is stopped.');
    const identity = await readTagIdentity(envelope.version);
    if (
      identity?.sourceRevision !== envelope.sourceRevision ||
      identity?.sourceTree !== envelope.sourceTree
    )
      fail('Optional release tag moved; delivery is stopped.');
    additiveReleaseAssetBudget({ existing: [...direct.values()], proposed });
    return direct;
  };
  const verifyBytes = async (pin, bytes) => {
    if (pin.size !== bytes.length || pin.digest !== `sha256:${hash(bytes)}`)
      fail('Existing optional release asset differs; overwrite is forbidden.');
    const downloaded = await readAsset(pin.id, bytes.length);
    if (
      !(downloaded instanceof Uint8Array) ||
      downloaded.length !== bytes.length ||
      hash(downloaded) !== hash(bytes)
    )
      fail('Downloaded optional artifact differs.');
  };
  expected = await guard();
  // Detect every conflicting pre-existing asset before any new POST.
  for (const [name, bytes] of frozen)
    if (expected.has(name)) await verifyBytes(expected.get(name), bytes);
  await guard();
  const order = [...frozen.keys()].filter((name) => name !== 'optional-packages.json');
  order.push('optional-packages.json');
  const delivered = [];
  for (const name of order) {
    const bytes = frozen.get(name);
    await guard();
    if (expected.has(name)) {
      delivered.push({ ...expected.get(name), status: 'EXISTING_VERIFIED' });
      continue;
    }
    const url = new URL(endpoint);
    url.searchParams.set('name', name);
    await record({ releaseId, name, status: 'POST_STARTED', uploadURL: url.href });
    try {
      const uploaded = assetPin(await uploadAsset(url.href, name, Buffer.from(bytes)));
      const checked = inventory({ assets: [uploaded] }).get(name);
      if (!checked || checked.size !== bytes.length || checked.digest !== `sha256:${hash(bytes)}`)
        fail('Optional upload response differs.');
      expected.set(name, checked);
      await guard();
      await verifyBytes(checked, bytes);
      await guard();
      delivered.push({ ...checked, status: 'UPLOADED_VERIFIED' });
      await record({ releaseId, name, status: 'UPLOADED_VERIFIED', asset: checked });
    } catch (error) {
      await record({ releaseId, name, status: 'OUTCOME_REQUIRES_RECONCILIATION' });
      throw new Error('Optional upload outcome requires reconciliation before another POST.', {
        cause: error,
      });
    }
  }
  await guard();
  return {
    format: 'revealline-optional-package-delivery.v1',
    repository,
    releaseId,
    uploadEndpoint: endpoint,
    version: envelope.version,
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    envelopeSha256: hash(envelopeBytes),
    reviewSha256: hash(reviewBytes),
    assets: delivered,
    status: 'draft-assets-downloaded-and-verified',
  };
}
