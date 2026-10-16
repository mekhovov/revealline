import { createHash } from 'node:crypto';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { parse } from 'acorn';

const repository = 'mekhovov/revealline';
const basePath = '/revealline/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const fail = (message) => {
  throw new Error(message);
};

/** Trusted-controller adapter only. Callbacks must perform read-only API/download
 * operations; neither this adapter nor its renderer is loaded from a candidate. */
export async function freezeCandidateOverlay(input, { api, readAsset, renderOverlay } = {}) {
  const { frozenOptionalPackageOverlay, validateOptionalPackagePublication } = await import(
    '../publishing/optional-package-promotion.mjs'
  );
  renderOverlay ??= frozenOptionalPackageOverlay;
  const selectorBytes =
    input instanceof Uint8Array ? Buffer.from(input) : Buffer.from(JSON.stringify(input));
  if (!selectorBytes.length || selectorBytes.length > 1024 * 1024)
    fail('Optional selector exceeds its bound.');
  const selector = validateOptionalPackagePublication(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(selectorBytes)),
  );
  if (selector.releases.some((release) => release.basePath !== basePath))
    fail('Optional selector belongs to another deployment target.');
  if (typeof api !== 'function' || typeof readAsset !== 'function')
    fail('Trusted optional release readers are required.');

  const releases = new Map();
  const assets = new Map();
  let totalDownloaded = 0;
  for (const selected of selector.releases) {
    if (selected.version.length > 64) fail('Optional release version exceeds its bound.');
    const release = await api(`repos/${repository}/releases/tags/${selected.version}`);
    if (
      !positive(release?.id) ||
      release.draft !== false ||
      release.prerelease !== false ||
      release.tag_name !== selected.version ||
      !Array.isArray(release.assets) ||
      release.assets.length > 1000
    )
      fail('Optional release is not an existing public stable release.');
    const ids = new Set();
    const names = new Set();
    for (const asset of release.assets) {
      if (
        !positive(asset?.id) ||
        typeof asset.name !== 'string' ||
        !asset.name.length ||
        asset.name.length > 400 ||
        names.has(asset.name) ||
        ids.has(asset.id)
      )
        fail('Optional release asset identity is ambiguous.');
      ids.add(asset.id);
      names.add(asset.name);
    }
    const commit = await api(`repos/${repository}/commits/tags/${selected.version}`);
    if (!/^[a-f0-9]{40}$/.test(commit?.sha) || !/^[a-f0-9]{40}$/.test(commit.commit?.tree?.sha))
      fail('Optional release tag has no exact commit/tree identity.');
    releases.set(selected.version, {
      release,
      identity: {
        version: selected.version,
        releaseId: release.id,
        tag: release.tag_name,
        sourceRevision: commit.sha,
        sourceTree: commit.commit.tree.sha,
      },
    });
  }
  const overlay = await renderOverlay(selector, {
    targetBasePath: basePath,
    resolveReleaseIdentity: async (version) => {
      const row = releases.get(version);
      if (!row) fail('Optional renderer requested an unselected release.');
      return { sourceRevision: row.identity.sourceRevision, sourceTree: row.identity.sourceTree };
    },
    readReleaseAsset: async (version, name, limit) => {
      const row = releases.get(version);
      if (!row || !positive(limit) || limit > 950_000_000)
        fail('Optional renderer requested an unselected or unbounded asset.');
      const asset = row.release.assets.find((item) => item.name === name);
      if (!asset || asset.state !== 'uploaded' || !positive(asset.size) || asset.size > limit)
        fail('Optional release asset is absent, incomplete or exceeds its bound.');
      const key = `${version}/${name}`;
      if (!assets.has(key)) {
        const original = await readAsset({
          repository,
          version,
          name,
          id: asset.id,
          size: asset.size,
          limit,
          releaseId: row.release.id,
        });
        if (!(original instanceof Uint8Array) || original.length !== asset.size)
          fail('Optional release download length differs from its frozen asset.');
        const bytes = Buffer.from(original);
        totalDownloaded += bytes.length;
        if (totalDownloaded > 950_000_000) fail('Optional downloads exceed their aggregate bound.');
        assets.set(key, {
          bytes,
          identity: { name, assetId: asset.id, bytes: bytes.length, sha256: hash(bytes) },
        });
      }
      const cached = assets.get(key).bytes;
      if (cached.length > limit) fail('Optional cached asset exceeds its requested bound.');
      return Buffer.from(cached);
    },
  });
  if (!(overlay instanceof Map) || !overlay.size || overlay.size > 20000)
    fail('Optional overlay is incomplete.');
  let totalOverlay = 0;
  const files = [...overlay]
    .sort(([a], [b]) => compare(a, b))
    .map(([path, bytes]) => {
      if (
        typeof path !== 'string' ||
        path.length > 500 ||
        !/^practice\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(path) ||
        !(bytes instanceof Uint8Array)
      )
        fail('Optional overlay contains an unsafe member.');
      totalOverlay += bytes.length;
      if (totalOverlay > 950_000_000) fail('Optional overlay exceeds its aggregate bound.');
      return { path, bytes: bytes.length, sha256: hash(bytes) };
    });
  return {
    overlay,
    identity: {
      format: 'revealline-pages-candidate-overlay.v1',
      repository,
      basePath,
      selectorSha256: hash(selectorBytes),
      releases: [...releases.values()]
        .sort((a, b) => compare(a.identity.version, b.identity.version))
        .map((row) => ({
          ...row.identity,
          assets: [...assets]
            .filter(([key]) => key.startsWith(`${row.identity.version}/`))
            .map(([, asset]) => asset.identity)
            .sort((a, b) => compare(a.name, b.name)),
        })),
      files,
    },
  };
}

