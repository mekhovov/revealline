import { createHash } from 'node:crypto';
import { inspectEditionZip } from './edition-zip.mjs';
import { validateEditionId } from '../game/edition-context.mjs';

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const runtimeAuthoring = new Set([
  'authoring/motion-lab/animation.mjs',
  'authoring/motion-lab/render-character.mjs',
]);
// Inspected public local-development template; changed bytes require another review.
const publicSourceExamples = new Map([
  [
    'services/community/.env.example',
    'f0a1bf0db9905c51c8eaa4054a8a98bc91ea648ceb6cf45ebebeb46eed3ba42f',
  ],
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
const safePath = (name, { source = false } = {}) => {
  if (
    typeof name !== 'string' ||
    name.length > 400 ||
    !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name) ||
    name
      .split('/')
      .some(
        (part) =>
          part === '.' || part === '..' || part === '.git' || (!source && part.startsWith('.')),
      )
  )
    fail('Invalid edition artifact path.');
  return name;
};
const bytesOf = (value) => {
  if (!(value instanceof Uint8Array)) fail('Original artifact bytes are required.');
  return value;
};
function verifyDescriptor(descriptor, bytes) {
  safePath(descriptor?.path);
  if (
    !Number.isSafeInteger(descriptor.bytes) ||
    descriptor.bytes < 0 ||
    !SHA.test(descriptor.sha256)
  )
    fail('Invalid edition artifact descriptor.');
  bytesOf(bytes);
  if (bytes.byteLength !== descriptor.bytes || digest(bytes) !== descriptor.sha256)
    fail(`Edition artifact bytes differ: ${descriptor.path}`);
}

/** Check selected runtime bytes; source eligibility is a separate whole-source gate below. */
export function validateEditionSourceInventory({
  files,
  assets = [],
  publication = 'public',
} = {}) {
  if (
    !(files instanceof Map) ||
    files.size > 20000 ||
    !Array.isArray(assets) ||
    assets.length > 20000 ||
    publication !== 'public'
  )
    fail('Public edition source inventory is required.');
  for (const [name, bytes] of files) {
    safePath(name);
    bytesOf(bytes);
    if (
      /(?:^|\/)(?:research|private|credentials|secrets|originals|raw|history)(?:\/|\.)|(?:^|\/)studio\.json$|^authoring\//i.test(
        name,
      ) &&
      !runtimeAuthoring.has(name)
    )
      fail(`Source-only material cannot enter a public edition: ${name}`);
  }
  const seen = new Set();
  for (const asset of assets) {
    if (asset.publication !== 'public' || asset.approved !== true)
      fail(`Asset is not approved for public distribution: ${asset.path}`);
    if (seen.has(asset.path)) fail('Duplicate publication asset.');
    seen.add(asset.path);
    verifyDescriptor(asset, files.get(asset.path));
  }
  return Object.freeze({
    format: 'revealline-edition-source-eligibility.v1',
    publication,
    files: files.size,
    assets: assets.length,
  });
}

/** Inspect every declared brand source before git archive, including unselected brands. */
export function validatePublicSourceEligibility({ files, assets = [] } = {}) {
  if (!(files instanceof Map) || !Array.isArray(assets))
    fail('Source archive inventory is required.');
  for (const [name, bytes] of files) {
    safePath(name, { source: true });
    bytesOf(bytes);
    if (publicSourceExamples.has(name)) {
      if (digest(bytes) !== publicSourceExamples.get(name))
        fail('Public environment example changed; review its source eligibility.');
      continue;
    }
    if (
      /(?:^|\/)(?:credentials|secrets|private)(?:\/|\.)|(?:^|\/)(?:id_rsa|id_ed25519|credentials\.json|\.env(?:\..*)?)$/i.test(
        name,
      )
    )
      fail(`Private source path cannot be published: ${name}`);
  }
  const seen = new Set();
  for (const asset of assets) {
    if (asset.publication !== 'public' || asset.approved !== true)
      fail(`Source archive contains an unapproved asset: ${asset.path}`);
    if (seen.has(asset.path)) fail('Duplicate source asset.');
    seen.add(asset.path);
    verifyDescriptor(asset, files.get(asset.path));
  }
  for (const name of files.keys())
    if (
      /^(?:game\/(?:editions|company-campaigns)|authoring\/brands)\/.*\.(?:png|jpe?g|webp|svg|mp3|ogg|wav|mp4|ttf|otf|woff2?)$/i.test(
        name,
      ) &&
      !seen.has(name)
    )
      fail(`Company source media has no public eligibility record: ${name}`);
  return Object.freeze({
    format: 'revealline-public-source-eligibility.v1',
    files: files.size,
    assets: assets.length,
  });
}

const json = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const embedded = (path, bytes) => ({ path, bytes: bytes.length, sha256: digest(bytes) });
function inventory(body, limit = 800_000_000) {
  if (!Array.isArray(body.files) || !body.files.length || body.files.length > 19999)
    fail('Invalid edition file inventory.');
  const names = new Set();
  let total = 0;
  for (const row of body.files) {
    safePath(row.path);
    if (
      names.has(row.path) ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes < 0 ||
      !SHA.test(row.sha256)
    )
      fail('Invalid edition file descriptor.');
    names.add(row.path);
    total += row.bytes;
  }
  if (body.totalBytes !== total || total > limit)
    fail('Edition inventory exceeds its byte budget.');
  return { files: names.size, totalBytes: total };
}

