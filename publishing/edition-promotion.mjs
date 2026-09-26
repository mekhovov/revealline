import { validateEditionAdmission } from './edition-admission.mjs';
import { editionHash, inspectEditionZip } from './edition-zip.mjs';
import { validateEditionId } from '../game/edition-context.mjs';

export const EDITION_REVIEW_GATES = Object.freeze([
  'automated-validation',
  'content-accuracy',
  'asset-review',
  'human-pacing-and-comprehension',
  'accessibility',
  'installed-pwa-isolation',
  'update-and-rollback',
  'storage-and-backup-recovery',
  'same-device-performance',
]);
const fail = (message) => {
  throw new Error(message);
};
const sha = /^[a-f0-9]{64}$/;
const version = /^v\d+\.\d+\.\d+$/;
const text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const parse = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

export async function verifyEditionReview(envelopeBytes, review, { read } = {}) {
  const envelope = parse(envelopeBytes);
  const admission = await validateEditionAdmission(envelope, { read });
  if (!admission.zipMembersVerified) fail('Promotion requires actual ZIP member verification.');
  if (
    review?.format !== 'revealline-edition-review.v1' ||
    review.envelopeSha256 !== editionHash(envelopeBytes) ||
    review.sourceRevision !== envelope.sourceRevision ||
    review.sourceTree !== envelope.sourceTree ||
    review.version !== envelope.version ||
    review.publication !== 'public' ||
    !Array.isArray(review.editions) ||
    review.editions.length !== envelope.editions.length
  )
    fail('Edition review does not bind these exact frozen artifacts.');
  const selected = new Set();
  for (const row of review.editions) {
    if (
      !envelope.editions.some((entry) => entry.id === row.id) ||
      selected.has(row.id) ||
      !Array.isArray(row.gates) ||
      row.gates.length !== EDITION_REVIEW_GATES.length
    )
      fail('Edition review coverage is incomplete.');
    selected.add(row.id);
    const gates = new Set();
    for (const gate of row.gates) {
      const evidence = gate.evidence;
      if (
        !EDITION_REVIEW_GATES.includes(gate.id) ||
        gates.has(gate.id) ||
        gate.status !== 'passed' ||
        !text(gate.reviewer) ||
        !/^\d{4}-\d{2}-\d{2}T/.test(gate.reviewedAt) ||
        !Number.isFinite(Date.parse(gate.reviewedAt)) ||
        !/^review-[a-z0-9][a-z0-9.-]*\.(?:json|md|txt|png|webp)$/.test(evidence?.path) ||
        evidence.publication !== 'public' ||
        evidence.approved !== true ||
        !Number.isSafeInteger(evidence.bytes) ||
        evidence.bytes <= 0 ||
        evidence.bytes > 8_000_000 ||
        !sha.test(evidence.sha256)
      )
        fail('Every promotion gate needs a reviewed public evidence file.');
      gates.add(gate.id);
      const bytes = await read(evidence);
      if (
        !(bytes instanceof Uint8Array) ||
        bytes.length !== evidence.bytes ||
        editionHash(bytes) !== evidence.sha256
      )
        fail('Promotion evidence bytes changed.');
    }
  }
  return Object.freeze({
    ...admission,
    publicEligible: true,
    reviewSha256: editionHash(Buffer.from(JSON.stringify(review))),
  });
}

/** A reviewed selector adds editions without changing the default release selector. */
export function validateEditionPublication(value) {
  if (
    value?.format !== 'revealline-edition-publication.v1' ||
    !Array.isArray(value.releases) ||
    value.releases.length > 64
  )
    fail('Invalid edition publication selector.');
  const versions = new Set(),
    active = new Set();
  for (const release of value.releases) {
    if (
      !version.test(release.version) ||
      versions.has(release.version) ||
      !sha.test(release.envelopeSha256) ||
      !sha.test(release.reviewSha256) ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(release.basePath) ||
      !Array.isArray(release.editionIds) ||
      !release.editionIds.length ||
      release.editionIds.length > 32 ||
      !Array.isArray(release.activeEditionIds)
    )
      fail('Invalid frozen edition selection.');
    versions.add(release.version);
    const ids = new Set();
    for (const id of release.editionIds) {
      validateEditionId(id);
      if (ids.has(id)) fail('Duplicate selected edition.');
      ids.add(id);
    }
    for (const id of release.activeEditionIds) {
      if (!ids.has(id) || active.has(id)) fail('An edition has conflicting active launchers.');
      active.add(id);
    }
  }
  return value;
}

