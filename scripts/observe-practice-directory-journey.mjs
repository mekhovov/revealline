import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import {
  practiceDirectoryHTML,
  PRACTICE_DIRECTORY_SCRIPT,
} from '../publishing/practice-directory.mjs';
import { validatePracticeDescription } from '../game/optional-practice-details.mjs';
import { validateOptionalPracticeCatalog } from '../game/optional-practice-catalog.mjs';
import { PREVIEW_SECURITY_HEADERS, PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { frozenSource, committedInputMap, verifyCommittedInputs } from './frozen-source.mjs';
import {
  loadFPVObservationArtifact,
  validateFPVArtifactBinding,
  fpvObservationDeadline as deadline,
  closeFPVObservationResources,
} from './fpv-observation-artifact.mjs';
import { acquirePointerResource } from './observe-practice-pointer.mjs';
import {
  unlockObservedPage,
  matchesLaunchedAppURL,
} from './optional-installation-observer-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({
  path: name,
  bytes: bytes.length,
  sha256: sha(bytes),
});
export const DIRECTORY_JOURNEY_PROTOCOL = Object.freeze({
  id: 'practice-directory-full-source-shell.v1',
  caseMs: 90_000,
  overallMs: 600_000,
  actionMs: 10_000,
  viewport: Object.freeze({ width: 1440, height: 900 }),
});
export const DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL = Object.freeze({
  ...DIRECTORY_JOURNEY_PROTOCOL,
  id: 'practice-directory-personal-appearance.v1',
});
export const DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL = Object.freeze({
  ...DIRECTORY_JOURNEY_PROTOCOL,
  id: 'practice-directory-production-personal-appearance.v1',
});
export const DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL = Object.freeze({
  ...DIRECTORY_JOURNEY_PROTOCOL,
  id: 'practice-directory-production-personal-appearance.v2',
});
const productionProtocol = (plan) =>
  [
    DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL.id,
    DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id,
  ].includes(plan.protocol);
export function directoryJourneyProtocol(plan) {
  if (plan.protocol === DIRECTORY_JOURNEY_PROTOCOL.id) return DIRECTORY_JOURNEY_PROTOCOL;
  if (plan.protocol === DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL.id)
    return DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL;
  if (plan.protocol === DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id)
    return DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL;
  assert.equal(plan.protocol, DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.id);
  return DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL;
}
const SHELLS = Object.freeze({
  'civilian-flight': 'gym-shell',
  'civilian-fpv': 'academy-shell',
  'fpv-worlds': 'worlds-shell',
});
export const DIRECTORY_JOURNEY_CASES = Object.freeze(
  ['en', 'uk'].flatMap((locale) =>
    Object.keys(SHELLS).map((id) =>
      Object.freeze({
        id: `${locale}-${id}`,
        package: id,
        locale,
        shell: SHELLS[id],
      }),
    ),
  ),
);
const AUTHORITY = [
  'scripts/observe-practice-directory-journey.mjs',
  'scripts/fpv-observation-artifact.mjs',
  'scripts/observe-practice-pointer.mjs',
  'scripts/optional-installation-observer-helpers.mjs',
  'scripts/frozen-source.mjs',
  'scripts/game-cli.mjs',
  'publishing/practice-directory.mjs',
  'publishing/edition-zip.mjs',
  'publishing/optional-package-admission.mjs',
  'publishing/optional-package-policy.mjs',
];

