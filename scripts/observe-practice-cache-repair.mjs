/** C7 only: explicit faults in a disposable profile, never a publisher or repair service. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';
import { startServer } from './game-cli.mjs';
import { acquirePointerResource } from './observe-practice-pointer.mjs';
import {
  fpvObservationDeadline as deadline,
  closeFPVObservationResources,
} from './fpv-observation-artifact.mjs';
import {
  OBSERVED_PACKAGES,
  activateOfflineAction,
  unlockObservedPage,
  revealFPVOffline,
} from './optional-installation-observer-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) });
export const CACHE_REPAIR_IDS = Object.freeze(Object.keys(OBSERVED_PACKAGES));
export const CACHE_REPAIR_PROTOCOL = 'practice-cache-repair.v1';
export const CACHE_REPAIR_SEEDED_PROTOCOL = 'practice-cache-repair.v2';
const WORLD_SEED = 'worlds-template-copy';
const WORLD_SEED_TITLE = 'C7 retained world';
const LIMIT_MS = 900_000;
const CONTINUITY = 'authoring/fpv-worlds/storage-continuity/observe.mjs';
const AUTHORITY = [
  'scripts/observe-practice-cache-repair.mjs',
  'scripts/observe-practice-pointer.mjs',
  'scripts/fpv-observation-artifact.mjs',
  'scripts/optional-installation-observer-helpers.mjs',
  'scripts/game-cli.mjs',
  'publishing/optional-package-admission.mjs',
  'publishing/optional-package-policy.mjs',
  'publishing/edition-zip.mjs',
  CONTINUITY,
];

export function validateCacheRepairPlan(input) {
  const encoded = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 65536)
    throw new Error('Cache repair plan exceeds 64 KiB.');
  const plan = JSON.parse(encoded);
  const seeded = plan?.format === 'PracticeCacheRepairPlan.v2';
  const fields = [
    'format',
    'protocol',
    'caseId',
    'bundle',
    'envelopeSha256',
    'sourceRevision',
    'sourceTree',
    'packages',
    ...(seeded ? ['seed'] : []),
  ];
  if (
    !plan ||
    Array.isArray(plan) ||
    typeof plan !== 'object' ||
    Object.keys(plan).some((key) => !fields.includes(key)) ||
    fields.some((key) => !Object.hasOwn(plan, key)) ||
    (!seeded && plan.format !== 'PracticeCacheRepairPlan.v1') ||
    plan.protocol !== (seeded ? CACHE_REPAIR_SEEDED_PROTOCOL : CACHE_REPAIR_PROTOCOL) ||
    (seeded && plan.seed !== WORLD_SEED) ||
    typeof plan.caseId !== 'string' ||
    !/^[a-z0-9-]{1,64}$/.test(plan.caseId) ||
    typeof plan.bundle !== 'string' ||
    !plan.bundle.trim() ||
    plan.bundle.length > 4096 ||
    !/^[a-f0-9]{64}$/.test(plan.envelopeSha256) ||
    !/^[a-f0-9]{40}$/.test(plan.sourceRevision) ||
    !/^[a-f0-9]{40}$/.test(plan.sourceTree) ||
    !plan.packages ||
    Array.isArray(plan.packages) ||
    typeof plan.packages !== 'object' ||
    Object.keys(plan.packages).length !== 3 ||
    CACHE_REPAIR_IDS.some(
      (id) => typeof plan.packages[id] !== 'string' || !/^[a-f0-9]{64}$/.test(plan.packages[id]),
    )
  )
    throw new Error('An exact three-package cache repair plan is required.');
  return plan;
}

/** Read-only receipt assertion; empty stores never establish saved-world preservation. */
export function assertCacheRepairWorldSeed(state, expectedCard) {
  assert(
    typeof state.card?.id === 'string' &&
      state.card.id.length > 0 &&
      state.card.id.length <= 256 &&
      state.card.title === WORLD_SEED_TITLE,
    'The visible saved world card must have its original identity and authored title.',
  );
  if (expectedCard) {
    assert.equal(state.card.id, expectedCard.id, 'The original saved world must remain listed.');
    assert.equal(state.card.title, expectedCard.title);
  }
  const database = state.records?.databases?.find((row) => row.name === 'revealline-fpv-worlds-v1');
  assert(database && !database.missing, 'The saved World Studio database must exist.');
  for (const name of ['projects', 'revisions']) {
    const store = database.stores?.find((row) => row.name === name);
    assert(
      store &&
        Number.isInteger(store.count) &&
        store.count > 0 &&
        store.rows?.length === store.count &&
        /^[a-f0-9]{64}$/.test(store.sha256) &&
        store.rows.every(
          (row) => /^[a-f0-9]{64}$/.test(row.key) && /^[a-f0-9]{64}$/.test(row.sha256),
        ),
      `A fingerprinted nonempty World Studio ${name} store is required.`,
    );
  }
  return database;
}