/** Read/download callbacks supply original bytes. No candidate can enter this map. */
export async function frozenEditionOverlay(
  selector,
  { readReleaseAsset, targetBasePath, resolveReleaseIdentity } = {},
) {
  validateEditionPublication(selector);
  if (targetBasePath && selector.releases.some((release) => release.basePath !== targetBasePath))
    fail('An edition belongs to a different configured deployment target.');
  const output = new Map(),
    launches = [];
  let overlayBytes = 0;
  const downloads = new Map();
  const download = async (version, name, limit) => {
    const key = `${version}/${name}`;
    if (!downloads.has(key))
      downloads.set(key, Promise.resolve(readReleaseAsset(version, name, limit)));
    const bytes = await downloads.get(key);
    if (!(bytes instanceof Uint8Array) || bytes.length > limit)
      fail('Published edition asset exceeds its bounded descriptor.');
    return bytes;
  };
  const put = (name, bytes) => {
    if (output.has(name)) fail('Edition publication paths collide.');
    overlayBytes += bytes.length;
    if (overlayBytes > 950_000_000) fail('Edition overlay exceeds the hosted-site budget.');
    output.set(name, bytes);
  };
  for (const release of selector.releases) {
    const read = async (descriptor) => {
      const bytes = await download(release.version, descriptor.path, descriptor.bytes);
      if (
        !(bytes instanceof Uint8Array) ||
        bytes.length !== descriptor.bytes ||
        editionHash(bytes) !== descriptor.sha256
      )
        fail('Published edition artifact bytes differ from the reviewed selector.');
      return bytes;
    };
    const envelopeBytes = await download(release.version, 'editions.json', 8_000_000);
    const reviewBytes = await download(release.version, 'edition-review.json', 8_000_000);
    if (
      editionHash(envelopeBytes) !== release.envelopeSha256 ||
      editionHash(reviewBytes) !== release.reviewSha256
    )
      fail('Published edition metadata differs from the reviewed selector.');
    const envelope = parse(envelopeBytes);
    if (envelope.version !== release.version) fail('Published edition version differs.');
    if (typeof resolveReleaseIdentity !== 'function')
      fail('Publication requires independent release tag identity.');
    const identity = await resolveReleaseIdentity(release.version);
    if (
      identity?.sourceRevision !== envelope.sourceRevision ||
      identity?.sourceTree !== envelope.sourceTree
    )
      fail('Published edition source differs from the immutable release tag.');
    await verifyEditionReview(envelopeBytes, parse(reviewBytes), { read });
    for (const id of release.editionIds) {
      const edition = envelope.editions.find((entry) => entry.id === id);
      if (!edition) fail('Selected edition is absent from the frozen envelope.');
      const manifestBytes = await read(edition.manifest),
        manifest = parse(manifestBytes);
      const members = inspectEditionZip(await read(edition.distribution), [
        ...manifest.files,
        { path: 'manifest.json', bytes: manifestBytes.length, sha256: editionHash(manifestBytes) },
      ]);
      const base = `editions/${id}/`,
        site = `${base}releases/${release.version}/site/`;
      const app = parse(members.get('app/manifest.webmanifest'));
      if (
        app.id !== `${release.basePath}${base}` ||
        app.scope !== app.id ||
        app.start_url !== `${app.id}app/`
      )
        fail('Frozen installation identity differs from this deployment target.');
      for (const [name, bytes] of members) put(`${site}${name}`, bytes);
      if (release.activeEditionIds.includes(id)) {
        for (const [name, bytes] of members)
          if (name.startsWith('app/') && name !== 'app/current.json') put(`${base}${name}`, bytes);
        put(
          `${base}app/current.json`,
          Buffer.from(
            `${JSON.stringify({ editionId: id, version: release.version, scope: `../releases/${release.version}/site/`, entry: manifest.entry })}\n`,
          ),
        );
        launches.push({ id, name: app.name, href: `${id}/app/`, version: release.version });
      }
    }
  }
  if (launches.length) {
    const escape = (value) =>
      String(value).replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
    put(
      'editions/index.html',
      Buffer.from(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Company journeys</title><style>body{font:1.1rem system-ui;background:#f7f9fc;color:#12213b;max-width:60rem;margin:5rem auto;padding:1.5rem}a{color:#144dab}li{padding:1rem 0}</style><h1>Choose your company journey</h1><p>Each edition keeps its own campaigns, installation and progress.</p><ul>${launches.map((row) => `<li><a href="${escape(row.href)}">${escape(row.name)}</a> · ${escape(row.version)}</li>`).join('')}</ul></html>`,
      ),
    );
  }
  const total = [...output.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (total > 950_000_000) fail('Edition overlay exceeds the hosted-site budget.');
  return output;
}
