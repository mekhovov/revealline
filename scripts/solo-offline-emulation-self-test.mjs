import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readdir, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const OFFLINE_SELF_TEST = Object.freeze({
  format: 'SoloOfflineEmulationSelfTestV1',
  playwright: '1.62.1',
  browserVersion: '151.0.7922.34',
  branches: Object.freeze([
    'existing-observer',
    'network-enable-control',
    'explicit-state-control',
  ]),
  commandTimeoutMs: 120000,
  operationTimeoutMs: 5000,
  launchTimeoutMs: 15000,
  maximumReportBytes: 1024 * 1024,
  maximumScratchBytes: 256 * 1024 * 1024,
  minimumFreeBytes: 512 * 1024 * 1024,
});
export const OFFLINE_NAVIGATION_SELF_TEST = Object.freeze({
  ...OFFLINE_SELF_TEST,
  format: 'SoloOfflineNavigationEmulationSelfTestV2',
  branches: Object.freeze([
    'no-auxiliary-navigation',
    'combined-before-navigation',
    'owned-session-after-navigation',
  ]),
});
const navigationURLs = Object.freeze([
  'data:text/html,offline-navigation-probe-one',
  'data:text/html,offline-navigation-probe-two',
]);
const navigationStages = Object.freeze({
  'no-auxiliary-navigation': [
    'persistent-offline-launch',
    'first-data-navigation-complete',
    'second-data-navigation-complete',
  ],
  'combined-before-navigation': [
    'persistent-offline-launch',
    'auxiliary-session-attached',
    'worker-observation-enabled',
    'network-enabled',
    'native-state-overridden-before-navigation',
    'first-data-navigation-complete',
    'second-data-navigation-complete',
    'auxiliary-session-detached',
  ],
  'owned-session-after-navigation': [
    'persistent-offline-launch',
    'auxiliary-session-attached',
    'worker-observation-enabled',
    'first-data-navigation-complete',
    'native-state-overridden-after-first-navigation',
    'second-data-navigation-complete',
    'native-state-overridden-after-second-navigation',
    'auxiliary-session-detached',
  ],
});
const navigationURL = (id, index) => {
  if (id === 'no-auxiliary-navigation') return index ? navigationURLs[index - 1] : 'about:blank';
  const first = id === 'combined-before-navigation' ? 5 : 3;
  const second = id === 'combined-before-navigation' ? 6 : 5;
  return index < first ? 'about:blank' : navigationURLs[index < second ? 0 : 1];
};
const here = dirname(fileURLToPath(import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const save = async (path, value) => {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  assert(Buffer.byteLength(bytes) <= OFFLINE_SELF_TEST.maximumReportBytes);
  await writeFile(path, bytes);
};
export function selfTestComplete(report, command) {
  const navigation = report?.format === OFFLINE_NAVIGATION_SELF_TEST.format;
  const plan = navigation ? OFFLINE_NAVIGATION_SELF_TEST : OFFLINE_SELF_TEST;
  return (
    report?.format === plan.format &&
    report?.status === 'completed-diagnostic' &&
    report?.qualificationEligible === false &&
    report?.browserVersion === plan.browserVersion &&
    report?.playwrightVersion === plan.playwright &&
    report?.branches?.length === plan.branches.length &&
    report.branches.every(
      (branch, index) =>
        branch.id === plan.branches[index] &&
        branch.status === 'observed' &&
        branch.browserClosed === true &&
        branch.stages.length ===
          (navigation ? navigationStages[branch.id].length : index === 0 ? 5 : 6) &&
        branch.stages.every(
          (stage, stageIndex) =>
            typeof stage.online === 'boolean' &&
            (!navigation ||
              (stage.stage === navigationStages[branch.id][stageIndex] &&
                stage.url === navigationURL(branch.id, stageIndex))),
        ),
    ) &&
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.violation &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    command.ambiguous?.length === 0 &&
    command.survivors?.length === 0
  );
}

// Each branch receives a fresh native context. Record the original sequence before
// a control mutates CDP networking; no property injection or game code is used.
export async function observeOfflineBranch({ id, launch, record, bounded }) {
  assert(OFFLINE_SELF_TEST.branches.includes(id));
  const branch = { id, status: 'running', stages: [], browserClosed: false };
  let context, session;
  const sample = async (stage, page) => {
    const value = await bounded(stage, () =>
      page.evaluate(() => ({
        online: navigator.onLine,
        url: globalThis.location.href,
      })),
    );
    assert.equal(typeof value.online, 'boolean');
    assert(['about:blank', 'data:text/html,offline-emulation-probe'].includes(value.url));
    branch.stages.push({ stage, ...value });
    await record(branch);
  };
  try {
    context = await launch();
    const browser = context.browser();
    assert.equal(browser.version(), OFFLINE_SELF_TEST.browserVersion);
    const page =
      context.pages()[0] ?? (await bounded('create-blank-page', () => context.newPage()));
    await sample('persistent-offline-launch', page);
    session = await bounded('attach-auxiliary-session', () => context.newCDPSession(page));
    await sample('auxiliary-session-attached', page);
    await bounded('enable-worker-observation', () => session.send('ServiceWorker.enable'));
    await sample('worker-observation-enabled', page);
    if (id === 'network-enable-control') {
      await bounded('enable-network-control', () => session.send('Network.enable'));
      await sample('network-enabled', page);
    }
    if (id === 'explicit-state-control') {
      await bounded('override-native-network-state', () =>
        session.send('Network.overrideNetworkState', {
          offline: true,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1,
        }),
      );
      await sample('native-network-state-overridden', page);
    }
    await bounded('navigate-data-document', () =>
      page.goto('data:text/html,offline-emulation-probe', {
        waitUntil: 'load',
        timeout: OFFLINE_SELF_TEST.operationTimeoutMs,
      }),
    );
    await sample('data-navigation-complete', page);
    await bounded('detach-auxiliary-session', () => session.detach());
    session = null;
    await sample('auxiliary-session-detached', page);
    branch.status = 'observed';
  } catch (error) {
    branch.status = 'failed';
    branch.failure = String(error).slice(0, 4096);
    throw error;
  } finally {
    if (session)
      await bounded('close-auxiliary-session', () => session.detach()).catch((error) => {
        branch.cleanupFailure = String(error).slice(0, 4096);
      });
    if (context) {
      try {
        const browser = context.browser();
        await bounded('close-persistent-context', () => context.close());
        assert.equal(browser.isConnected(), false);
        branch.browserClosed = true;
      } catch (error) {
        branch.status = 'failed';
        branch.cleanupFailure = String(error).slice(0, 4096);
      }
    }
    await record(branch);
  }
  assert.equal(branch.status, 'observed', 'Native branch cleanup failed');
  return branch;
}

// A second declared experiment separates navigation from auxiliary ownership.
// All mutations target the same explicitly retained native CDP session.
export async function observeOfflineNavigationBranch({ id, launch, record, bounded }) {
  assert(OFFLINE_NAVIGATION_SELF_TEST.branches.includes(id));
  const branch = { id, status: 'running', stages: [], browserClosed: false };
  let context, session;
  const sample = async (stage, page) => {
    const value = await bounded(stage, () =>
      page.evaluate(() => ({ online: navigator.onLine, url: globalThis.location.href })),
    );
    assert.equal(typeof value.online, 'boolean');
    assert(['about:blank', ...navigationURLs].includes(value.url));
    branch.stages.push({ stage, ...value });
    await record(branch);
  };
  const override = (label) =>
    bounded(label, () =>
      session.send('Network.overrideNetworkState', {
        offline: true,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      }),
    );
  try {
    context = await launch();
    assert.equal(context.browser().version(), OFFLINE_NAVIGATION_SELF_TEST.browserVersion);
    const page =
      context.pages()[0] ?? (await bounded('create-blank-page', () => context.newPage()));
    await sample('persistent-offline-launch', page);
    if (id !== 'no-auxiliary-navigation') {
      session = await bounded('attach-auxiliary-session', () => context.newCDPSession(page));
      await sample('auxiliary-session-attached', page);
      await bounded('enable-worker-observation', () => session.send('ServiceWorker.enable'));
      await sample('worker-observation-enabled', page);
      if (id === 'combined-before-navigation') {
        await bounded('enable-network-control', () => session.send('Network.enable'));
        await sample('network-enabled', page);
        await override('override-before-navigation');
        await sample('native-state-overridden-before-navigation', page);
      }
    }
    for (const [index, label] of ['first', 'second'].entries()) {
      await bounded(`navigate-${label}-data-document`, () =>
        page.goto(navigationURLs[index], {
          waitUntil: 'load',
          timeout: OFFLINE_NAVIGATION_SELF_TEST.operationTimeoutMs,
        }),
      );
      await sample(`${label}-data-navigation-complete`, page);
      if (id === 'owned-session-after-navigation') {
        await override(`override-after-${label}-navigation`);
        await sample(`native-state-overridden-after-${label}-navigation`, page);
      }
    }
    if (session) {
      await bounded('detach-auxiliary-session', () => session.detach());
      session = null;
      await sample('auxiliary-session-detached', page);
    }
    branch.status = 'observed';
  } catch (error) {
    branch.status = 'failed';
    branch.failure = String(error).slice(0, 4096);
    throw error;
  } finally {
    if (session)
      await bounded('close-auxiliary-session', () => session.detach()).catch((error) => {
        branch.cleanupFailure = String(error).slice(0, 4096);
      });
    if (context)
      try {
        const browser = context.browser();
        await bounded('close-persistent-context', () => context.close());
        assert.equal(browser.isConnected(), false);
        branch.browserClosed = true;
      } catch (error) {
        branch.status = 'failed';
        branch.cleanupFailure = String(error).slice(0, 4096);
      }
    await record(branch);
  }
  assert.equal(branch.status, 'observed', 'Native branch cleanup failed');
  return branch;
}

const bounded = async (_label, operation, ms = OFFLINE_SELF_TEST.operationTimeoutMs) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`Self-test deadline: ${_label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
async function child(output, scratch, navigation = false) {
  const plan = navigation ? OFFLINE_NAVIGATION_SELF_TEST : OFFLINE_SELF_TEST;
  const modulePath = process.env.SOLO_PLAYWRIGHT_MODULE;
  assert(modulePath && resolve(modulePath) === modulePath);
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const packageInfo = JSON.parse(await readFile(join(dirname(modulePath), 'package.json'), 'utf8'));
  assert.equal(packageInfo.version, OFFLINE_SELF_TEST.playwright);
  const report = {
    ...plan,
    sourceRevision: process.env.SOLO_TOOLING_REVISION,
    status: 'running',
    qualificationEligible: false,
    firstEightAllCorrectnessPassed: false,
    performanceGateStatus: 'excluded-browser-emulation-self-test',
    playwrightVersion: packageInfo.version,
    executable: chromium.executablePath(),
    branches: [],
    startedAt: new Date().toISOString(),
    scope:
      'Fresh blank/data-page native browser diagnostics only. No game, network server, cached profile, runtime qualification or simulated navigator property.',
  };
  const path = join(output, 'report.json');
  try {
    for (const id of plan.branches) {
      const profile = await mkdtemp(join(scratch, 'p-'));
      const identity = await lstat(profile);
      await (navigation ? observeOfflineNavigationBranch : observeOfflineBranch)({
        id,
        launch: () =>
          bounded(
            'launch-persistent-context',
            () =>
              chromium.launchPersistentContext(profile, {
                headless: false,
                offline: true,
                serviceWorkers: 'allow',
                acceptDownloads: false,
                locale: 'en-US',
                viewport: { width: 1280, height: 800 },
                timeout: OFFLINE_SELF_TEST.launchTimeoutMs,
              }),
            OFFLINE_SELF_TEST.launchTimeoutMs,
          ),
        bounded,
        record: async (branch) => {
          const row = {
            ...branch,
            profile: { path: profile, dev: identity.dev, ino: identity.ino },
          };
          const index = report.branches.findIndex((item) => item.id === id);
          if (index < 0) report.branches.push(row);
          else report.branches[index] = row;
          await save(path, report);
        },
      });
    }
    report.status = 'completed-diagnostic';
  } catch (error) {
    report.status = 'failed';
    report.failure = String(error).slice(0, 4096);
    process.exitCode = 1;
  } finally {
    report.completedAt = new Date().toISOString();
    await save(path, report);
  }
}
// Playwright removes its temporary artifacts directories when contexts close.
// A child disappearing after enumeration is ordinary cleanup; the owned root
// and all non-ENOENT failures remain mandatory inspection boundaries.
export async function offlineScratchBytes(
  root,
  { readDirectory = readdir, stat = lstat, expectedIdentity = null } = {},
) {
  const identity = await stat(root);
  assert(identity.isDirectory() && !identity.isSymbolicLink(), 'Owned scratch root required');
  if (expectedIdentity) {
    assert.equal(identity.dev, expectedIdentity.dev, 'Owned scratch device changed');
    assert.equal(identity.ino, expectedIdentity.ino, 'Owned scratch inode changed');
  }
  let bytes = 0,
    members = 0;
  const walk = async (path) => {
    for (const item of await readDirectory(path, { withFileTypes: true })) {
      assert(++members <= 5000, 'Owned scratch member limit');
      const child = join(path, item.name);
      try {
        if (item.isDirectory()) await walk(child);
        else if (item.isFile()) bytes += (await stat(child)).size;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      assert(bytes <= OFFLINE_SELF_TEST.maximumScratchBytes, 'Owned scratch byte limit');
    }
  };
  await walk(root);
  const current = await stat(root);
  assert(current.isDirectory() && !current.isSymbolicLink(), 'Owned scratch root required');
  assert.equal(current.dev, identity.dev, 'Owned scratch device changed');
  assert.equal(current.ino, identity.ino, 'Owned scratch inode changed');
  return bytes;
}
async function parent(output, navigation = false) {
  const plan = navigation ? OFFLINE_NAVIGATION_SELF_TEST : OFFLINE_SELF_TEST;
  assert.equal(process.platform, 'linux');
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(source, process.env.SOLO_TOOLING_REVISION);
  assert(/^[a-f\d]{40}$/.test(source));
  await mkdir(output, { recursive: false });
  const scratch = await mkdtemp(join(tmpdir(), 'so-'));
  assert(Buffer.byteLength(scratch) <= 34);
  const identity = await lstat(scratch);
  const { ownedCommand } = await import('./run-solo-remote-correctness.mjs');
  const inspect = async () => {
    const current = await lstat(scratch);
    assert.equal(current.dev, identity.dev);
    assert.equal(current.ino, identity.ino);
    const space = await statfs(scratch);
    assert(Number(space.bavail) * Number(space.bsize) >= OFFLINE_SELF_TEST.minimumFreeBytes);
    await offlineScratchBytes(scratch, { expectedIdentity: identity });
  };
  await inspect();
  const sources = {};
  for (const file of ['solo-offline-emulation-self-test.mjs', 'run-solo-remote-correctness.mjs']) {
    const bytes = await readFile(join(here, file));
    sources[file] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  await save(join(output, 'admission.json'), {
    sourceRevision: source,
    sources,
    plan,
    scratch: { path: scratch, dev: identity.dev, ino: identity.ino },
    automaticRetries: 0,
  });
  const command = await ownedCommand(
    [
      'xvfb-run',
      '-a',
      process.execPath,
      fileURLToPath(import.meta.url),
      'child',
      output,
      scratch,
      ...(navigation ? ['--navigation-controls'] : []),
    ],
    {
      cwd: resolve(here, '..'),
      env: { ...process.env, TMPDIR: scratch },
      log: join(output, 'command.log'),
      receipt: join(output, 'command.json'),
      timeoutMs: OFFLINE_SELF_TEST.commandTimeoutMs,
      rssBytes: 2 * 1024 ** 3,
      outputBytes: 4 * 1024 * 1024,
      inspect,
    },
  );
  let report;
  try {
    const data = await readFile(join(output, 'report.json'));
    assert(data.length <= OFFLINE_SELF_TEST.maximumReportBytes);
    report = JSON.parse(data);
  } catch (error) {
    report = { status: 'unreadable', failure: String(error).slice(0, 4096) };
  }
  const complete =
    report.sourceRevision === source &&
    report.format === plan.format &&
    selfTestComplete(report, command);
  await save(join(output, 'summary.json'), {
    format: plan.format,
    sourceRevision: source,
    status: complete ? 'completed-diagnostic' : 'failed',
    qualificationEligible: false,
    commandStatus: command.status,
    performanceGateStatus: 'excluded-browser-emulation-self-test',
    observations: report.branches ?? [],
    scope:
      'Original state booleans are observations, never converted to offline gameplay passes. Fresh profiles remain on owned hosted scratch until job teardown.',
  });
  if (!complete) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'child') {
    assert(
      process.argv.length === 5 ||
        (process.argv.length === 6 && process.argv[5] === '--navigation-controls'),
    );
    await child(resolve(process.argv[3]), resolve(process.argv[4]), process.argv.length === 6);
  } else {
    assert.equal(process.argv[2], 'run');
    assert(
      process.argv.length === 4 ||
        (process.argv.length === 5 && process.argv[4] === '--navigation-controls'),
    );
    await parent(resolve(process.argv[3]), process.argv.length === 5);
  }
}