/** Redownload and rerender, not just a comparison of mutable API metadata. */
export async function recheckCandidateOverlay(selector, expectedIdentity, options) {
  const current = await freezeCandidateOverlay(selector, options);
  if (JSON.stringify(current.identity) !== JSON.stringify(expectedIdentity)) {
    const error = new Error('Frozen optional overlay identities or bytes changed.');
    error.code = 'CANDIDATE_OVERLAY_STALE';
    throw error;
  }
  return current;
}

/** Enumerate trusted source dependencies without importing or executing them.
 * readSource must read the frozen controller tree, never candidate files.
 * Bare packages are recorded separately; the caller freezes package/lock files. */
export async function trustedImportClosure(entry, { readSource } = {}) {
  if (typeof readSource !== 'function') fail('A trusted source reader is required.');
  const validPath = (name) =>
    typeof name === 'string' &&
    name.length <= 500 &&
    /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*\.(?:mjs|js|json)$/.test(name);
  const paths = new Set();
  const packages = new Set();
  const visit = async (file) => {
    if (!validPath(file)) fail('Unsupported trusted import path.');
    if (paths.has(file)) return;
    paths.add(file);
    if (paths.size > 256) fail('Trusted import closure exceeds its file bound.');
    const source = await readSource(file);
    if (typeof source !== 'string' || Buffer.byteLength(source) > 8 * 1024 * 1024)
      fail('Trusted import source is absent or exceeds its bound.');
    if (file.endsWith('.json')) {
      JSON.parse(source);
      return;
    }
    const imports = new Set();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (
        ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
          node.type,
        ) &&
        node.source
      )
        imports.add(node.source.value);
      if (node.type === 'ImportExpression') {
        if (node.source.type !== 'Literal' || typeof node.source.value !== 'string')
          fail('Nonliteral dynamic import is unsupported in the trusted closure.');
        imports.add(node.source.value);
      }
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'require'
      )
        fail('CommonJS require is unsupported in the trusted closure.');
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
      }
    };
    walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
    for (const specifier of [...imports].sort(compare)) {
      if (typeof specifier !== 'string' || !specifier.length || specifier.length > 500)
        fail('Unsupported trusted import specifier.');
      if (isBuiltin(specifier)) continue;
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        await visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
      } else {
        if (!/^(?:@[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(specifier))
          fail('Unsupported external trusted import.');
        packages.add(specifier);
      }
    }
  };
  await visit(entry);
  return { paths: [...paths].sort(compare), packages: [...packages].sort(compare) };
}
