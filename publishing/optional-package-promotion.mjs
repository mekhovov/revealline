import { editionHash, inspectEditionZip } from './edition-zip.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from './optional-package-policy.mjs';
import { verifyOptionalPackageReview } from './optional-package-admission.mjs';
const fail = (message) => {
  throw new Error(message);
};
const parse = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const version = /^v\d+\.\d+\.\d+$/,
  sha = /^[a-f0-9]{64}$/;

export function validateOptionalPackagePublication(value) {
  if (
    value?.format !== 'revealline-optional-package-publication.v1' ||
    !Array.isArray(value.releases) ||
    value.releases.length > 64
  )
    fail('Invalid optional package selector.');
  const versions = new Set(),
    active = new Set();
  for (const release of value.releases) {
    if (
      !version.test(release.version) ||
      versions.has(release.version) ||
      !sha.test(release.envelopeSha256) ||
      !sha.test(release.reviewSha256) ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(release.basePath) ||
      !Array.isArray(release.packageIds) ||
      !release.packageIds.length ||
      release.packageIds.length > 8 ||
      new Set(release.packageIds).size !== release.packageIds.length ||
      !Array.isArray(release.activePackageIds)
    )
      fail('Invalid frozen optional package selection.');
    versions.add(release.version);
    for (const id of release.packageIds)
      if (!Object.hasOwn(OPTIONAL_PACKAGE_POLICIES, id)) fail('Unknown selected optional package.');
    for (const id of release.activePackageIds) {
      if (!release.packageIds.includes(id) || active.has(id))
        fail('An optional package has conflicting active launchers.');
      active.add(id);
    }
  }
  return value;
}

/** Return downloaded, independently reviewed bytes only. The default core and
 * company edition overlays keep their own paths, workers and storage. */
export async function frozenOptionalPackageOverlay(
  selector,
  { readReleaseAsset, targetBasePath, resolveReleaseIdentity } = {},
) {
  validateOptionalPackagePublication(selector);
  if (targetBasePath && selector.releases.some((release) => release.basePath !== targetBasePath))
    fail('Optional package belongs to another deployment target.');
  const output = new Map(),
    downloads = new Map(),
    launches = [];
  let total = 0;
  const put = (name, bytes) => {
    total += bytes.length;
    if (output.has(name) || total > 950_000_000)
      fail('Optional publication collides or exceeds the hosted budget.');
    output.set(name, bytes);
  };
  const download = async (version, name, limit) => {
    const key = `${version}/${name}`;
    if (!downloads.has(key))
      downloads.set(key, Promise.resolve(readReleaseAsset(version, name, limit)));
    const bytes = await downloads.get(key);
    if (!(bytes instanceof Uint8Array) || bytes.length > limit)
      fail('Optional release download exceeds its bound.');
    return bytes;
  };
  for (const release of selector.releases) {
    const envelopeBytes = await download(release.version, 'optional-packages.json', 1024 * 1024),
      reviewBytes = await download(release.version, 'optional-package-review.json', 1024 * 1024);
    if (
      editionHash(envelopeBytes) !== release.envelopeSha256 ||
      editionHash(reviewBytes) !== release.reviewSha256
    )
      fail('Optional release metadata differs from its reviewed selector.');
    const envelope = parse(envelopeBytes);
    if (envelope.version !== release.version || typeof resolveReleaseIdentity !== 'function')
      fail('Optional publication needs its independent release tag identity.');
    const identity = await resolveReleaseIdentity(release.version);
    if (
      identity?.sourceRevision !== envelope.sourceRevision ||
      identity?.sourceTree !== envelope.sourceTree
    )
      fail('Optional source differs from its immutable release tag.');
    const read = async (row) => {
      const bytes = await download(release.version, row.path, row.bytes);
      if (bytes.length !== row.bytes || editionHash(bytes) !== row.sha256)
        fail('Optional release artifact bytes differ.');
      return bytes;
    };
    await verifyOptionalPackageReview(envelopeBytes, parse(reviewBytes), { read });
    for (const id of release.packageIds) {
      const item = envelope.packages.find((row) => row.id === id);
      if (!item) fail('Selected optional package is absent from the envelope.');
      const manifestBytes = await read(item.manifest),
        manifest = parse(manifestBytes);
      if (
        manifest.installation.basePath !== release.basePath ||
        manifest.installation.id !== `${release.basePath}practice/${id}/`
      )
        fail('Optional installation identity differs from its deployment target.');
      const members = inspectEditionZip(await read(item.distribution), [
        ...manifest.files,
        {
          path: 'optional-package.json',
          bytes: manifestBytes.length,
          sha256: editionHash(manifestBytes),
        },
      ]);
      const base = `practice/${id}/`,
        site = `${base}releases/${release.version}/site/`;
      for (const [name, bytes] of members) put(site + name, bytes);
      if (release.activePackageIds.includes(id)) {
        for (const [name, bytes] of members)
          if (name.startsWith('launcher/'))
            put(`${base}app/${name.slice('launcher/'.length)}`, bytes);
        put(
          `${base}app/current.json`,
          Buffer.from(
            JSON.stringify({
              id,
              version: release.version,
              scope: `../releases/${release.version}/site/`,
              entry: manifest.entry,
            }) + '\n',
          ),
        );
        const app = parse(members.get('launcher/app.webmanifest'));
        launches.push({
          id,
          name: app.name,
          href: `${id}/app/`,
          version: release.version,
          revision: manifest.revision,
        });
      }
    }
  }
  if (launches.length) {
    put(
      'practice/index.json',
      Buffer.from(
        JSON.stringify({ format: 'revealline-optional-package-launchers.v1', packages: launches }) +
          '\n',
      ),
    );
    const escape = (value) =>
      String(value).replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
      );
    put(
      'practice/index.html',
      Buffer.from(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Optional practice / Додаткова практика</title><style>body{font:1.2rem system-ui;max-width:60rem;padding:2rem;margin:auto}li{padding:1rem}a:focus-visible{outline:3px solid #146}</style><h1>Optional practice / Додаткова практика</h1><p>Each package is opened explicitly and keeps separate installation storage.<br>Кожен пакет відкривається окремо та має власне сховище встановлення.</p><ul>${launches.map((row) => `<li><a href="${escape(row.href)}">${escape(row.name)}</a> · ${escape(row.version)}</li>`).join('')}</ul></html>`,
      ),
    );
  }
  return output;
}

export async function selectRetainedOptionalPackageRelease(
  selector,
  { version: targetVersion, packageIds },
  publication = {},
) {
  validateOptionalPackagePublication(selector);
  const target = selector.releases.find((row) => row.version === targetVersion);
  if (
    !target ||
    !Array.isArray(packageIds) ||
    !packageIds.length ||
    new Set(packageIds).size !== packageIds.length ||
    packageIds.some((id) => !target.packageIds.includes(id))
  )
    fail('Rollback needs explicit packages retained in the selected release.');
  const requested = new Set(packageIds);
  const updated = validateOptionalPackagePublication({
    ...selector,
    releases: selector.releases.map((row) => ({
      ...row,
      activePackageIds:
        row.version === targetVersion
          ? [...new Set([...row.activePackageIds, ...packageIds])]
          : row.activePackageIds.filter((id) => !requested.has(id)),
    })),
  });
  await frozenOptionalPackageOverlay(updated, publication);
  return updated;
}
