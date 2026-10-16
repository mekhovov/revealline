/* global document, navigator, localStorage, self, caches, CONFIG, name, scope, crypto */
// Excluded correctness only. Requires a future bound plan and the reviewed outer owned-process runner.
import assert from 'node:assert/strict';
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  statfs,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertPairedBaselineArtifact } from './solo-remote-offline.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { startProductionPreview } from './serve-production-preview.mjs';
import {
  closeBrowserForRestart,
  boundedOperation,
} from './optional-installation-observer-helpers.mjs';
import { waitQualificationControl } from './solo-qualification-export.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [planArgument, outputArgument] = process.argv.slice(2);
assert(planArgument && outputArgument, 'Usage: driver.mjs bound-plan.json fresh-output-directory');
const bytes = await readFile(resolve(planArgument));
const plan = JSON.parse(bytes),
  output = resolve(outputArgument);
const sha = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(plan.format, 'SoloHostedOfflinePersistencePairCasePlanV1');
assert.equal(
  plan.interfaceStatus,
  'peer-reviewed-bound',
  'Common hosted owner interface is still prospective',
);
assert.equal(process.platform, 'linux');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.match(
  process.env.SOLO_REMOTE_OWNER ?? '',
  /^[a-f0-9-]{36}$/,
  'Use the common ownedCommand wrapper',
);
assert.equal(plan.platform.display, 'headed-Xvfb');
assert(process.env.DISPLAY, 'The declared headed display must be active');
assert.equal(plan.status, 'pinned-for-execution');
assert(!bytes.includes(Buffer.from('${')), 'Unbound plan cannot execute');
assert.equal(plan.engine, 'chromium', 'Initial declared desktop offline stratum is Chromium only');
assert.match(plan.artifact.sourceRevision, /^[a-f0-9]{40}$/);
assert.equal(sha(await readFile(fileURLToPath(import.meta.url))), plan.driverSha256);
for (const ref of plan.frozenInputs)
  assert.equal(
    sha(await readFile(resolve(root, ref.path))),
    ref.sha256,
    `Input changed: ${ref.path}`,
  );
// This is a consumer of the common wrapper's immutable artifact proof, not a
// second process owner. Its exact schema/hash remains unbound until common review.
const checkedJSON = async (ref, maximumBytes = 4 * 1024 ** 2) => {
  const info = await lstat(ref.path);
  assert(info.isFile() && !info.isSymbolicLink());
  assert(info.size <= maximumBytes, 'Bounded metadata only');
  const data = await readFile(ref.path);
  assert.equal(data.length, ref.bytes);
  assert.equal(sha(data), ref.sha256);
  return JSON.parse(data);
};
assert.equal(sha(await readFile(plan.commonOwner.wrapper.path)), plan.commonOwner.wrapper.sha256);
const verified = await checkedJSON(plan.commonOwner.verifiedArtifacts);
assert.equal(verified.format, plan.commonOwner.verifiedArtifactsFormat);
assert.equal(verified.status, 'passed');
assert.equal(verified.format, 'SoloHostedVerifiedArtifactsV1');
assert.equal(verified.performanceExclusion, true);
const selected = verified.artifacts[plan.sourceRole];
assert.deepEqual(selected, plan.commonOwner.selectedArtifactRecord);
assert.equal(selected.sourceRole, plan.sourceRole);
assert.equal(selected.sourceTree, plan.artifact.sourceTree);
assert.deepEqual(selected.archiveIdentity, plan.artifact.archiveIdentity);
assert.equal(selected.archiveIdentity.sha256, plan.artifact.archiveSha256);
await checkedJSON(selected.archiveProof); // Common producer/member authority, retained verbatim.
assert.equal(selected.sourceRevision, plan.artifact.sourceRevision);
assert.equal(selected.payloadRealpath, plan.artifact.payloadRealpath);
assert.equal(selected.manifestSHA256, plan.artifact.manifest.sha256);
assert.deepEqual(selected.sourceProof, plan.securityPolicyAuthority.sourceProof);
const runnerTemp = await realpath(process.env.RUNNER_TEMP);
const scratch = await realpath(plan.storage.scratch),
  outputParent = await realpath(dirname(output));