export async function admitCacheRepairBundle(plan, base) {
  const root = await realpath(path.resolve(base, plan.bundle)),
    originals = new Map();
  async function read(name, bound) {
    const file = await realpath(path.resolve(root, name)),
      info = await stat(file);
    assert(
      file.startsWith(root + path.sep) && info.isFile() && info.size <= bound,
      'Artifact path or size invalid.',
    );
    const bytes = await readFile(file);
    assert(bytes.length <= bound, 'Artifact exceeded read bound.');
    originals.set(file, pin(name, bytes));
    return bytes;
  }
  const bytes = await read('optional-packages.json', 1024 * 1024);
  assert.equal(hash(bytes), plan.envelopeSha256, 'Envelope hash differs.');
  const envelope = JSON.parse(bytes),
    admitted = new Map();
  assert.equal(envelope.sourceRevision, plan.sourceRevision);
  assert.equal(envelope.sourceTree, plan.sourceTree);
  await validateOptionalPackageAdmission(envelope, {
    read: async (item) => {
      if (!admitted.has(item.path)) admitted.set(item.path, await read(item.path, item.bytes));
      return admitted.get(item.path);
    },
  });
  assert.equal(envelope.packages.length, 3, 'C7 requires exactly the three admitted apps.');
  const packages = CACHE_REPAIR_IDS.map((id) => {
    const item = envelope.packages.find((row) => row.id === id);
    assert.equal(item?.revision, plan.packages[id], `Package revision differs: ${id}`);
    return { item, files: readEditionZip(admitted.get(item.distribution.path)) };
  });
  return { envelope, originals, packages };
}

export function cacheRepairSpec(id, version, origin) {
  assert(CACHE_REPAIR_IDS.includes(id) && /^v\d+\.\d+\.\d+$/.test(version));
  const host = new URL(origin);
  assert.equal(host.hostname, '127.0.0.1', 'Only the isolated localhost server is allowed.');
  assert.equal(host.protocol, 'http:');
  const root = `/revealline/practice/${id}/`,
    site = `${root}releases/${version}/site/`;
  const scope = new URL(`${site}optional-practice/${id}/`, host).href;
  return {
    id,
    root,
    site,
    scope,
    entry: scope + 'index.html',
    launcher: new URL(root + 'app/', host).href,
    cachePrefix: `revealline.optional.${id === 'civilian-flight' ? 'civilian-flight' : 'package'}.v1:${new URL(scope).pathname}:`,
    pointerKey: `revealline.optional-installed.${id}.${encodeURIComponent(root)}.v1`,
  };
}

