import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { loadOptionalPracticeCatalog } from '../game/optional-practice-catalog.mjs';
import { loadPracticeDetails } from '../game/optional-practice-details.mjs';
import { validateOptionalInstallationReference } from '../optional-practice/install-context.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';

/** Post-publication byte check. Missing catalogue is a release failure, not empty. */
export async function verifyPracticeSite({
  baseURL,
  expectedIds,
  fetcher = globalThis.fetch,
} = {}) {
  const base = new URL(baseURL);
  if (
    !/^https?:$/.test(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !base.pathname.endsWith('/')
  )
    throw new Error('Use an absolute site directory URL.');
  const indexURL = new URL('practice/index.json', base).href;
  const packages = await loadOptionalPracticeCatalog(indexURL, {
    fetcher,
    missingIsEmpty: false,
    signal: AbortSignal.timeout(30000),
  });
  if (
    JSON.stringify(packages.map((item) => item.id).sort()) !==
    JSON.stringify([...expectedIds].sort())
  )
    throw new Error('Published catalogue differs from the selected package IDs.');
  const { details } = await loadPracticeDetails(indexURL, packages, {
    fetcher,
    signal: AbortSignal.timeout(30000),
  });
  async function read(url, limit) {
    const response = await fetcher(url, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Published asset unavailable: ' + url);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Bounded download required');
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > limit) throw new Error('Published asset exceeds bound');
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks);
  }
  const checked = [];
  for (const item of packages) {
    const policy = OPTIONAL_PACKAGE_POLICIES[item.id];
    if (!policy || !details.has(item.id))
      throw new Error('Published package metadata missing or unknown.');
    const pointer = validateOptionalInstallationReference(
      JSON.parse(await read(new URL('current.json', item.url).href, 4096)),
      { packageId: item.id, root: new URL('../', item.url).pathname, baseURL: item.url },
    );
    if (pointer.version !== item.version)
      throw new Error('Launcher version differs from catalogue.');
    const manifest = JSON.parse(
      await read(new URL('optional-package.json', pointer.scope).href, 1024 * 1024),
    );
    if (
      manifest.id !== item.id ||
      manifest.revision !== item.revision ||
      !Array.isArray(manifest.files) ||
      manifest.files.length > policy.limits.files
    )
      throw new Error('Published manifest identity or count differs.');
    let total = 0;
    const paths = new Set();
    for (const file of manifest.files) {
      if (
        !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(file.path) ||
        paths.has(file.path) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(file.sha256)
      )
        throw new Error('Invalid published file pin.');
      paths.add(file.path);
      total += file.bytes;
      if (total > policy.limits.bytes)
        throw new Error('Published package exceeds its byte budget.');
      const bytes = await read(new URL(file.path, pointer.scope).href, file.bytes);
      if (
        bytes.length !== file.bytes ||
        createHash('sha256').update(bytes).digest('hex') !== file.sha256
      )
        throw new Error('Published dependency bytes differ: ' + file.path);
      if (file.path.startsWith('launcher/')) {
        const stable = await read(new URL(file.path.slice(9), item.url).href, file.bytes);
        if (!stable.equals(bytes))
          throw new Error('Stable launcher differs from selected version.');
      }
    }
    checked.push({
      id: item.id,
      version: item.version,
      revision: item.revision,
      files: paths.size,
      bytes: total,
    });
  }
  return { indexURL, checked, missingCatalogueIsFailure: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3)
    throw new Error('Usage: node scripts/verify-practice-site.mjs SITE_ROOT_URL');
  const selector = JSON.parse(
    await readFile(
      new URL('../publishing/pages-controller/optional-packages.json', import.meta.url),
      'utf8',
    ),
  );
  console.log(
    JSON.stringify(
      await verifyPracticeSite({
        baseURL: process.argv[2],
        expectedIds: selector.releases.flatMap((release) => release.activePackageIds),
      }),
      null,
      2,
    ),
  );
}