/** Additive candidate admission. Every original ZIP member is inspected; human
 * release qualification is separate and cannot be inferred from byte integrity. */
export async function validateEditionAdmission(envelope, { read } = {}) {
  if (
    !envelope ||
    envelope.format !== 'revealline-editions.v1' ||
    !/^v\d+\.\d+\.\d+$/.test(envelope.version) ||
    !COMMIT.test(envelope.sourceRevision) ||
    !COMMIT.test(envelope.sourceTree) ||
    !Array.isArray(envelope.editions) ||
    !envelope.editions.length ||
    envelope.editions.length > 32 ||
    typeof read !== 'function'
  )
    fail('Invalid edition release envelope.');
  const names = new Set(),
    paths = new Set(),
    rows = [];
  for (const edition of envelope.editions) {
    validateEditionId(edition.id);
    if (names.has(edition.id)) fail('Duplicate release edition.');
    names.add(edition.id);
    if (
      !SHA.test(edition.contentSha256) ||
      !Array.isArray(edition.packs) ||
      !edition.packs.length ||
      edition.packs.length > 2000
    )
      fail('Missing edition content identity.');
    const packs = new Set();
    for (const pack of edition.packs) {
      validateEditionId(pack.id);
      if (
        packs.has(pack.id) ||
        typeof pack.revision !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(pack.revision) ||
        !SHA.test(pack.sha256)
      )
        fail('Invalid immutable campaign identity.');
      packs.add(pack.id);
    }
    const specifications = [
      ['manifest', `manifest-${edition.id}.json`, 8_000_000],
      ['distribution', `distribution-${edition.id}.zip`, 950_000_000],
      ['sourceInventory', `source-inventory-${edition.id}.json`, 8_000_000],
      ['sourceArchive', `source-${edition.id}.zip`, 950_000_000],
    ];
    const originals = {};
    for (const [role, name, limit] of specifications) {
      const descriptor = edition[role];
      if (descriptor?.path !== name || descriptor.bytes > limit || paths.has(name))
        fail('Edition release artifact is missing, duplicate or over budget.');
      paths.add(name);
      const bytes = await read(descriptor);
      verifyDescriptor(descriptor, bytes);
      originals[role] = bytes;
    }
    const manifest = json(originals.manifest),
      source = json(originals.sourceInventory);
    for (const body of [manifest, source])
      if (
        body.editionId !== edition.id ||
        body.version !== envelope.version ||
        body.sourceRevision !== envelope.sourceRevision ||
        body.sourceTree !== envelope.sourceTree ||
        body.contentSha256 !== edition.contentSha256
      )
        fail('Edition source binding differs.');
    if (
      manifest.format !== 'revealline-edition-manifest.v1' ||
      manifest.entry !== 'game/company.html' ||
      source.format !== 'revealline-edition-source-inventory.v1' ||
      source.kind !== 'selected-original-inputs' ||
      source.publication !== 'public' ||
      source.eligible !== true ||
      !Array.isArray(source.assets)
    )
      fail('Source inventory has not passed public eligibility.');
    const counts = inventory(manifest);
    inventory(source);
    const runtime = inspectEditionZip(originals.distribution, [
      ...manifest.files,
      embedded('manifest.json', originals.manifest),
    ]);
    const sourceFiles = inspectEditionZip(originals.sourceArchive, [
      ...source.files,
      embedded('source-inventory.json', originals.sourceInventory),
    ]);
    if (
      !runtime.has(manifest.entry) ||
      !runtime.has('edition-catalog.json') ||
      digest(runtime.get('edition-catalog.json')) !== edition.contentSha256
    )
      fail('Edition catalog identity differs.');
    const catalog = json(runtime.get('edition-catalog.json'));
    if (
      catalog.editions?.length !== 1 ||
      catalog.editions[0].id !== edition.id ||
      !Array.isArray(catalog.campaigns) ||
      catalog.campaigns.length !== packs.size ||
      !Array.isArray(catalog.assets)
    )
      fail('Runtime edition closure differs.');
    for (const pack of edition.packs) {
      const campaign = catalog.campaigns.find((item) => item.id === pack.id);
      if (
        !campaign ||
        campaign.revision !== pack.revision ||
        !runtime.has(campaign.sourcePath) ||
        digest(runtime.get(campaign.sourcePath)) !== pack.sha256 ||
        !sourceFiles.has(campaign.sourcePath) ||
        digest(sourceFiles.get(campaign.sourcePath)) !== pack.sha256
      )
        fail('Campaign revision bytes differ.');
    }
    validateEditionSourceInventory({ files: runtime, assets: catalog.assets });
    validatePublicSourceEligibility({ files: runtime, assets: catalog.assets });
    validateEditionSourceInventory({ files: sourceFiles, assets: source.assets });
    validatePublicSourceEligibility({ files: sourceFiles, assets: source.assets });
    if (JSON.stringify(source.assets) !== JSON.stringify(catalog.assets))
      fail('Source asset closure differs.');
    rows.push(
      Object.freeze({
        id: edition.id,
        ...counts,
        distributionSha256: edition.distribution.sha256,
        sourceArchiveSha256: edition.sourceArchive.sha256,
      }),
    );
  }
  return Object.freeze({
    format: 'revealline-editions-admission.v1',
    version: envelope.version,
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    editions: Object.freeze(rows),
    status: 'verified-candidate-members',
    zipMembersVerified: true,
    publicEligible: false,
  });
}