export function validateDirectoryJourneyPlan(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  assert(text && Buffer.byteLength(text) <= 65536, 'Directory plan exceeds 64 KiB.');
  const plan = JSON.parse(text);
  const fields = [
    'format',
    'protocol',
    'caseId',
    'deviceLabel',
    'quietWindow',
    'cases',
    'bundle',
    'envelopeSha256',
    'sourceRevision',
    'sourceTree',
    'packageRevision',
    'shellRevision',
    'shellTree',
  ];
  assert(plan && !Array.isArray(plan) && typeof plan === 'object');
  directoryJourneyProtocol(plan);
  const production = productionProtocol(plan);
  const independentObserver = plan.protocol === DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id;
  if (independentObserver) {
    fields.push('observerRevision', 'observerTree');
    for (const key of ['observerRevision', 'observerTree'])
      assert.match(plan[key], /^[a-f0-9]{40}$/);
  }
  if (production) {
    fields.push('distribution', 'distributionManifestSha256');
    assert(
      typeof plan.distribution === 'string' &&
        plan.distribution.length <= 4096 &&
        !/[\x00-\x1f]/.test(plan.distribution) &&
        path.isAbsolute(plan.distribution),
      'Use a bounded absolute production distribution directory.',
    );
    assert.match(plan.distributionManifestSha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(Object.keys(plan).sort(), fields.sort(), 'Unexpected directory plan fields.');
  const personal = directoryJourneyProtocol(plan) === DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL;
  assert.equal(
    plan.format,
    production
      ? independentObserver
        ? 'revealline-practice-directory-production-personal-appearance-plan.v2'
        : 'revealline-practice-directory-production-personal-appearance-plan.v1'
      : personal
        ? 'revealline-practice-directory-personal-appearance-plan.v1'
        : 'revealline-practice-directory-journey-plan.v1',
  );
  assert.match(plan.caseId, /^[a-z0-9-]{1,64}$/);
  for (const key of ['shellRevision', 'shellTree']) assert.match(plan[key], /^[a-f0-9]{40}$/);
  for (const [key, max] of [
    ['deviceLabel', 256],
    ['quietWindow', 2048],
  ])
    assert(typeof plan[key] === 'string' && plan[key].trim() && plan[key].length <= max);
  assert.deepEqual(
    plan.cases,
    DIRECTORY_JOURNEY_CASES.map((c) => c.id),
    'Declare all six ordered source-shell cases.',
  );
  validateFPVArtifactBinding(plan);
  assert(path.isAbsolute(plan.bundle), 'Use an absolute admitted candidate path.');
  return plan;
}

/** V1 keeps its original checkout==shell requirement. V2 separately pins the
 * clean observer checkout and resolves the original build commit's actual tree.
 * Neither route substitutes source files for generated distribution members.
 */
export function verifyDirectoryJourneySources(plan, root = ROOT) {
  const independentObserver = plan.protocol === DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id;
  const observer = {
    sourceRevision: independentObserver ? plan.observerRevision : plan.shellRevision,
    sourceTree: independentObserver ? plan.observerTree : plan.shellTree,
  };
  assert.deepEqual(frozenSource(root), observer, 'Frozen observer source mismatch.');
  if (independentObserver) {
    for (const key of ['shellRevision', 'shellTree']) assert.match(plan[key], /^[a-f0-9]{40}$/);
    const resolve = (ref) =>
      execFileSync('git', ['rev-parse', '--verify', ref], {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 4096,
      }).trim();
    assert.equal(
      resolve(`${plan.shellRevision}^{commit}`),
      plan.shellRevision,
      'Original shell revision must identify an exact commit.',
    );
    assert.equal(
      resolve(`${plan.shellRevision}^{tree}`),
      plan.shellTree,
      'Original shell commit tree mismatch.',
    );
  }
  return observer;
}

// These are local observation bounds, not publisher/hosting eligibility limits.
const DISTRIBUTION_LIMITS = Object.freeze({
  files: 20000,
  totalBytes: 2 * 1024 ** 3,
  fileBytes: 128 * 1024 ** 2,
  manifestBytes: 8 * 1024 ** 2,
});
function distributionMember(name) {
  assert(
    typeof name === 'string' &&
      name.length > 0 &&
      name.length <= 1024 &&
      !/[\\\x00-\x1f]/.test(name) &&
      !path.isAbsolute(name) &&
      name.split('/').every((part) => part && !part.startsWith('.')),
    'Unsafe production manifest member.',
  );
  return name;
}
async function distributionTarget(root, name, expectedBytes) {
  distributionMember(name);
  const target = path.join(root, name);
  assert.equal(await realpath(target), target, 'Production member symlink refused.');
  const info = await stat(target);
  assert(
    info.isFile() && info.size === expectedBytes,
    'Production member missing or size changed.',
  );
  return target;
}
async function boundedDistributionBytes(target, limit) {
  const chunks = [];
  let count = 0;
  for await (const chunk of createReadStream(target, {
    signal: AbortSignal.timeout(30000),
  })) {
    count += chunk.length;
    assert(count <= limit, 'Production file exceeded read bound.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, count);
}
/** Verify the original generated manifest and every original member before
 * serving. Hash sequential streams rather than retaining a whole distribution.
 * The external manifest pin is supplied by the build owner, never synthesized.
 */
export async function verifyDirectoryDistribution(plan) {
  assert(productionProtocol(plan));
  assert(path.isAbsolute(plan.distribution));
  const root = await realpath(plan.distribution);
  assert((await stat(root)).isDirectory());
  const manifestPath = path.join(root, 'manifest.json');
  assert.equal(await realpath(manifestPath), manifestPath, 'Manifest symlink refused.');
  const info = await stat(manifestPath);
  assert(info.isFile() && info.size > 0 && info.size <= DISTRIBUTION_LIMITS.manifestBytes);
  const manifestBytes = await boundedDistributionBytes(
    manifestPath,
    DISTRIBUTION_LIMITS.manifestBytes,
  );
  assert(manifestBytes.length <= DISTRIBUTION_LIMITS.manifestBytes);
  assert.equal(
    sha(manifestBytes),
    plan.distributionManifestSha256,
    'Production manifest pin mismatch.',
  );
  const manifest = JSON.parse(manifestBytes);
  assert.deepEqual(Object.keys(manifest).sort(), [
    'entry',
    'files',
    'formatVersion',
    'sourceRevision',
    'totalBytes',
    'version',
  ]);
  assert.equal(manifest.formatVersion, 1);
  assert.equal(
    manifest.sourceRevision,
    plan.shellRevision,
    'Production source differs from frozen shell source.',
  );
  assert.match(manifest.version, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
  assert.equal(manifest.entry, 'game/index.html');
  assert(
    Number.isSafeInteger(manifest.totalBytes) &&
      manifest.totalBytes > 0 &&
      manifest.totalBytes <= DISTRIBUTION_LIMITS.totalBytes,
  );
  assert(
    Array.isArray(manifest.files) &&
      manifest.files.length > 0 &&
      manifest.files.length <= DISTRIBUTION_LIMITS.files,
  );
  const files = new Map();
  let total = 0;
  for (const row of manifest.files) {
    assert(row && typeof row === 'object');
    assert.deepEqual(Object.keys(row).sort(), ['bytes', 'path', 'sha256']);
    distributionMember(row.path);
    assert(
      row.path !== 'manifest.json' && !files.has(row.path),
      'Duplicate/self-referential production member.',
    );
    assert(
      Number.isSafeInteger(row.bytes) &&
        row.bytes >= 0 &&
        row.bytes <= DISTRIBUTION_LIMITS.fileBytes,
    );
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    total += row.bytes;
    assert(total <= DISTRIBUTION_LIMITS.totalBytes);
    files.set(row.path, { ...row });
  }
  assert.equal(total, manifest.totalBytes);
  assert(
    files.has('game/index.html') && files.has('game/build-info.json'),
    'Production entry/build-info missing.',
  );
  const signal = AbortSignal.timeout(120000);
  for (const row of files.values()) {
    signal.throwIfAborted();
    const target = await distributionTarget(root, row.path, row.bytes);
    const hash = createHash('sha256');
    let count = 0;
    for await (const chunk of createReadStream(target, { signal })) {
      count += chunk.length;
      assert(count <= row.bytes, 'Production member grew while hashing.');
      hash.update(chunk);
    }
    assert.equal(count, row.bytes);
    assert.equal(hash.digest('hex'), row.sha256, `Production member hash mismatch: ${row.path}`);
  }
  const verified = { root, manifest, manifestBytes, files };
  const buildInfo = JSON.parse(
    await readDirectoryDistributionFile(verified, 'game/build-info.json'),
  );
  assert.deepEqual(buildInfo, {
    formatVersion: 1,
    version: manifest.version,
    sourceRevision: manifest.sourceRevision,
    entry: manifest.entry,
  });
  assert.equal(
    sha(await boundedDistributionBytes(manifestPath, DISTRIBUTION_LIMITS.manifestBytes)),
    plan.distributionManifestSha256,
    'Production manifest changed during verification.',
  );
  return verified;
}
export async function readDirectoryDistributionFile(distribution, name) {
  const row =
    name === 'manifest.json' ? pin(name, distribution.manifestBytes) : distribution.files.get(name);
  assert(row, 'Not a verified production distribution member.');
  const target = await distributionTarget(distribution.root, name, row.bytes);
  const bytes = await boundedDistributionBytes(target, row.bytes);
  assert.equal(bytes.length, row.bytes);
  assert.equal(sha(bytes), row.sha256, 'Production member changed before serving.');
  return bytes;
}

/** Local selection fixture only. Full envelope admission precedes this function;
 * neither reviews nor publisher/selector state are created or changed. */
export async function directoryJourneyOverlay(plan) {
  const loaded = await loadFPVObservationArtifact(plan);
  const envelopeBytes = await readFile(path.resolve(plan.bundle, 'optional-packages.json'));
  assert.equal(sha(envelopeBytes), plan.envelopeSha256, 'Envelope changed after admission.');
  const envelope = JSON.parse(envelopeBytes);
  assert.deepEqual(envelope.packages.map((p) => p.id).sort(), Object.keys(SHELLS).sort());
  const files = new Map(),
    packages = [],
    details = [];
  const put = (name, bytes) => {
    assert(!files.has(name));
    files.set(name, Buffer.from(bytes));
  };
  for (const item of envelope.packages) {
    const archive = await readFile(path.resolve(plan.bundle, item.distribution.path));
    assert.equal(archive.length, item.distribution.bytes);
    assert.equal(sha(archive), item.distribution.sha256);
    const members = readEditionZip(archive),
      base = `practice/${item.id}/`,
      site = `${base}releases/${envelope.version}/site/`;
    for (const [name, bytes] of members) {
      put(site + name, bytes);
      if (name.startsWith('launcher/')) put(base + 'app/' + name.slice(9), bytes);
    }
    put(
      base + 'app/current.json',
      JSON.stringify({
        id: item.id,
        version: envelope.version,
        scope: `../releases/${envelope.version}/site/`,
        entry: item.entry,
      }),
    );
    const manifest = JSON.parse(members.get('optional-package.json'));
    const description = validatePracticeDescription(
      JSON.parse(members.get(`optional-practice/${item.id}/package-info.json`)),
      item.id,
    );
    packages.push({
      id: item.id,
      name: JSON.parse(members.get('launcher/app.webmanifest')).name,
      href: item.id + '/app/',
      version: envelope.version,
      revision: item.revision,
    });
    const packageBase = `${item.id}/releases/${envelope.version}/site/optional-practice/${item.id}/`;
    details.push({
      id: item.id,
      revision: item.revision,
      description,
      preview: packageBase + 'preview.png',
      guide: packageBase + 'guide.html',
      downloadBytes: item.distribution.bytes,
      offlineBytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
    });
  }
  validateOptionalPracticeCatalog(
    { format: 'revealline-optional-package-launchers.v1', packages },
    'http://localhost/revealline/practice/index.json',
  );
  put(
    'practice/index.json',
    JSON.stringify({
      format: 'revealline-optional-package-launchers.v1',
      packages,
    }),
  );
  put(
    'practice/details.json',
    JSON.stringify({
      format: 'revealline-practice-details.v1',
      packages: details,
    }),
  );
  put('practice/index.html', practiceDirectoryHTML(packages, details));
  put('practice/directory.mjs', PRACTICE_DIRECTORY_SCRIPT);
  return { loaded, files, packages, details };
}

export function directorySourcePath(raw) {
  const pathname = decodeURIComponent(raw.split('?')[0]);
  assert(pathname.startsWith('/revealline/'), 'Outside local fixture root.');
  assert(!/[\\\x00-\x1f]/.test(pathname), 'Unsafe source path.');
  const segments = pathname.slice(12).split('/');
  assert(
    segments.every((p) => !p.startsWith('.') && p !== '..'),
    'Private source path.',
  );
  if (segments.at(-1) === '') segments[segments.length - 1] = 'index.html';
  return segments.join('/');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
};
const PRODUCTION_MIME = {
  ...MIME,
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};
export async function directoryJourneyServer(overlay, tree, report, distribution = null) {
  const security = distribution ? PUBLIC_SECURITY_HEADERS : PREVIEW_SECURITY_HEADERS;
  if (distribution)
    assert(
      [...overlay.keys()].every((name) => name.startsWith('practice/')),
      'Only the explicit practice fixture may overlay production.',
    );
  const served = new Map();
  const server = createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, distribution ? security : undefined);
        res.end();
        return;
      }
      const name = directorySourcePath(req.url);
      let bytes = overlay.get(name);
      if (!bytes && distribution) {
        bytes = await readDirectoryDistributionFile(distribution, name);
        if (!served.has(name)) {
          const value = pin(name, bytes);
          served.set(name, value);
          (report.servedDistribution ??= []).push(value);
        }
      } else if (!bytes) {
        assert(
          /^(game|site|optional-practice|authoring|docs)\//.test(name),
          'Not a public source file.',
        );
        assert(tree.get(name), 'Not a committed regular file.');
        const target = path.join(ROOT, name);
        bytes = await readFile(target);
        verifyCommittedInputs(new Map([[name, bytes]]), tree);
        if (!served.has(name)) {
          const value = pin(name, bytes);
          served.set(name, value);
          report.servedSources.push(value);
        }
      }
      res.writeHead(200, {
        'content-type':
          (distribution ? PRODUCTION_MIME : MIME)[path.extname(name)] ?? 'application/octet-stream',
        'content-length': bytes.length,
        'cache-control': 'no-store',
        ...security,
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (report.requestFailures.length < 100)
        report.requestFailures.push({
          path: String(req.url).split('?')[0],
          message: error.message,
        });
      res.writeHead(404, {
        'content-type': 'text/plain',
        ...security,
      });
      res.end(
        distribution
          ? 'Not a verified production member.'
          : 'Not part of the source-shell fixture.',
      );
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
const closeServer = ({ server }) =>
  new Promise((resolve, reject) => {
    server.close((e) => (e ? reject(e) : resolve()));
    server.closeAllConnections?.();
  });

export function assertDirectoryLink(href, { origin, id, locale, play }) {
  const url = new URL(href);
  assert.equal(url.origin, origin);
  assert(
    !url.username && !url.password && !url.hash,
    'Launcher must be a plain same-origin route.',
  );
  assert.equal(url.pathname, `/revealline/practice/${id}/app/`);
  assert.equal(url.searchParams.get('lang'), locale);
  assert.equal(url.searchParams.get('action'), play ? 'play' : null);
  const keys = [...url.searchParams.keys()];
  assert.equal(new Set(keys).size, keys.length);
  assert(
    keys.every((k) => ['lang', 'action', 'appearanceFamily', 'appearanceRevision'].includes(k)),
  );
  const family = url.searchParams.get('appearanceFamily'),
    revision = url.searchParams.get('appearanceRevision');
  if (family !== null || revision !== null) {
    assert.match(family ?? '', /^[a-z][a-z0-9-]{0,63}$/);
    assert.match(revision ?? '', /^r[1-9][0-9]{0,8}$/);
  }
  return {
    href: url.href,
    appearanceFamily: family,
    appearanceRevision: revision,
  };
}

export async function openDirectoryPopup(page, link) {
  // Attach both rejection handlers before the click can settle. A late popup
  // rejection after a failed click must not terminate evidence/cleanup.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    Promise.resolve().then(() => link.click()),
  ]);
  return popup;
}
export function assertDirectoryPageCount(context, expected) {
  assert.equal(context.pages().length, expected, 'Unexpected extra or missing browser tab.');
}
export function validatePersonalAppearanceWitness(witness) {
  assert.equal(witness.family, 'tryzub');
  assert.equal(witness.interface, 'tryzub');
  for (const key of ['appearance', 'sim'])
    assert(
      typeof witness[key] === 'string' && witness[key].length <= 1024,
      'Missing or oversized appearance preference witness.',
    );
  assert.deepEqual(JSON.parse(witness.appearance), {
    familyId: 'tryzub',
    arcadeArt: 'follow-game',
    highContrast: false,
    opaqueHud: false,
    ornaments: 'theme',
  });
  assert.deepEqual(JSON.parse(witness.sim), {
    format: 'SimAppearancePreferences.v1',
    interface: 'follow-game',
    world: 'follow-game',
  });
  return witness;
}
export async function observePersonalAppearance(page) {
  await page
    .locator('html[data-theme-family="tryzub"][data-interface-theme="tryzub"]')
    .waitFor({ state: 'visible' });
  // Read only the two public preference records. No storage mutation or runtime API calls.
  return validatePersonalAppearanceWitness(
    await page.evaluate(() => {
      const read = (key) => {
        const value = localStorage.getItem(key);
        if (value !== null && value.length > 1024)
          throw new Error('Oversized appearance preference.');
        return value;
      };
      return {
        family: globalThis.document.documentElement.dataset.themeFamily,
        interface: globalThis.document.documentElement.dataset.interfaceTheme,
        appearance: read('revealline.appearance.v2'),
        sim: read('revealline.fpv.appearance.v1'),
      };
    }),
  );
}
export function assertPersonalAppearanceURL(href) {
  const url = new URL(href);
  for (const key of ['appearanceFamily', 'appearanceRevision'])
    assert.equal(
      url.searchParams.has(key),
      false,
      'Personal preferences must not invent an edition appearance URL pin.',
    );
}
export async function openMainGamePractice(page, activate, onPersonalAppearance = null) {
  await activate(page, '#shell-options');
  await page.locator('#settings-dialog[open]').waitFor({ state: 'visible' });
  if (onPersonalAppearance) {
    await activate(page, '#settings-tab-display');
    await page.locator('#settings-panel-display').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#theme-card-tryzub').getAttribute('aria-pressed'), 'false');
    await activate(page, '#theme-card-tryzub');
    assert.equal(await page.locator('#theme-card-tryzub').getAttribute('aria-pressed'), 'true');
    await onPersonalAppearance();
  }
  await activate(page, '#settings-tab-extras');
  await activate(page, '#shell-home-practice');
}

async function runJourney(page, spec, fixture, report, output, password) {
  const result = {
    ...spec,
    passed: false,
    actions: [],
    errors: [],
    access: [],
  };
  report.cases.push(result);
  const runtimeRequests = [];
  page.context().on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/practice\/[^/]+\/releases\/[^/]+\/site\/.*\.(?:mjs|js)$/.test(pathname))
      runtimeRequests.push(pathname);
  });
  const { url, packages, details, version } = fixture;
  const root = new URL('revealline/', url),
    main = new URL(`game/?lang=${spec.locale}`, root).href;
  const observe = (value) =>
    value.on('pageerror', (e) => {
      if (result.errors.length < 20) result.errors.push(e.message);
    });
  observe(page);
  const access = async (p, label) => {
    const witness = await unlockObservedPage(p, password);
    result.access.push({ surface: label, formSubmitted: witness });
  };
  const click = async (p, selector) => {
    const target = p.locator(selector);
    await target.waitFor({ state: 'visible' });
    assert(await target.isEnabled());
    result.actions.push({ selector, action: 'ordinary pointer click' });
    await target.click();
  };
  const screenshot = async (p, name) => {
    const bytes = await p.screenshot({ timeout: 5000 });
    await writeFile(path.join(output, name), bytes, { flag: 'wx' });
    (result.screenshots ??= []).push(pin(name, bytes));
  };
  try {
    await page.goto(main, { waitUntil: 'domcontentloaded' });
    await access(page, 'main game');
    result.unlocked = true;
    await page.locator('#shell-home[open]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('html').getAttribute('lang'), spec.locale);
    const personal = [
      DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.id,
      DIRECTORY_PRODUCTION_APPEARANCE_PROTOCOL.id,
      DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id,
    ].includes(report.protocol.id);
    await openMainGamePractice(
      page,
      click,
      personal
        ? async () => {
            result.personalAppearance = {
              main: await observePersonalAppearance(page),
            };
            await screenshot(page, spec.id + '-main-appearance.png');
          }
        : null,
    );
    const dialog = page.locator('#optional-practice-dialog[open]');
    await dialog.waitFor({ state: 'visible' });
    const rows = dialog.locator('.optional-practice-packages > li');
    await page.waitForFunction(
      () =>
        globalThis.document.querySelectorAll(
          '#optional-practice-dialog .optional-practice-packages > li',
        ).length === 3,
    );
    assert.equal(await rows.count(), 3);
    for (let i = 0; i < packages.length; i++) {
      const item = packages[i],
        detail = details.find((d) => d.id === item.id),
        row = rows.nth(i),
        copy = detail.description.copy[spec.locale];
      assert.equal((await row.locator('h3').innerText()).trim(), copy.name);
      const paragraphs = await row.locator('p').allInnerTexts();
      assert.deepEqual(
        paragraphs,
        ['description', 'purpose', 'inputs', 'requirements'].map((k) => copy[k]),
      );
      assert.equal(
        (await row.locator('small').innerText()).trim(),
        `${version} · ${(detail.downloadBytes / 1048576).toFixed(1)} MiB`,
      );
      const image = row.locator('img');
      assert.equal(await image.count(), 1);
      assert.equal(
        await image.getAttribute('src'),
        new URL(detail.preview, new URL('practice/', root)).href,
      );
      await image.scrollIntoViewIfNeeded();
      await page.waitForFunction((i) => {
        const image = globalThis.document.querySelectorAll(
          '#optional-practice-dialog .optional-practice-packages > li img',
        )[i];
        return image?.complete && image.naturalWidth > 0;
      }, i);
      for (const [index, play] of [
        [0, true],
        [1, false],
      ]) {
        const link = row.locator('a').nth(index);
        assert.equal(await link.getAttribute('target'), '_blank');
        assert((await link.getAttribute('rel')).split(/\s+/).includes('noopener'));
        assertDirectoryLink(await link.getAttribute('href'), {
          origin: root.origin,
          id: item.id,
          locale: spec.locale,
          play,
        });
      }
    }
    result.cardsVerified = 3;
    result.runtimeRequestsBeforePlay = [...runtimeRequests];
    assert.equal(runtimeRequests.length, 0, 'Browsing fetched optional executable modules.');
    await screenshot(page, spec.id + '-directory.png');
    const row = rows.nth(packages.findIndex((p) => p.id === spec.package)),
      play = row.locator('a').nth(0);
    result.playLink = assertDirectoryLink(await play.getAttribute('href'), {
      origin: root.origin,
      id: spec.package,
      locale: spec.locale,
      play: true,
    });
    if (personal) assertPersonalAppearanceURL(result.playLink.href);
    const app = await openDirectoryPopup(page, play);
    observe(app);
    result.playActions = 1;
    await access(app, 'practice launcher');
    const expected = new URL(
      `practice/${spec.package}/releases/${version}/site/optional-practice/${spec.package}/index.html`,
      root,
    ).href;
    await app.waitForURL((u) => matchesLaunchedAppURL(u.href, expected, spec.locale));
    await access(app, 'practice app');
    await app.locator(`#${spec.shell}-home-dialog[open]`).waitFor({ state: 'visible' });
    await app.locator(`#${spec.shell}-action-primary`).waitFor({ state: 'visible' });
    assertDirectoryPageCount(page.context(), 2);
    result.app = {
      url: app.url(),
      locale: await app.locator('html').getAttribute('lang'),
      phase: await app.locator(`[data-mode-play-shell="${spec.shell}"]`).getAttribute('data-phase'),
    };
    assert.equal(result.app.locale, spec.locale);
    assert(
      ['ready', 'disarmed'].includes(result.app.phase),
      'A directory Play action must not arm a flight.',
    );
    for (const key of ['appearanceFamily', 'appearanceRevision'])
      assert.equal(
        new URL(app.url()).searchParams.get(key),
        new URL(result.playLink.href).searchParams.get(key),
      );
    if (personal) {
      assertPersonalAppearanceURL(app.url());
      result.personalAppearance.app = await observePersonalAppearance(app);
      assert.deepEqual(result.personalAppearance.app, result.personalAppearance.main);
      result.personalAppearance.scope =
        'Personal preference transfer; no edition URL-pin qualification.';
    }
    await screenshot(app, spec.id + '-app-home.png');
    await app.close();
    assertDirectoryPageCount(page.context(), 1);
    await page.bringToFront();
    result.returnToGame = 'Closed practice tab; original main-game directory stays open.';
    const detailLink = row.locator('a').nth(1);
    const launcher = await openDirectoryPopup(page, detailLink);
    observe(launcher);
    await access(launcher, 'details launcher');
    await launcher.locator('#guide').waitFor({ state: 'visible' });
    const guideExpected = new URL(
      `practice/${spec.package}/releases/${version}/site/optional-practice/${spec.package}/guide.html?lang=${spec.locale}`,
      root,
    ).href;
    assert.equal(await launcher.locator('#guide').getAttribute('href'), guideExpected);
    const directoryExpected = new URL(`practice/?lang=${spec.locale}`, root).href;
    assert.equal(await launcher.locator('#directory').getAttribute('href'), directoryExpected);
    await click(launcher, '#guide');
    await launcher.waitForURL(guideExpected);
    await access(launcher, 'player guide');
    await launcher.locator(`section[lang="${spec.locale}"] h1`).waitFor({ state: 'visible' });
    assertDirectoryPageCount(page.context(), 2);
    assert.equal(await launcher.locator('html').getAttribute('lang'), spec.locale);
    result.guide = {
      url: launcher.url(),
      heading: await launcher.locator(`section[lang="${spec.locale}"] h1`).innerText(),
    };
    await screenshot(launcher, spec.id + '-guide.png');
    await click(launcher, '#directory');
    await launcher.waitForURL(directoryExpected);
    await launcher.locator('article').first().waitFor({ state: 'visible' });
    assert.equal(await launcher.locator('article').count(), 3);
    assert.equal(await launcher.locator('html').getAttribute('lang'), spec.locale);
    result.standaloneDirectory = true;
    const mainLink = launcher.locator('nav a[data-locale]').first();
    assert.equal(await mainLink.getAttribute('href'), main);
    await mainLink.click();
    await launcher.waitForURL(main);
    await access(launcher, 'main-game return');
    await launcher.locator('#shell-home[open]').waitFor({ state: 'visible' });
    assert.equal(await launcher.locator('html').getAttribute('lang'), spec.locale);
    result.mainGameReturn = true;
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.failure = error.message;
    if (result.unlocked)
      await screenshot(page, spec.id + '-failure.png').catch(() => {
        result.screenshotUnavailable = true;
      });
  }
  return result;
}

export async function observePracticeDirectoryJourney({
  planFile,
  playwrightModule,
  output,
  password = process.env.OPTIONAL_INSTALLATION_PASSWORD,
} = {}) {
  assert(planFile && playwrightModule && output);
  assert((await stat(planFile)).size <= 65536);
  const planBytes = await readFile(planFile),
    plan = validateDirectoryJourneyPlan(planBytes.toString());
  const production = productionProtocol(plan);
  const independentObserver = plan.protocol === DIRECTORY_PRODUCTION_APPEARANCE_V2_PROTOCOL.id;
  const personal = production || plan.protocol === DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.id;
  await mkdir(output);
  const scrub = (s) => (password ? String(s).split(password).join('[REDACTED]') : String(s));
  const report = {
    format: production
      ? independentObserver
        ? 'PracticeDirectoryProductionPersonalAppearanceObservation.v2'
        : 'PracticeDirectoryProductionPersonalAppearanceObservation.v1'
      : plan.protocol === DIRECTORY_PERSONAL_APPEARANCE_PROTOCOL.id
        ? 'PracticeDirectoryPersonalAppearanceObservation.v1'
        : 'PracticeDirectoryJourneyObservation.v1',
    plan,
    protocol: directoryJourneyProtocol(plan),
    createdAt: new Date().toISOString(),
    completed: false,
    qualified: false,
    cases: [],
    authority: [],
    servedSources: [],
    requestFailures: [],
    resourceAcquisitions: [],
    limitations: [
      ...(production
        ? [
            'Requires original generated distribution member hashes verified before and after observation; only the explicitly reported admitted practice catalogue/release fixture overlays it. No source-shell fallback.',
            'Production security headers apply. This local observation does not assess hosted capacity, publish a release, or supply human review approval.',
          ]
        : [
            'Full unchanged committed main-game source shell, not a minimal panel host and not a completed production distribution build.',
            'This protocol does not build a production distribution. Sparse-checkout exclusions must be distinguished from genuinely missing committed build inputs; no build, hosting or release-review guard is weakened.',
          ]),
      'Locally admitted practice package bytes with an explicit unpublished catalogue/current.json fixture; not a reviewed selector or public release.',
      'Six EN/UK one-Play start-screen and guide/navigation journeys only; no arming, exercise, installation, human learning or physical accessibility qualification.',
      personal
        ? 'Fixed Tryzub personal preference transfer through visible Settings only. Null edition URL pins are expected; positive compiled-edition URL-pair qualification remains open. No all-theme or rendered-world qualification.'
        : 'Default validated appearance handoff only, not all appearance themes or physical inputs.',
    ],
  };
  let server, browser, distribution;
  try {
    await writeFile(path.join(output, 'plan.json'), planBytes, { flag: 'wx' });
    await mkdir(path.join(output, 'authority'));
    for (const name of AUTHORITY) {
      const bytes = await readFile(path.join(ROOT, name));
      report.authority.push(pin(name, bytes));
      await writeFile(path.join(output, 'authority', path.basename(name)), bytes, { flag: 'wx' });
    }
    const observerSource = verifyDirectoryJourneySources(plan);
    if (independentObserver)
      report.observerSource = {
        ...observerSource,
        verifiedBefore: true,
        verifiedAfter: false,
      };
    const tree = committedInputMap(ROOT),
      overlay = await deadline(
        directoryJourneyOverlay(plan),
        60_000,
        'Directory package admission',
      );
    report.artifact = overlay.loaded.binding;
    report.admission = overlay.loaded.admission;
    report.overlay = [...overlay.files].map(([name, bytes]) => pin(name, bytes));
    if (production) {
      distribution = await verifyDirectoryDistribution(plan);
      report.distribution = {
        directory: distribution.root,
        manifest: pin('manifest.json', distribution.manifestBytes),
        sourceRevision: distribution.manifest.sourceRevision,
        sourceTree: plan.shellTree,
        sourceTreeAuthority: independentObserver
          ? 'Original shell commit resolved independently to its exact Git tree; generated build manifest records original revision only.'
          : 'Frozen source binding; generated build manifest records revision only.',
        version: distribution.manifest.version,
        entry: distribution.manifest.entry,
        totalBytes: distribution.manifest.totalBytes,
        originalFiles: [...distribution.files.values()],
        securityHeaders: PUBLIC_SECURITY_HEADERS,
        originalsVerifiedBefore: true,
        originalsVerifiedAfter: false,
      };
      await writeFile(path.join(output, 'production-manifest.json'), distribution.manifestBytes, {
        flag: 'wx',
      });
    }
    server = await acquirePointerResource(
      report.resourceAcquisitions,
      'server',
      () => directoryJourneyServer(overlay.files, tree, report, distribution),
      closeServer,
    );
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
    browser = await acquirePointerResource(
      report.resourceAcquisitions,
      'browser',
      () => chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000 }),
      (b) => b.close(),
      35_000,
    );
    report.browser = browser.version();
    const end = Date.now() + DIRECTORY_JOURNEY_PROTOCOL.overallMs;
    for (const spec of DIRECTORY_JOURNEY_CASES) {
      let context, pending;
      try {
        assert(Date.now() < end, 'Directory journey overall deadline exceeded.');
        context = await acquirePointerResource(
          report.resourceAcquisitions,
          spec.id + '-context',
          () =>
            browser.newContext({
              viewport: DIRECTORY_JOURNEY_PROTOCOL.viewport,
              locale: spec.locale === 'uk' ? 'uk-UA' : 'en-US',
            }),
          (c) => c.close(),
        );
        const page = await acquirePointerResource(
          report.resourceAcquisitions,
          spec.id + '-page',
          () => context.newPage(),
          (p) => p.close(),
        );
        page.setDefaultTimeout(DIRECTORY_JOURNEY_PROTOCOL.actionMs);
        page.setDefaultNavigationTimeout(30_000);
        pending = runJourney(
          page,
          spec,
          {
            url: server.url,
            packages: overlay.packages,
            details: overlay.details,
            version: overlay.loaded.binding.version,
          },
          report,
          output,
          password,
        );
        await deadline(
          pending,
          Math.min(DIRECTORY_JOURNEY_PROTOCOL.caseMs, end - Date.now()),
          spec.id,
        );
      } catch (error) {
        const result = report.cases.find((c) => c.id === spec.id) ?? {
          ...spec,
          passed: false,
        };
        if (!report.cases.includes(result)) report.cases.push(result);
        result.failure = scrub(error.message);
        result.passed = false;
      } finally {
        if (context) await deadline(context.close(), 10_000, 'Directory case cleanup');
        if (pending)
          await deadline(
            pending.catch(() => {}),
            10_000,
            'Directory case termination',
          );
        const result = report.cases.find((c) => c.id === spec.id);
        if (result?.failure) result.passed = false;
        if (result)
          await writeFile(
            path.join(output, spec.id + '.json'),
            scrub(JSON.stringify(result, null, 2)) + '\n',
            { flag: 'wx' },
          );
      }
    }
    if (production) {
      await verifyDirectoryDistribution(plan);
      report.distribution.originalsVerifiedAfter = true;
    }
    for (const source of [...report.authority, ...report.servedSources])
      assert.equal(
        sha(await readFile(path.join(ROOT, source.path))),
        source.sha256,
        'Source changed during journey.',
      );
    verifyDirectoryJourneySources(plan);
    if (independentObserver) report.observerSource.verifiedAfter = true;
    report.procedureComplete = true;
  } catch (error) {
    report.failure = scrub(error.message);
  } finally {
    report.cleanup = await closeFPVObservationResources([
      ...(browser ? [['browser', () => browser.close()]] : []),
      ...(server ? [['server', () => closeServer(server)]] : []),
    ]);
    if (report.resourceAcquisitions.some((r) => r.pending || (r.timedOut && !r.lateClosed)))
      report.cleanup.completed = false;
    report.completed = Boolean(
      report.procedureComplete &&
        !report.failure &&
        report.cleanup.completed &&
        report.cases.length === 6 &&
        report.cases.every((c) => c.passed && !c.failure),
    );
    await writeFile(
      path.join(output, 'observation.json'),
      scrub(JSON.stringify(report, null, 2)) + '\n',
      { flag: 'wx' },
    );
  }
  return JSON.parse(scrub(JSON.stringify(report)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [planFile, playwrightModule, output, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  const result = await observePracticeDirectoryJourney({
    planFile,
    playwrightModule,
    output,
  });
  console.log(
    JSON.stringify({
      completed: result.completed,
      cases: result.cases.length,
      qualified: false,
    }),
  );
  if (!result.completed) process.exitCode = 1;
}