assert(scratch.startsWith(runnerTemp + '/') && outputParent.startsWith(runnerTemp + '/'));
assert.equal(scratch, plan.storage.scratch, 'Scratch alias is not admitted');
assert.equal(outputParent, plan.storage.outputRoot, 'Exact fresh output owner required');
const scratchAuthority = await checkedJSON(plan.commonOwner.scratchAuthority);
assert.equal(scratchAuthority.format, 'SoloHostedRowScratchV1');
assert.equal(scratchAuthority.storage.scratchRoot, scratch);
assert.equal(scratchAuthority.storage.outputRoot, outputParent);
const scratchOwner = scratchAuthority.storage.scratchOwner;
assert.equal(dirname(scratchOwner.path), runnerTemp);
assert.match(scratchOwner.path.slice(runnerTemp.length + 1), /^sc-[a-zA-Z0-9]{6}$/);
assert.equal(dirname(scratch), scratchOwner.path);
assert.match(scratch.slice(scratchOwner.path.length + 1), /^r\d{2}$/);
assert.equal(scratchOwner.maximumRowPathBytes, 52);
assert(Buffer.byteLength(scratch) <= 52);
for (const [path, device, inode] of [
  [scratchOwner.path, scratchOwner.device, scratchOwner.inode],
  [scratch, scratchAuthority.storage.device, scratchAuthority.storage.inode],
]) {
  const current = await lstat(path);
  assert(current.isDirectory() && !current.isSymbolicLink());
  assert.equal(current.dev, device);
  assert.equal(current.ino, inode);
}