/** Browser-side, read only. Inspect only the named app's exact cache family. */
export async function readCacheRepairState(spec) {
  if (new URL(spec.scope).origin !== globalThis.location.origin)
    throw new Error('Foreign scope refused.');
  const digest = async (bytes) =>
    [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
  const caches = [];
  for (const name of (await globalThis.caches.keys())
    .filter((key) => key.startsWith(spec.cachePrefix))
    .sort()) {
    const cache = await globalThis.caches.open(name),
      rows = [];
    let total = 0;
    for (const request of await cache.keys()) {
      const response = await cache.match(request),
        bytes = await response.arrayBuffer();
      total += bytes.byteLength;
      if (total > 128 * 1024 * 1024 || rows.length >= 4096)
        throw new Error('Observed cache exceeds bounds.');
      rows.push({ url: request.url, bytes: bytes.byteLength, sha256: await digest(bytes) });
    }
    rows.sort((a, b) => a.url.localeCompare(b.url));
    caches.push({ name, rows });
  }
  const registrations = (await globalThis.navigator.serviceWorker.getRegistrations())
    .filter((row) => row.scope === spec.scope)
    .map((row) => ({
      scope: row.scope,
      scriptURL: row.active?.scriptURL ?? null,
      active: row.active?.state ?? null,
    }));
  const pointer = globalThis.localStorage.getItem(spec.pointerKey);
  const parsed = JSON.parse(pointer ?? '{}');
  return {
    id: spec.id,
    caches,
    registrations,
    hasReference: Boolean(parsed.active || parsed.previous),
    pointerSha256: pointer === null ? null : await digest(new TextEncoder().encode(pointer)),
  };
}

/** Deliberate fault injection only, after exact cache/member/worker observations. */
export async function injectCacheRepairFault({ kind, spec, cacheName, expected }) {
  const scope = new URL(spec.scope),
    allowed = ['civilian-flight', 'civilian-fpv', 'fpv-worlds'];
  const version = scope.pathname.match(
    /^\/revealline\/practice\/([a-z-]+)\/releases\/(v\d+\.\d+\.\d+)\/site\/optional-practice\/([a-z-]+)\/$/,
  );
  const family = spec.id === 'civilian-flight' ? 'civilian-flight' : 'package';
  if (
    !allowed.includes(spec.id) ||
    scope.hostname !== '127.0.0.1' ||
    scope.protocol !== 'http:' ||
    scope.origin !== globalThis.location.origin ||
    !version ||
    version[1] !== spec.id ||
    version[3] !== spec.id ||
    spec.cachePrefix !== `revealline.optional.${family}.v1:${scope.pathname}:`
  )
    throw new Error('Fault target is not an exact owned review scope.');
  if (kind === 'missing-worker') {
    const registrations = (await globalThis.navigator.serviceWorker.getRegistrations()).filter(
      (row) => row.scope === spec.scope,
    );
    if (
      registrations.length !== 1 ||
      registrations[0].active?.scriptURL !== spec.scope + 'worker.js'
    )
      throw new Error('Exact active worker required before injected unregister.');
    if (!(await registrations[0].unregister()))
      throw new Error('Injected unregister did not succeed.');
    return { kind, scope: spec.scope, unregistered: true };
  }
  if (
    kind !== 'missing-dependency' ||
    !cacheName?.startsWith(spec.cachePrefix) ||
    expected?.url !== spec.scope + 'index.html' ||
    !/^[a-f0-9]{64}$/.test(expected.sha256)
  )
    throw new Error('Exactly one verified owned entry dependency is required.');
  if (!(await globalThis.caches.keys()).includes(cacheName))
    throw new Error('Observed cache disappeared.');
  const cache = await globalThis.caches.open(cacheName),
    response = await cache.match(expected.url);
  if (!response) throw new Error('Fault dependency was already missing.');
  const bytes = await response.arrayBuffer();
  const sha256 = [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (bytes.byteLength !== expected.bytes || sha256 !== expected.sha256)
    throw new Error('Fault dependency changed before injection.');
  if (!(await cache.delete(expected.url)))
    throw new Error('Injected cache deletion did not succeed.');
  return { kind, cacheName, deleted: expected };
}

export function assertCacheRepairPreservation(before, after, target) {
  for (const id of CACHE_REPAIR_IDS.filter((id) => id !== target))
    assert.deepEqual(after.apps[id], before.apps[id], `Unrelated app changed: ${id}`);
  assert.deepEqual(
    after.records,
    before.records,
    'Observed records changed during cache operation.',
  );
}

const closeServer = (served) =>
  new Promise((resolve, reject) => {
    served.server.close((error) => (error ? reject(error) : resolve()));
    served.server.closeAllConnections?.();
  });

export async function observePracticeCacheRepair({
  planFile,
  playwrightModule,
  output,
  password = process.env.OPTIONAL_INSTALLATION_PASSWORD,
}) {
  assert(
    planFile && playwrightModule && output,
    'Plan, external Playwright module and NEW output directory required.',
  );
  assert((await stat(planFile)).size <= 65536, 'Plan exceeds byte bound.');
  const planBytes = await readFile(planFile),
    plan = validateCacheRepairPlan(planBytes.toString());
  await mkdir(output);
  const scrub = (value) =>
    password ? String(value).split(password).join('[redacted]') : String(value);
  const save = (name, data) => writeFile(path.join(output, name), data, { flag: 'wx' });
  const report = {
    format: plan.seed ? 'PracticeCacheRepairObservation.v2' : 'PracticeCacheRepairObservation.v1',
    plan,
    createdAt: new Date().toISOString(),
    passed: false,
    procedureComplete: false,
    faults: [],
    checks: [],
    errors: [],
    resourceAcquisitions: [],
    authority: [],
    scope:
      'C7 modeled cache-entry loss and exact worker unregister in a fresh owned Chrome profile; ordinary keyboard-activated offline UI. No native eviction, real quota, physical device, first-pointer, human flight, process-restart or public deployment qualification. Empty stores are not nonempty content-preservation evidence. Data coverage is limited to the four existing FPV continuity databases and revealline.flight-profiles.v1. Gym records and other localStorage keys are not observed.',
    input: {
      offlineActions: 'Ordinary keyboard Enter via existing public controls',
      ...(plan.seed
        ? {
            seed: 'Public Workshop copy, title field, Install pack; no storage or content injection',
          }
        : {}),
      faults:
        'Explicit CacheStorage.delete of one verified entry; exact ServiceWorkerRegistration.unregister',
    },
    requestedViewport: { width: 1440, height: 900 },
    requestedDeviceScaleFactor: 1,
  };
  let admitted,
    work,
    served,
    context,
    task,
    pending = false,
    stopped = false;
  const staged = new Map();
  const end = Date.now() + LIMIT_MS;
  const active = () => {
    if (stopped || Date.now() >= end) throw new Error('C7 observation deadline or cancellation.');
  };
  try {
    await save('plan.json', planBytes);
    await mkdir(path.join(output, 'authority'));
    for (const name of AUTHORITY) {
      const bytes = await readFile(path.join(ROOT, name));
      report.authority.push(pin(name, bytes));
      await save('authority/' + path.basename(name), bytes);
    }
    admitted = await admitCacheRepairBundle(plan, path.dirname(path.resolve(planFile)));
    report.artifacts = admitted.envelope.packages;
    work = await mkdtemp(path.join(tmpdir(), 'practice-cache-repair-'));
    const siteRoot = path.join(work, 'site');
    const put = async (name, bytes) => {
      active();
      const file = path.resolve(siteRoot, name);
      assert(file.startsWith(siteRoot + path.sep), 'Staged member escaped site.');
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: 'wx' });
      staged.set(file, hash(bytes));
    };
    const version = admitted.envelope.version;
    for (const { item, files } of admitted.packages) {
      const root = `revealline/practice/${item.id}/`;
      for (const [name, bytes] of files) {
        await put(`${root}releases/${version}/site/${name}`, bytes);
        if (name.startsWith('launcher/')) await put(root + 'app/' + name.slice(9), bytes);
      }
      await put(
        root + 'app/current.json',
        JSON.stringify({
          id: item.id,
          version,
          scope: `../releases/${version}/site/`,
          entry: `optional-practice/${item.id}/index.html`,
        }),
      );
    }
    await put('review-storage.mjs', await readFile(path.join(ROOT, CONTINUITY)));
    await put('.xonix-build.json', JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }));
    active();
    served = await acquirePointerResource(
      report.resourceAcquisitions,
      'C7 server',
      () => startServer({ root: siteRoot, port: 0 }),
      closeServer,
    );
    const modulePath = path.resolve(playwrightModule);
    report.playwright = pin('external-playwright-module', await readFile(modulePath));
    const { chromium } = await import(pathToFileURL(modulePath).href);
    active();
    context = await acquirePointerResource(
      report.resourceAcquisitions,
      'C7 browser',
      () =>
        chromium.launchPersistentContext(path.join(work, 'profile'), {
          channel: 'chrome',
          headless: true,
          locale: 'en-US',
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
          timeout: 30_000,
        }),
      (owned) => owned.close(),
      35_000,
    );
    context.setDefaultTimeout(30_000);
    context.setDefaultNavigationTimeout(30_000);
    active();
    const page =
      context.pages()[0] ??
      (await acquirePointerResource(
        report.resourceAcquisitions,
        'C7 page',
        () => context.newPage(),
        (owned) => owned.close(),
      ));
    const browserSession = await deadline(
      context.newCDPSession(page),
      10_000,
      'Browser version session',
    );
    try {
      report.browserVersion = await deadline(
        browserSession.send('Browser.getVersion'),
        10_000,
        'Browser version',
      );
      report.browser = context.browser()?.version() ?? report.browserVersion.product;
    } finally {
      await deadline(browserSession.detach(), 10_000, 'Browser version session detach');
    }
    report.viewport = page.viewportSize();
    report.devicePixelRatio = await deadline(
      page.evaluate(() => globalThis.devicePixelRatio),
      10_000,
      'Device pixel ratio',
    );
    page.on('pageerror', (error) => report.errors.push(scrub(error.message).slice(0, 1000)));
    const specs = Object.fromEntries(
      CACHE_REPAIR_IDS.map((id) => [id, cacheRepairSpec(id, version, served.url)]),
    );
    const checkpoint = async (label, data) => {
      active();
      report.checks.push({ label, ...data });
      await save(
        `checkpoint-${report.checks.length}.json`,
        scrub(JSON.stringify(report.checks.at(-1), null, 2)) + '\n',
      );
    };
    const launcher = async (id) => {
      active();
      await page.goto(specs[id].launcher);
      await page.waitForFunction(
        () =>
          globalThis.document.querySelector('#check')?.disabled === false &&
          /^(Ready offline|Needs repair:|Offline verification could not finish|Available online)/.test(
            globalThis.document.querySelector('#status')?.textContent ?? '',
          ),
      );
    };
    const ready = async (id) => {
      await launcher(id);
      assert.match(await page.locator('#status').innerText(), /^Ready offline/);
      assert(await page.locator('#open').isVisible(), 'Verified offline Open is absent.');
    };
    const download = async () => {
      active();
      await activateOfflineAction(page, {
        button: '#download',
        status: '#status',
        expected: /^Ready offline/,
      });
    };
    const snapshot = async () => {
      active();
      const apps = {};
      for (const id of CACHE_REPAIR_IDS)
        apps[id] = await page.evaluate(readCacheRepairState, specs[id]);
      const records = await page.evaluate(async () => {
        const { observeStorageContinuity } = await import('/review-storage.mjs');
        const result = await observeStorageContinuity();
        // Explicit allowlist: never enumerate, copy or fingerprint access credentials.
        const value = globalThis.localStorage.getItem('revealline.flight-profiles.v1');
        const profile =
          value === null
            ? null
            : [
                ...new Uint8Array(
                  await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
                ),
              ]
                .map((n) => n.toString(16).padStart(2, '0'))
                .join('');
        return { databases: result.databases, profileSha256: profile };
      });
      return { apps, records };
    };
    const witnesses = async (target) => {
      for (const id of CACHE_REPAIR_IDS.filter((id) => id !== target)) await ready(id);
    };
    const openWorldsTab = async (tab) => {
      active();
      assert(['creator', 'packs'].includes(tab));
      await page.goto(specs['fpv-worlds'].entry + '?lang=en');
      await unlockObservedPage(page, password);
      await page.locator(OBSERVED_PACKAGES['fpv-worlds'].mounted).waitFor();
      await page.locator('#worlds-shell-action-settings').press('Enter');
      await page.locator('#worlds-settings-tab-content').press('Enter');
      await page.locator(`[data-tab="${tab}"]`).press('Enter');
      await page.locator(`#${tab}`).waitFor({ state: 'visible' });
    };
    const savedWorldCard = async () => {
      const card = page.locator('#installed-packs [data-pack-id]').filter({
        has: page.getByText(WORLD_SEED_TITLE, { exact: true }),
      });
      await card.waitFor({ state: 'visible' });
      assert.equal(await card.count(), 1, 'Require one identifiable saved world card.');
      const id = await card.getAttribute('data-pack-id');
      assert(id && id.length <= 256, 'Saved world card has no bounded project identity.');
      return { id, title: await card.locator('strong').innerText(), text: await card.innerText() };
    };
    const seedScreenshot = async (name) => {
      active();
      await page.screenshot({ path: path.join(output, name), fullPage: true });
      return pin(name, await readFile(path.join(output, name)));
    };
    const remove = async (id) => {
      active();
      await page.locator('#remove').press('Enter');
      await page.waitForFunction(
        (scope) =>
          globalThis.navigator.serviceWorker
            .getRegistrations()
            .then((rows) => !rows.some((row) => row.scope === scope)),
        specs[id].scope,
      );
      await page.waitForFunction(
        () =>
          globalThis.document.querySelector('#open')?.hidden === true &&
          globalThis.document.querySelector('#remove')?.hidden === true,
      );
      const state = await page.evaluate(readCacheRepairState, specs[id]);
      assert.equal(state.caches.length, 0);
      assert.equal(state.registrations.length, 0);
      assert.equal(state.hasReference, false);
    };
    pending = true;
    task = (async () => {
      for (const id of CACHE_REPAIR_IDS) {
        active();
        const adapter = OBSERVED_PACKAGES[id];
        await page.goto(specs[id].entry + '?lang=en');
        await unlockObservedPage(page, password);
        await page.locator(adapter.mounted).waitFor();
        await page.locator(`#${adapter.settingsPrefix}-shell-action-settings`).press('Enter');
        if (id === 'civilian-fpv') {
          await page.locator('#academy-settings-tab-extras').press('Enter');
          await revealFPVOffline(page, () => page.locator('#help').press('Enter'));
        } else await page.locator(adapter.panel).press('Enter');
        await activateOfflineAction(page, {
          button: adapter.prepare,
          status: adapter.status,
          expected:
            /ready offline|ready for offline|prepared offline|offline runtime preparation completed/i,
        });
        await launcher(id);
        await download(); // Also prepare the stable launcher through its public action.
        await ready(id);
      }
      if (plan.seed) {
        await openWorldsTab('creator');
        const before = await snapshot();
        const projects = before.records.databases
          .find((row) => row.name === 'revealline-fpv-worlds-v1')
          ?.stores?.find((row) => row.name === 'projects');
        assert.equal(projects?.count ?? 0, 0, 'Seed requires a fresh, empty World Studio store.');
        const template = await page.locator('#creator-template').evaluate((node) => ({
          value: node.value,
          label: node.selectedOptions[0]?.textContent ?? '',
        }));
        assert(template.value && template.label, 'The ordinary selected template must exist.');
        await page.locator('#clone-challenge').press('Enter');
        await page.locator('#creator-title').fill(WORLD_SEED_TITLE);
        await page.locator('#creator-title').press('Tab');
        await page.locator('#install-project').press('Enter');
        await page.waitForFunction(
          () =>
            globalThis.document.querySelector('#studio-status')?.textContent ===
            'World pack is ready to fly.',
        );
        await openWorldsTab('packs');
        const card = await savedWorldCard(),
          state = await snapshot();
        assertCacheRepairWorldSeed({ ...state, card });
        report.worldSeed = {
          mode: plan.seed,
          template,
          card,
          screenshot: await seedScreenshot('worlds-seeded-library.png'),
          limitation:
            'One UI-created template copy; no imported model assets, flight records, profile, regional content or .rlpack import/export qualification.',
        };
        await checkpoint('worlds-public-ui-seeded', { ...state, card });
      }
      const prepared = await snapshot();
      await checkpoint('all-three-prepared', prepared);
      for (const id of CACHE_REPAIR_IDS) {
        const spec = specs[id];
        for (const kind of ['missing-dependency', 'missing-worker']) {
          await ready(id);
          const before = await snapshot(),
            owned = before.apps[id];
          assert.equal(owned.caches.length, 1, 'Require one exact prepared runtime cache.');
          assert.equal(owned.registrations.length, 1);
          const expected = owned.caches[0].rows.find((row) => row.url === spec.entry);
          const original = admitted.packages
            .find((row) => row.item.id === id)
            .files.get(`optional-practice/${id}/index.html`);
          assert(
            expected && expected.sha256 === hash(original) && expected.bytes === original.length,
            'Injected dependency must match original admitted bytes.',
          );
          active();
          const fault = await page.evaluate(injectCacheRepairFault, {
            kind,
            spec,
            cacheName: owned.caches[0].name,
            expected,
          });
          report.faults.push({ id, ...fault, injected: true });
          const damaged = await snapshot();
          assertCacheRepairPreservation(before, damaged, id);
          if (kind === 'missing-worker')
            assert.deepEqual(
              damaged.apps[id].caches,
              owned.caches,
              'Unregister must leave cached bytes intact.',
            );
          else
            assert.deepEqual(
              damaged.apps[id].caches[0].rows,
              owned.caches[0].rows.filter((row) => row.url !== spec.entry),
              'Exactly one dependency must be removed.',
            );
          await launcher(id);
          assert.match(await page.locator('#status').innerText(), /^Needs repair:/);
          assert.equal(
            await page.locator('#open').isVisible(),
            false,
            'Damaged copy must not claim verified offline Open.',
          );
          await page.screenshot({ path: path.join(output, `${id}-${kind}.png`), fullPage: true });
          await checkpoint(`${id}-${kind}-detected`, { fault, damaged });
          await remove(id);
          await download();
          await ready(id);
          await witnesses(id);
          const repaired = await snapshot();
          assertCacheRepairPreservation(before, repaired, id);
          assert.deepEqual(
            repaired.apps[id].caches,
            owned.caches,
            'Public repair must restore exact admitted bytes.',
          );
          await checkpoint(`${id}-${kind}-repaired`, repaired);
        }
        await ready(id);
        const before = await snapshot();
        await remove(id);
        await witnesses(id);
        const removed = await snapshot();
        assertCacheRepairPreservation(before, removed, id);
        await checkpoint(`${id}-scoped-removal`, removed);
        await launcher(id);
        await download();
        await ready(id);
      }
      if (plan.seed) {
        await openWorldsTab('packs');
        const card = await savedWorldCard(),
          state = await snapshot();
        assertCacheRepairWorldSeed({ ...state, card }, report.worldSeed.card);
        assert.deepEqual(
          state.records,
          prepared.records,
          'Saved world records changed after the complete repair matrix.',
        );
        report.worldSeed.finalCard = card;
        report.worldSeed.finalScreenshot = await seedScreenshot('worlds-retained-library.png');
        await checkpoint('worlds-public-ui-retained', { ...state, card });
      }
      report.procedureComplete = true;
    })().finally(() => {
      pending = false;
    });
    await deadline(task, Math.max(1, end - Date.now()), 'C7 observation');
  } catch (error) {
    report.failure = scrub(error.message).slice(0, 2000);
  } finally {
    stopped = true;
    report.cleanup = await closeFPVObservationResources([
      ...(context ? [['browser', () => context.close()]] : []),
      ...(task ? [['observation termination', () => task.catch(() => {})]] : []),
      ...(served ? [['server', () => closeServer(served)]] : []),
    ]);
    const acquisitionsClosed = report.resourceAcquisitions.every(
      (row) => !row.pending && !row.lateCloseError,
    );
    try {
      await deadline(
        (async () => {
          for (const [file, sha256] of staged)
            assert.equal(hash(await readFile(file)), sha256, 'Staged package or observer changed.');
          for (const row of report.authority)
            assert.equal(
              hash(await readFile(path.join(ROOT, row.path))),
              row.sha256,
              `Observer source drift: ${row.path}`,
            );
          for (const [file, row] of admitted?.originals ?? [])
            assert.equal(
              hash(await readFile(file)),
              row.sha256,
              `Original artifact drift: ${row.path}`,
            );
        })(),
        10_000,
        'Final C7 byte identity verification',
      );
      report.identitiesStable = true;
    } catch (error) {
      report.identityFailure = scrub(error.message);
      report.identitiesStable = false;
    }
    if (
      work &&
      report.identitiesStable &&
      report.cleanup.completed &&
      acquisitionsClosed &&
      !pending
    ) {
      const removal = await closeFPVObservationResources([
        ['temporary site/profile', () => rm(work, { recursive: true, force: true })],
      ]);
      report.cleanup.operations.push(...removal.operations);
      report.cleanup.completed &&= removal.completed;
    }
    if (
      work &&
      (!report.identitiesStable || !report.cleanup.completed || !acquisitionsClosed || pending)
    )
      report.retainedDirectory = work;
    report.passed =
      report.procedureComplete &&
      !report.failure &&
      !report.errors.length &&
      report.identitiesStable &&
      report.cleanup.completed &&
      acquisitionsClosed &&
      !pending;
    report.finishedAt = new Date().toISOString();
    await save('report.json', scrub(JSON.stringify(report, null, 2)) + '\n');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, playwrightModule, output] = process.argv.slice(2);
  const report = await observePracticeCacheRepair({ planFile, playwrightModule, output });
  console.log(
    JSON.stringify({
      passed: report.passed,
      failure: report.failure,
      checks: report.checks.length,
      output,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