const free = await statfs(scratch);
const admission = {
  commonOwner: plan.commonOwner,
  selected,
  scratch,
  outputRoot: outputParent,
  scratchFreeBytes: Number(free.bavail) * Number(free.bsize),
  platform: process.platform,
  ownerToken: process.env.SOLO_REMOTE_OWNER,
  display: process.env.DISPLAY,
};
assert(['baseline', 'candidate'].includes(plan.sourceRole));
assert.match(plan.expectedBrowserVersion, /^\d+\.\d+\.\d+\.\d+$/);
if (plan.sourceRole === 'candidate') {
  const prior = await checkedJSON(plan.firstArmReport, 2 * 1024 ** 2);
  assertPairedBaselineArtifact(prior, verified.artifacts.baseline);
  assert.equal(prior.format, 'SoloHostedOfflinePersistencePairCaseV1');
  assert.equal(prior.status, 'completed-diagnostic');
  assert.equal(prior.sourceRole, 'baseline');
  assert.equal(prior.artifact.sourceRevision, 'b11745223861c3973ad4bf440cc536198b8e0371');
  assert.equal(prior.observationSettled, true);
  assert.equal(prior.offlineNavigation?.responseWaitSettled, true);
  for (const key of [
    'deadlineReached',
    'cleanupFailure',
    'cdpCleanupFailure',
    'serverCleanupFailure',
    'launchDrainFailure',
    'observationDrainFailure',
    'errorOverflow',
    'requestFailureOverflow',
    'responseOverflow',
    'workerEventOverflow',
  ])
    assert(!prior[key], `Baseline ${key}`);
  assert.equal(prior.errors.length, 0);
  const before = prior.workerSnapshots.find((row) => row.stage === 'ready-before-close');
  assert(
    before?.identityMatches && before.keysMatch && before.indexMatches,
    'Baseline pre-close premise is required even when restart fails',
  );
  const closed = await checkedJSON(plan.firstArmClosure);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.exitCode, 0);
  assert(
    closed.completedAt && !closed.violation && !closed.forcedCleanup && !closed.cleanupUnconfirmed,
  );
  assert.deepEqual(closed.survivors, []);
  assert.deepEqual(closed.ambiguous, []);
  assert.deepEqual(closed.argv, plan.firstArmArgv);
  assert.deepEqual(closed.argv.slice(-3), [
    plan.firstArmInvocation.driver,
    plan.firstArmInvocation.plan,
    plan.firstArmInvocation.output,
  ]);
  assert.equal(prior.plan.path, plan.firstArmInvocation.plan);
  assert.equal(plan.firstArmReport.path, join(plan.firstArmInvocation.output, 'report.json'));
  assert.equal(prior.plan.sha256, plan.firstArmPlanSHA256);
  assert.equal(
    prior.browserVersion,
    plan.expectedBrowserVersion,
    'Pair browser version must equal the first actual arm',
  );
} else {
  assert.equal(plan.firstArmReport, null);
  assert.equal(plan.firstArmClosure, null);
}
assert.equal(
  plan.artifact.sourceRevision,
  plan.sourceRole === 'baseline'
    ? 'b11745223861c3973ad4bf440cc536198b8e0371'
    : '2ec605eb76e38f9c9a3e21b7fa82dd80c580c457',
);
const selectedRoot = selected.payloadRealpath;
assert(selectedRoot.startsWith(runnerTemp + '/'), 'Only common admitted job-local payloads');
assert.equal(plan.artifact.payloadRealpath, selectedRoot);
assert(Number.isInteger(plan.serverPort) && plan.serverPort >= 1024 && plan.serverPort <= 65535);
assert.equal(sha(await readFile(plan.artifact.manifest.path)), plan.artifact.manifest.sha256);
const manifest = JSON.parse(await readFile(plan.artifact.manifest.path));
assert.equal(plan.artifact.manifest.path, join(selectedRoot, 'manifest.json'));
assert.equal(manifest.sourceRevision, plan.artifact.sourceRevision);
for (const ref of plan.artifact.metadata) {
  const item = manifest.files.find((row) => row.path === ref.path);
  assert(item);
  assert.equal(item.bytes, ref.bytes);
  assert.equal(item.sha256, ref.sha256);
}
assert(admission.scratchFreeBytes >= plan.limits.minimumInitialScratchFreeBytes);
assert.equal(await realpath(plan.artifact.payloadRoot), plan.artifact.payloadRealpath);
assert.equal(await realpath(process.env.TMPDIR), await realpath(plan.storage.scratch));
try {
  await access(output);
  assert.fail('Refuse to overwrite offline evidence');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(output, { recursive: false });
const report = {
  format: 'SoloHostedOfflinePersistencePairCaseV1',
  sourceRole: plan.sourceRole,
  status: 'running',
  startedAt: new Date().toISOString(),
  plan: { path: resolve(planArgument), sha256: sha(bytes) },
  artifact: plan.artifact,
  admission,
  qualificationEligible: false,
  performanceGateStatus: 'excluded-offline-persistence-diagnostic',
  scope: plan.scope,
  accessFixture: {
    kind: 'preexisting-remembered-public-verifier',
    writes: [],
    authenticationQualified: false,
  },
  steps: [],
  errors: [],
  failedRequests: [],
  responses: [],
  responseOverflow: 0,
  workerEvents: [],
  workerSnapshots: [],
  storageSnapshots: [],
  workerEventOverflow: false,
  replays: [],
};
let context,
  browser,
  served,
  page,
  profile,
  profileIdentity,
  launchPending,
  stopped = false,
  observedClosed = false,
  phase = 'admission',
  watchdog,
  observationSettled = false,
  cdp;
const step = (name, detail = {}) => {
  phase = name;
  report.steps.push({ name, at: new Date().toISOString(), ...detail });
};
const save = async () => {
  const text = JSON.stringify(report, null, 2) + '\n';
  assert(Buffer.byteLength(text) <= plan.limits.maximumReportBytes);
  await writeFile(join(output, 'report.json'), text);
};
const artifactFile = async (relative) => {
  const ref = plan.artifact.metadata.find((item) => item.path === relative);
  assert(ref);
  const file = resolve(plan.artifact.payloadRealpath, relative);
  assert(file.startsWith(plan.artifact.payloadRealpath + '/'));
  const data = await readFile(file);
  assert.equal(data.length, ref.bytes);
  assert.equal(sha(data), ref.sha256);
  return data;
};
const checkSpace = async () => {
  const s = await statfs(plan.storage.scratch);
  const available = Number(s.bavail) * Number(s.bsize);
  report.steps.push({
    name: 'hosted-scratch-reserve-check',
    at: new Date().toISOString(),
    available,
  });
  assert(
    available >= plan.limits.minimumRemainingScratchFreeBytes,
    'Owned scratch reserve exhausted',
  );
};
const stopServer = async () => {
  if (!served) return;
  const owner = served;
  served = null;
  await boundedOperation(
    'Stop owned offline server',
    () =>
      new Promise((resolveClose, reject) => {
        owner.server.close((error) => (error ? reject(error) : resolveClose()));
        owner.server.closeIdleConnections?.();
        owner.server.closeAllConnections?.();
      }),
    5000,
  );
  assert.equal(owner.server.listening, false);
  step('owned-server-stopped', { origin: owner.url });
};
const closeContext = async () => {
  if (!context) return;
  const owned = context,
    ownedBrowser = browser;
  if (cdp) {
    const ownedCDP = cdp;
    cdp = null;
    await boundedOperation(
      'Detach offline diagnostic session',
      () => ownedCDP.detach(),
      5000,
    ).catch((error) => {
      report.cdpCleanupFailure = String(error);
    });
  }
  const result = await closeBrowserForRestart(owned);
  assert.equal(ownedBrowser.isConnected(), false);
  context = null;
  browser = null;
  page = null;
  observedClosed = true;
  step('persistent-browser-closed', result);
};
const observedPages = new WeakSet();
const observePage = (target) => {
  if (observedPages.has(target)) return;
  observedPages.add(target);
  target.on('pageerror', (error) => {
    if (report.errors.length < 64)
      report.errors.push({ phase, error: String(error).slice(0, 2048) });
    else report.errorOverflow = true;
  });
  target.on('requestfailed', (request) => {
    if (report.failedRequests.length < 128)
      report.failedRequests.push({
        phase,
        url: request.url().slice(0, 2048),
        error: request.failure(),
      });
    else report.requestFailureOverflow = true;
  });
  target.on('response', (response) => {
    if (report.responses.length < 4096)
      report.responses.push({
        phase,
        url: response.url().slice(0, 2048),
        status: response.status(),
        serviceWorker: response.fromServiceWorker(),
      });
    else report.responseOverflow++;
  });
};
let playwright;
const workerVersionIds = new Set();
const launch = async (offline) => {
  ensureOwner();
  assert(!context && !browser);
  await checkSpace();
  ensureOwner();
  observedClosed = false;
  launchPending = playwright.chromium
    .launchPersistentContext(profile, {
      executablePath: plan.chromeExecutable,
      headless: false,
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'allow',
      offline,
      acceptDownloads: false,
      timeout: 30000,
    })
    .then(async (value) => {
      if (stopped) {
        await boundedOperation('Late offline browser close', () => value.close(), 5000);
        throw new Error('Browser launch completed after observation stopped');
      }
      context = value;
      browser = context.browser();
      assert(browser);
      return context;
    });
  await launchPending;
  launchPending = null;
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(60000);
  context.on('page', observePage);
  page = context.pages()[0] ?? (await context.newPage());
  observePage(page);
  await page.bringToFront();
  assert(!stopped && !report.deadlineReached, 'Diagnostic owner stopped during launch');
  cdp = await context.newCDPSession(page);
  for (const method of [
    'ServiceWorker.workerRegistrationUpdated',
    'ServiceWorker.workerVersionUpdated',
    'ServiceWorker.workerErrorReported',
  ])
    cdp.on(method, (data) => {
      const text = JSON.stringify(data);
      for (const version of data.versions ?? []) workerVersionIds.add(String(version.versionId));
      if (workerVersionIds.size > 8) {
        report.workerEventOverflow = true;
        return;
      }
      if (report.workerEvents.length >= 128 || text.length > 32768) {
        report.workerEventOverflow = true;
        return;
      }
      report.workerEvents.push({ at: new Date().toISOString(), phase, method, data });
    });
  await boundedOperation(
    'Enable worker lifecycle observation',
    () => cdp.send('ServiceWorker.enable'),
    5000,
  );
  step('persistent-browser-launched', {
    offline,
    version: browser.version(),
    profile,
    serviceWorkers: 'allow',
  });
  assert.equal(
    browser.version(),
    plan.expectedBrowserVersion,
    'Actual browser differs from declared pair stratum',
  );
  if (report.browserVersion) assert.equal(browser.version(), report.browserVersion);
  else report.browserVersion = browser.version();
};
const click = async (selector, timeout = 60000) => {
  ensureOwner();
  await waitQualificationControl(page, selector, timeout);
  ensureOwner();
  await page.locator(selector).click({ timeout });
  step('public-click', { selector });
};
const ensureOwner = () => assert(!stopped && !report.deadlineReached, 'Diagnostic owner stopped');
let expectedLauncher;
const workerSnapshot = async (stage) => {
  ensureOwner();
  const workerURL = new URL('app/service-worker.js', report.origin).href;
  const row = { stage, at: new Date().toISOString(), workerURL };
  const existing = context.serviceWorkers().filter((worker) => worker.url() === workerURL);
  assert(existing.length <= 1, 'Ambiguous live launcher targets');
  if (!existing.length) {
    row.unobserved = 'Exact existing worker target absent; no worker is started by the observer';
    report.workerSnapshots.push(row);
    return row;
  }
  row.worker = await boundedOperation(
    'Read existing launcher cache only',
    () =>
      existing[0].evaluate(async () => {
        const names = await caches.keys();
        if (names.length > 8) throw new Error('Cache-name bound exceeded');
        const workerScope = self.registration.scope;
        const expectedName = `revealline-launcher:${encodeURIComponent(workerScope)}:${CONFIG.id}`;
        const result = {
          workerScope,
          configId: CONFIG.id,
          declaredFileCount: CONFIG.files.length,
          lexicalName: name,
          lexicalScope: scope,
          expectedName,
          cacheNames: names,
          present: names.includes(expectedName),
          registration: {},
        };
        for (const key of ['active', 'installing', 'waiting']) {
          const worker = self.registration[key];
          result.registration[key] = worker
            ? { scriptURL: worker.scriptURL, state: worker.state }
            : null;
        }
        if (!result.present) return result;
        const existing = await caches.open(expectedName),
          keys = await existing.keys();
        if (keys.length > 64) throw new Error('Launcher-key bound exceeded');
        result.keys = keys.map((key) => {
          if (key.url.length > 2048) throw new Error('Request URL bound exceeded');
          return { url: key.url, method: key.method };
        });
        const indexURL = new URL('index.html', workerScope).href;
        result.indexURL = indexURL;
        result.declaredIndex = CONFIG.files.find((file) => file.path === 'index.html');
        const matched = await existing.match(indexURL);
        result.indexMatched = Boolean(matched);
        const storedRequest = keys.find((key) => key.url === indexURL);
        const response =
          matched ??
          (storedRequest ? await existing.match(storedRequest, { ignoreVary: true }) : null);
        result.responseReadMode = matched
          ? 'default-match'
          : response
            ? 'ignoreVary-diagnostic-only'
            : 'absent';
        if (response) {
          const headers = [...response.headers];
          if (
            headers.length > 32 ||
            headers.some(([key, value]) => key.length > 256 || value.length > 8192)
          )
            throw new Error('Response header bound exceeded');
          const declaredLength = Number(response.headers.get('content-length'));
          if (
            !Number.isSafeInteger(declaredLength) ||
            declaredLength < 0 ||
            declaredLength > 131072
          )
            throw new Error('Index length admission failed');
          const bytes = new Uint8Array(declaredLength),
            reader = response.body.getReader();
          let length = 0;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (length + value.length > bytes.length)
                throw new Error('Index readback bound exceeded');
              bytes.set(value, length);
              length += value.length;
            }
          } finally {
            await reader.cancel().catch(() => {});
          }
          if (length !== declaredLength) throw new Error('Index readback length mismatch');
          result.index = {
            status: response.status,
            headers,
            bytes: length,
            sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
              .map((byte) => byte.toString(16).padStart(2, '0'))
              .join(''),
          };
        }
        return result;
      }),
    10000,
  );
  ensureOwner();
  const value = row.worker;
  row.expectedScope = new URL('app/', report.origin).href;
  row.expectedIndex = expectedLauncher.files.find((file) => file.path === 'index.html');
  row.identityMatches =
    value.workerScope === row.expectedScope &&
    value.lexicalScope === row.expectedScope &&
    value.configId === expectedLauncher.id &&
    value.lexicalName === value.expectedName &&
    value.declaredFileCount === expectedLauncher.files.length;
  const expectedKeys = expectedLauncher.files
    .map((file) => new URL(file.path, row.expectedScope).href)
    .sort();
  row.keysMatch =
    Boolean(value.keys) &&
    value.keys.every((key) => key.method === 'GET') &&
    sha(JSON.stringify(value.keys.map((key) => key.url).sort())) ===
      sha(JSON.stringify(expectedKeys));
  row.indexMatches =
    value.indexMatched === true &&
    value.responseReadMode === 'default-match' &&
    value.index?.status === 200 &&
    value.index?.bytes === row.expectedIndex.bytes &&
    value.index?.sha256 === row.expectedIndex.sha256;
  report.workerSnapshots.push(row);
  return row;
};
const storageSnapshot = async (stage) => {
  ensureOwner();
  const space = await statfs(plan.storage.scratch),
    current = await stat(profile);
  assert.equal(current.dev, profileIdentity.dev);
  assert.equal(current.ino, profileIdentity.ino);
  const row = {
    stage,
    at: new Date().toISOString(),
    profile: { path: profile, dev: current.dev, ino: current.ino },
    scratchFreeBytes: Number(space.bavail) * Number(space.bsize),
  };
  row.usage = await boundedOperation(
    'Read origin storage quota',
    () => cdp.send('Storage.getUsageAndQuota', { origin: new URL(report.origin).origin }),
    5000,
  ).catch((error) => ({ unobserved: String(error).slice(0, 1024) }));
  ensureOwner();
  report.storageSnapshots.push(row);
};
await save();
const observation = (async () => {
  playwright = await import(pathToFileURL(plan.playwrightModule).href);
  // Require the exact generated deployment policy for the archive, original server responses, and offline SW responses.
  const headerBytes = await artifactFile('_headers');
  const headerLines = headerBytes.toString('utf8').trim().split(/\r?\n/);
  assert.equal(headerLines.shift(), '/*');
  const deploymentHeaders = Object.fromEntries(
    headerLines.map((line) => {
      assert.match(line, /^\s{2}[^:]+: /);
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
    }),
  );
  assert.equal(headerLines.length, Object.keys(deploymentHeaders).length);
  assert.deepEqual(deploymentHeaders, PUBLIC_SECURITY_HEADERS);
  const sourceProof = await checkedJSON(plan.securityPolicyAuthority.sourceProof);
  assert.equal(sourceProof.status, 'passed');
  assert.equal(sourceProof.source.wholeTreeRevision, plan.artifact.sourceRevision);
  assert.equal(sourceProof.manifest.declaredSourceRevision, plan.artifact.sourceRevision);
  assert.equal(sourceProof.manifest.sha256, plan.artifact.manifest.sha256);
  assert.equal(sourceProof.verifiedArtifactBytes, manifest.totalBytes);
  report.securityPolicies = {
    artifactHeadersSHA256: sha(headerBytes),
    sourceProof: plan.securityPolicyAuthority.sourceProof,
    deployment: deploymentHeaders['Content-Security-Policy'],
    served: PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
    scope:
      'Common passed full artifact/source/member proof binds the exact manifest. Original manifest-pinned _headers is independently compared to PUBLIC_SECURITY_HEADERS here; unchanged production preview and offline response checks require the same policy. No separate historical CSP receipt is substituted.',
  };
  const coreBytes = await artifactFile('offline-cache.json'),
    catalogueBytes = await artifactFile('offline-content.json');
  const core = JSON.parse(coreBytes),
    catalogue = JSON.parse(catalogueBytes);
  const launcherManifestBytes = await artifactFile('app/manifest.webmanifest'),
    launcherHTMLBytes = await artifactFile('app/index.html');
  const launcherManifest = JSON.parse(launcherManifestBytes);
  const launcherWorkerBytes = await artifactFile('app/service-worker.js');
  const match = launcherWorkerBytes.toString('utf8').match(/const CONFIG = (\{[^\n]+\});/);
  assert(match);
  expectedLauncher = JSON.parse(match[1]);
  assert.equal(expectedLauncher.id, plan.launcherBuildId);
  assert(expectedLauncher.files.length <= 64);
  const declaredIndex = expectedLauncher.files.find((file) => file.path === 'index.html');
  assert(declaredIndex);
  assert.equal(declaredIndex.sha256, sha(launcherHTMLBytes));
  assert.equal(declaredIndex.bytes, launcherHTMLBytes.length);
  await artifactFile('app/app.mjs'); // Bind the unmodified automatic routing owner as well as HTML/manifest.
  const groups = new Map(catalogue.groups.map((g) => [g.id, g])),
    files = new Map(catalogue.files.map((f) => [f.path, f]));
  const seen = new Set(),
    selected = new Map();
  const visit = (id) => {
    assert(groups.has(id));
    if (seen.has(id)) return;
    seen.add(id);
    const g = groups.get(id);
    for (const dependency of g.requires) visit(dependency);
    for (const name of g.files) {
      const f = files.get(name);
      assert(f);
      selected.set(f.sha256, f);
    }
  };
  visit('base');
  assert.deepEqual([...seen].sort(), ['base', 'shared', 'solo:horizon-starter']);
  const selection = {
    groups: [...seen].sort(),
    coreFiles: core.files.length,
    coreBytes: core.files.reduce((n, f) => n + f.bytes, 0),
    contentFiles: selected.size,
    contentBytes: [...selected.values()].reduce((n, f) => n + f.bytes, 0),
  };
  assert.deepEqual(selection, plan.selection);
  report.selection = selection;
  profile = await mkdtemp(
    join(await realpath(plan.storage.scratch), `solo-offline-pair-${plan.sourceRole}-`),
  );
  profileIdentity = await stat(profile);
  report.profile = profile;
  report.profileIdentity = { dev: profileIdentity.dev, ino: profileIdentity.ino };
  assert(!stopped, 'Offline observation stopped before server admission');
  served = await startProductionPreview({
    root: plan.artifact.payloadRealpath,
    port: plan.serverPort,
    fixtureAccess: false,
    cache: 'policy',
  });
  assert.equal(served.mode, 'generated-build');
  assert.equal(served.fixtureAccess, false);
  assert.equal(served.cache, 'policy');
  report.serverPolicy = {
    mode: served.mode,
    fixtureAccess: served.fixtureAccess,
    cache: served.cache,
    headers: served.headers,
  };
  if (stopped) {
    await stopServer();
    throw new Error('Server admission completed after deadline');
  }
  const origin = served.url,
    address = new URL('game/?journey=opening', origin).href;
  report.origin = origin;
  report.address = address;
  const installedEntry = new URL(
    launcherManifest.start_url,
    new URL('app/manifest.webmanifest', origin),
  ).href;
  const selectedGameEntry = new URL('game/', origin).href;
  assert.equal(
    installedEntry,
    new URL('app/', origin).href,
    'Only the exact declared launcher start_url is admitted',
  );
  report.installedEntry = {
    manifest: 'app/manifest.webmanifest',
    manifestSHA256: sha(launcherManifestBytes),
    resolvedStartURL: installedEntry,
    launcherHTMLSHA256: sha(launcherHTMLBytes),
    expectedSelectedGameURL: selectedGameEntry,
    scope:
      'Desktop manifest entry and automatic installed-edition routing; not OS installation or gameplay-at-launch qualification',
  };
  const identityURL = new URL('game/build-info.json', origin).href;
  const identityResponse = await fetch(identityURL, { signal: AbortSignal.timeout(10000) });
  assert.equal(identityResponse.status, 200);
  const identity = Buffer.from(await identityResponse.arrayBuffer());
  assert.equal(sha(identity), plan.artifact.buildInfoSha256);
  assert.equal(JSON.parse(identity).sourceRevision, plan.artifact.sourceRevision);
  assert.equal(
    identityResponse.headers.get('content-security-policy'),
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
  );
  const expected = {
    browserVersion: null,
    buildIdentity: {
      url: identityURL,
      sourceRevision: plan.artifact.sourceRevision,
      sha256: sha(identity),
    },
    csp: identityResponse.headers.get('content-security-policy'),
  };
  await launch(false);
  expected.browserVersion = report.browserVersion;
  step('online-locked-entry');
  const onlineResponse = await page.goto(address, { waitUntil: 'load' });
  assert.equal(onlineResponse.status(), 200);
  assert.equal(onlineResponse.headers()['content-security-policy'], expected.csp);
  const html = await onlineResponse.body();
  assert.equal(sha(html), plan.artifact.entryHTMLSha256);
  const fixture = await page.evaluate(() => {
    const read = (name) => document.querySelector(`meta[name="${name}"]`)?.content;
    const id = read('revealline-access-id'),
      salt = read('revealline-access-salt'),
      verifier = read('revealline-access-verifier');
    if (!id || !salt || !verifier || document.documentElement.dataset.accessState !== 'locked')
      throw new Error('Expected original password gate and public verifier metadata');
    const key = `revealline.access.${id}.v1`;
    if (localStorage.length !== 0 || localStorage.getItem(key) !== null)
      throw new Error('Access fixture requires empty fresh origin storage');
    localStorage.setItem(key, verifier);
    return { key, metadataId: id, verifier, writeCount: 1 };
  });
  report.accessFixture.writes.push({
    key: fixture.key,
    metadataId: fixture.metadataId,
    verifierSHA256: sha(fixture.verifier),
    writeCount: 1,
    source: 'exact original HTML meta; successful gate normally remembers this value',
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.accessState === 'unlocked');
  await waitQualificationControl(page, '#shell-featured', 60000);
  step('online-download-page');
  await page.goto(new URL('game/downloads.html', origin).href, { waitUntil: 'load' });
  await waitQualificationControl(page, '#download-game', 60000);
  const choices = await page.evaluate(() => ({
    all: document.querySelector('#all-game').checked,
    starter: document.querySelector('#starter-choice input').checked,
    extras: [...document.querySelectorAll('input[data-group]:checked')].map((e) => e.dataset.group),
  }));
  assert.equal(choices.all, false);
  assert.equal(choices.starter, true);
  assert(choices.extras.every((id) => ['base', 'shared', 'solo:horizon-starter'].includes(id)));
  report.choices = choices;
  await click('#download-game');
  await page.waitForFunction(
    () =>
      /Solo starter ready offline/.test(
        document.querySelector('#game-status')?.textContent ?? '',
      ) &&
      document.querySelector('#progress')?.hidden &&
      document.querySelector('#activate')?.hidden &&
      document.querySelector('#activation-status')?.textContent?.trim(),
    null,
    { timeout: plan.limits.downloadTimeoutMs },
  );
  report.downloadReady = await page.evaluate(() => ({
    status: document.querySelector('#game-status')?.textContent,
    activation: document.querySelector('#activation-status')?.textContent,
    details: document.querySelector('#details')?.textContent?.slice(0, 32768),
  }));
  report.downloadReady.observedAt = new Date().toISOString();
  assert.match(report.downloadReady.activation, new RegExp(plan.activationReadyPattern));
  await checkSpace();
  step('online-controlled-entry');
  const controlled = await page.goto(address, { waitUntil: 'load' });
  assert.equal(controlled.status(), 200);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  report.onlineController = await page.evaluate(() => ({
    scriptURL: navigator.serviceWorker.controller.scriptURL,
    state: navigator.serviceWorker.controller.state,
  }));
  step('ready-before-close-worker-witness');
  const before = await workerSnapshot('ready-before-close');
  await storageSnapshot('ready-before-close');
  assert(
    before.identityMatches && before.keysMatch && before.indexMatches,
    'Public-ready launcher cache premise did not match exact artifact before shutdown',
  );
  ensureOwner();
  await closeContext();
  await stopServer();
  step('server-off-negative-probe');
  let unavailable = false;
  try {
    await fetch(new URL(`offline-unavailable-${Date.now()}.txt`, origin), {
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    unavailable = true;
    report.serverUnavailable = String(error.message);
  }
  assert(unavailable, 'Own origin still answers while offline');
  await launch(true);
  step('offline-manifest-entry-restart');
  ensureOwner();
  const navigation = {
    startedAt: new Date().toISOString(),
    url: installedEntry,
    serverStopped: served === null,
    offlineEmulation: true,
  };
  report.offlineNavigation = navigation;
  const selectedGameResponse = page
    .waitForResponse(
      (response) =>
        response.url() === selectedGameEntry &&
        response.request().isNavigationRequest() &&
        response.frame() === page.mainFrame(),
      { timeout: 60000 },
    )
    .catch((error) => ({ error: String(error).slice(0, 2048) }));
  try {
    const launcherResponse = await page.goto(installedEntry, { waitUntil: 'commit' });
    ensureOwner();
    navigation.launcher = {
      url: launcherResponse.url(),
      status: launcherResponse.status(),
      serviceWorker: launcherResponse.fromServiceWorker(),
      headers: await launcherResponse.allHeaders(),
    };
    const body = await boundedOperation(
      'Read offline launcher response',
      () => launcherResponse.body(),
      5000,
    );
    navigation.launcher.body = { bytes: body.length, sha256: sha(body) };
    assert.equal(navigation.launcher.url, installedEntry);
    assert.equal(navigation.launcher.status, 200);
    assert.equal(navigation.launcher.serviceWorker, true);
    assert.equal(sha(body), sha(launcherHTMLBytes));
    assert.equal(navigation.launcher.headers['content-security-policy'], expected.csp);
    const automaticResponse = await selectedGameResponse;
    ensureOwner();
    assert(!automaticResponse.error, automaticResponse.error);
    navigation.selectedGame = {
      status: automaticResponse.status(),
      serviceWorker: automaticResponse.fromServiceWorker(),
      url: automaticResponse.url(),
    };
    assert.equal(navigation.selectedGame.status, 200);
    assert.equal(navigation.selectedGame.serviceWorker, true);
    const gameHTML = await boundedOperation(
      'Read automatic offline game response',
      () => automaticResponse.body(),
      5000,
    );
    assert.equal(sha(gameHTML), plan.artifact.entryHTMLSha256);
    assert.equal(automaticResponse.headers()['content-security-policy'], expected.csp);
    await page.waitForURL(selectedGameEntry, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
      timeout: 60000,
    });
    ensureOwner();
    navigation.publicBootReady = true;
  } catch (error) {
    navigation.error = String(error.stack ?? error).slice(0, 4096);
    navigation.publicBootReady = false;
  }
  ensureOwner();
  navigation.completedAt = new Date().toISOString();
  navigation.finalURL = page.url();
  step('post-restart-worker-witness');
  const after = await workerSnapshot('after-restart-navigation');
  await storageSnapshot('after-restart-navigation');
  report.diagnosticOutcome = after.unobserved
    ? 'inconclusive-post-worker-unobserved'
    : navigation.publicBootReady && after.identityMatches && after.keysMatch && after.indexMatches
      ? 'observed-launcher-and-cache-retained'
      : 'observed-offline-launch-or-cache-failure';
  report.launcherQualificationStatus = 'instrumented-diagnostic-only';
  report.platformStratum = plan.platform;
  report.interpretation =
    'New Linux headed Chromium stratum; prior local Mac failures remain failed. Pre-close worker reads may affect backend persistence. The original untouched offline failure remains failed. Post-navigation fetch may recreate an absent cache. No deletion/eviction/browser cause, offline gameplay, physical installed PWA, temperature or performance conclusion follows.';
  assert.equal(served, null, 'Server must stay stopped after restart');
  await closeContext();
  await boundedOperation(
    'Drain automatic navigation response owner',
    () => selectedGameResponse,
    5000,
  );
  report.offlineNavigation.responseWaitSettled = true;
  ensureOwner();
  assert.equal(report.errors.length, 0);
  assert(
    !report.errorOverflow &&
      !report.requestFailureOverflow &&
      !report.responseOverflow &&
      !report.workerEventOverflow,
  );
  report.status = 'completed-diagnostic';
})().finally(() => {
  observationSettled = true;
});
try {
  await Promise.race([
    observation,
    new Promise((_, reject) => {
      watchdog = setTimeout(() => {
        report.deadlineReached = true;
        stopped = true;
        reject(new Error('Offline correctness deadline exceeded'));
      }, plan.limits.observationTimeoutMs);
    }),
  ]);
} catch (error) {
  report.status = 'fail';
  report.failure = String(error.stack ?? error);
} finally {
  stopped = true;
  clearTimeout(watchdog);
  if (launchPending)
    await boundedOperation(
      'Drain pending native launch',
      () => launchPending.catch(() => {}),
      35000,
    ).catch((error) => {
      report.launchDrainFailure = String(error);
    });
  await closeContext().catch((error) => {
    report.cleanupFailure = String(error);
  });
  await stopServer().catch((error) => {
    report.serverCleanupFailure = String(error);
  });
  if (!observationSettled)
    await boundedOperation(
      'Drain stopped offline observation',
      () => observation.catch(() => {}),
      130000,
    ).catch((error) => {
      report.observationDrainFailure = String(error);
    });
  report.observationSettled = observationSettled;
  report.browserClosed = observedClosed;
  if (report.deadlineReached || report.observationDrainFailure || !observationSettled)
    report.status = 'fail';
  if (profile) {
    const current = await stat(profile);
    assert.equal(current.dev, profileIdentity.dev);
    assert.equal(current.ino, profileIdentity.ino);
    report.profileRetained = profile;
    report.profileAfter = { path: profile, dev: current.dev, ino: current.ino, retained: true };
  }
  if (
    report.deadlineReached ||
    report.cdpCleanupFailure ||
    report.workerEventOverflow ||
    report.cleanupFailure ||
    report.serverCleanupFailure ||
    report.launchDrainFailure ||
    report.observationDrainFailure ||
    !observationSettled
  )
    report.status = 'fail';
  report.completedAt = new Date().toISOString();
  await save();
}
if (report.status !== 'completed-diagnostic') process.exitCode = 1;
