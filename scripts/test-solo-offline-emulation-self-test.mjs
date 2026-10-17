import assert from 'node:assert/strict';
import test from 'node:test';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OFFLINE_SELF_TEST as plan,
  OFFLINE_NAVIGATION_SELF_TEST as navigationPlan,
  observeOfflineBranch,
  observeOfflineNavigationBranch,
  offlineScratchBytes,
  selfTestComplete,
} from './solo-offline-emulation-self-test.mjs';

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), 'solo-offline-scratch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

for (const kind of ['directory', 'file'])
  test(`scratch inspection tolerates a retired child ${kind} without losing retained bytes`, async (t) => {
    const root = await scratch(t),
      child = join(root, 'playwright-artifacts-retired');
    await writeFile(join(root, 'retained'), '12345');
    if (kind === 'directory') {
      await mkdir(child);
      await writeFile(join(child, 'transient'), 'retired');
    } else await writeFile(child, 'retired');
    assert.equal(
      await offlineScratchBytes(root, {
        expectedIdentity: await lstat(root),
        async readDirectory(path, options) {
          const entries = await readdir(path, options);
          if (path === root) await rm(child, { recursive: true });
          return entries;
        },
      }),
      5,
    );
  });

test('scratch inspection rejects missing or changed root ownership', async (t) => {
  const root = await scratch(t),
    identity = await lstat(root);
  await assert.rejects(
    offlineScratchBytes(root, { expectedIdentity: { dev: identity.dev, ino: identity.ino + 1 } }),
    /inode changed/,
  );
  await assert.rejects(
    offlineScratchBytes(root, {
      async readDirectory(path, options) {
        const entries = await readdir(path, options);
        await rm(root, { recursive: true });
        return entries;
      },
    }),
    { code: 'ENOENT' },
  );
  await assert.rejects(offlineScratchBytes(root), { code: 'ENOENT' });
});

test('scratch inspection preserves unexpected traversal and stat failures', async (t) => {
  const root = await scratch(t),
    child = join(root, 'child');
  await mkdir(child);
  await assert.rejects(
    offlineScratchBytes(root, {
      async readDirectory(path, options) {
        if (path === child) throw Object.assign(new Error('permission'), { code: 'EACCES' });
        return readdir(path, options);
      },
    }),
    { code: 'EACCES' },
  );
  await writeFile(join(root, 'file'), '123');
  await assert.rejects(
    offlineScratchBytes(root, {
      async stat(path) {
        if (path.endsWith('/file')) throw Object.assign(new Error('IO'), { code: 'EIO' });
        return lstat(path);
      },
    }),
    { code: 'EIO' },
  );
});

test('scratch cleanup races do not relax the existing byte or member caps', async (t) => {
  const root = await scratch(t);
  await writeFile(join(root, 'file'), '123');
  await assert.rejects(
    offlineScratchBytes(root, {
      async stat(path) {
        const info = await lstat(path);
        if (info.isFile()) info.size = plan.maximumScratchBytes + 1;
        return info;
      },
    }),
    /byte limit/,
  );
  await assert.rejects(
    offlineScratchBytes(root, {
      readDirectory: async () =>
        Array.from({ length: 5001 }, (_, i) => ({
          name: `retired-${i}`,
          isDirectory: () => false,
          isFile: () => true,
        })),
    }),
    /member limit/,
  );
});

function fake(initial = false, failStage = null, onlineAfterNavigation) {
  let online = initial,
    url = 'about:blank',
    connected = true;
  const calls = [],
    rows = [];
  const session = {
    async send(method, options) {
      calls.push([method, options]);
      if (method === 'Network.enable') online = true;
      if (method === 'Network.overrideNetworkState') online = !options.offline;
    },
    async detach() {
      calls.push(['detach']);
    },
  };
  const page = {
    async evaluate() {
      return { online, url };
    },
    async goto(value) {
      calls.push(['goto', value]);
      url = value;
      if (typeof onlineAfterNavigation === 'boolean') online = onlineAfterNavigation;
    },
  };
  const browser = { version: () => plan.browserVersion, isConnected: () => connected };
  return {
    calls,
    rows,
    launch: async () => ({
      pages: () => [page],
      browser: () => browser,
      newCDPSession: async () => {
        calls.push(['attach']);
        return session;
      },
      close: async () => {
        connected = false;
        calls.push(['close']);
      },
    }),
    bounded: async (label, operation) => {
      if (label === failStage) throw Error('injected failure');
      return operation();
    },
    record: async (row) => rows.push(structuredClone(row)),
  };
}
const closed = () => ({
  status: 'closed',
  exitCode: 0,
  violation: null,
  forcedCleanup: false,
  ambiguous: [],
  survivors: [],
});

for (const initial of [true, false])
  test(`all initial navigator states remain honest observations: ${initial}`, async () => {
    const branches = [];
    for (const id of plan.branches) {
      const host = fake(initial);
      const branch = await observeOfflineBranch({ id, ...host });
      branches.push(branch);
      assert.equal(branch.stages[0].online, initial);
      assert.equal(branch.browserClosed, true);
      const firstMutation = host.calls.findIndex(([method]) => method.startsWith('Network.'));
      if (id === 'existing-observer') assert.equal(firstMutation, -1);
      else
        assert(
          firstMutation >= 2,
          'Attach and existing worker observation precede native control mutation',
        );
      assert.equal(branch.stages[2].stage, 'worker-observation-enabled');
      assert.equal(branch.stages[2].online, initial);
      if (id === 'network-enable-control') assert.equal(branch.stages[3].online, true);
      if (id === 'explicit-state-control') assert.equal(branch.stages[3].online, false);
      assert.equal(host.calls.at(-1)[0], 'close');
    }
    assert(
      selfTestComplete(
        {
          format: plan.format,
          status: 'completed-diagnostic',
          qualificationEligible: false,
          browserVersion: plan.browserVersion,
          playwrightVersion: plan.playwright,
          branches,
        },
        closed(),
      ),
    );
  });

test('a stage failure retains its original observations and closes the native owner', async () => {
  const host = fake(true, 'navigate-data-document');
  await assert.rejects(observeOfflineBranch({ id: 'existing-observer', ...host }), /injected/);
  const last = host.rows.at(-1);
  assert.equal(last.status, 'failed');
  assert.equal(last.stages.length, 3);
  assert.equal(last.stages[0].online, true);
  assert.equal(last.browserClosed, true);
  assert.match(last.failure, /injected/);
});

test('an incomplete branch or uncertain owner is never a completed diagnostic', async () => {
  const branches = [];
  for (const id of plan.branches) branches.push(await observeOfflineBranch({ id, ...fake() }));
  const report = {
    format: plan.format,
    status: 'completed-diagnostic',
    qualificationEligible: false,
    browserVersion: plan.browserVersion,
    playwrightVersion: plan.playwright,
    branches,
  };
  for (const change of [
    { status: 'failed' },
    { exitCode: 1 },
    { violation: 'deadline' },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { ambiguous: [{}] },
    { survivors: [{}] },
  ])
    assert.equal(selfTestComplete(report, { ...closed(), ...change }), false);
  for (const mutate of [
    (r) => r.branches.reverse(),
    (r) => r.branches.pop(),
    (r) => r.branches[0].stages.pop(),
    (r) => (r.branches[0].browserClosed = false),
    (r) => (r.branches[0].stages[0].online = null),
    (r) => (r.browserVersion = 'changed'),
    (r) => (r.playwrightVersion = 'changed'),
    (r) => (r.qualificationEligible = true),
  ]) {
    const value = structuredClone(report);
    mutate(value);
    assert.equal(selfTestComplete(value, closed()), false);
  }
});

for (const initial of [true, false])
  test(`navigation controls preserve changing native state and session ownership: ${initial}`, async () => {
    const branches = [];
    for (const id of navigationPlan.branches) {
      const host = fake(initial, null, true);
      const branch = await observeOfflineNavigationBranch({ id, ...host });
      branches.push(branch);
      assert.equal(branch.stages[0].online, initial);
      assert.equal(branch.browserClosed, true);
      const navigations = host.calls.filter(([method]) => method === 'goto');
      assert.deepEqual(
        navigations.map(([, url]) => url),
        [
          'data:text/html,offline-navigation-probe-one',
          'data:text/html,offline-navigation-probe-two',
        ],
      );
      const states = Object.fromEntries(branch.stages.map((stage) => [stage.stage, stage.online]));
      assert.equal(states['first-data-navigation-complete'], true);
      assert.equal(states['second-data-navigation-complete'], true);
      const attached = host.calls.filter(([method]) => method === 'attach').length;
      assert.equal(attached, id === 'no-auxiliary-navigation' ? 0 : 1);
      const detached = host.calls.filter(([method]) => method === 'detach').length;
      assert.equal(detached, attached, 'Every mutation uses the same explicitly owned session.');
      const mutations = host.calls.filter(([method]) => method.startsWith('Network.'));
      if (id === 'no-auxiliary-navigation') assert.deepEqual(mutations, []);
      else if (id === 'combined-before-navigation') {
        assert.deepEqual(
          mutations.map(([method]) => method),
          ['Network.enable', 'Network.overrideNetworkState'],
        );
        assert.equal(states['native-state-overridden-before-navigation'], false);
        assert(host.calls.findIndex(([method]) => method === 'goto') > 3);
      } else {
        assert.deepEqual(
          mutations.map(([method]) => method),
          ['Network.overrideNetworkState', 'Network.overrideNetworkState'],
        );
        assert.equal(states['native-state-overridden-after-first-navigation'], false);
        assert.equal(states['native-state-overridden-after-second-navigation'], false);
        assert.equal(states['auxiliary-session-detached'], false);
      }
      assert.equal(host.calls.at(-1)[0], 'close');
    }
    assert(
      selfTestComplete(
        {
          format: navigationPlan.format,
          status: 'completed-diagnostic',
          qualificationEligible: false,
          browserVersion: navigationPlan.browserVersion,
          playwrightVersion: navigationPlan.playwright,
          branches,
        },
        closed(),
      ),
      'A complete true-state observation is still diagnostic, never a gameplay pass.',
    );
  });

test('navigation failure retains the prior native observations and closes its only session', async () => {
  const host = fake(false, 'navigate-second-data-document', true);
  await assert.rejects(
    observeOfflineNavigationBranch({ id: 'owned-session-after-navigation', ...host }),
    /injected/,
  );
  const last = host.rows.at(-1);
  assert.equal(last.status, 'failed');
  assert.equal(last.browserClosed, true);
  assert.deepEqual(
    last.stages.map((stage) => stage.online),
    [false, false, false, true, false],
  );
  assert.equal(host.calls.filter(([method]) => method === 'attach').length, 1);
  assert.equal(host.calls.filter(([method]) => method === 'detach').length, 1);
});

test('navigation completion requires exact ordered documents, unchanged identity and closed ownership', async () => {
  const branches = [];
  for (const id of navigationPlan.branches)
    branches.push(await observeOfflineNavigationBranch({ id, ...fake(false, null, true) }));
  const report = {
    format: navigationPlan.format,
    status: 'completed-diagnostic',
    qualificationEligible: false,
    browserVersion: navigationPlan.browserVersion,
    playwrightVersion: navigationPlan.playwright,
    branches,
  };
  for (const mutate of [
    (value) => value.branches.reverse(),
    (value) => value.branches[0].stages.reverse(),
    (value) => (value.branches[0].stages[2].url = value.branches[0].stages[1].url),
    (value) => (value.branches[1].browserClosed = false),
    (value) => (value.branches[2].stages[3].online = null),
    (value) => (value.browserVersion = 'changed'),
    (value) => (value.playwrightVersion = 'changed'),
    (value) => (value.qualificationEligible = true),
    (value) => (value.format = plan.format),
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.equal(selfTestComplete(changed, closed()), false);
  }
  assert.equal(selfTestComplete(report, { ...closed(), ambiguous: [{}] }), false);
  assert.equal(selfTestComplete(report, { ...closed(), survivors: [{}] }), false);
});

test('the one-shot diagnostic keeps native controls bounded and cannot enter gameplay', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-offline-emulation-self-test-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /github.event.before == 'cce49c81d82b79aefc24898f32eeebc609e569fb'/);
  assert.match(workflow, /github.event.pull_request.number == 1544/);
  assert.match(workflow, /github.event.action == 'synchronize'/);
  assert.match(workflow, /playwright@1\.62\.1/);
  assert.match(workflow, /--with-deps chromium/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /--navigation-controls/);
  assert.match(workflow, /name: solo-offline-navigation-emulation-/);
  const stepMinutes = [...workflow.matchAll(/\n(?:      - |        )timeout-minutes: (\d+)/g)].map(
    (match) => Number(match[1]),
  );
  assert.deepEqual(stepMinutes, [2, 1, 2, 5, 4, 1]);
  assert.equal(Number(workflow.match(/\n    timeout-minutes: (\d+)/)?.[1]), 17);
  assert.equal(17 - stepMinutes.reduce((sum, minutes) => sum + minutes, 0), 2);
  assert.doesNotMatch(workflow, /continue-on-error|workflow_dispatch|build-b117|distribution.zip/);
  const source = await readFile(
    new URL('./solo-offline-emulation-self-test.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /addInitScript|defineProperty\(navigator|setOffline\(false|startProductionPreview/,
  );
  assert.equal(plan.commandTimeoutMs, 120000);
  assert.equal(plan.operationTimeoutMs, 5000);
  assert.equal(plan.maximumScratchBytes, 256 * 1024 * 1024);
  for (const key of [
    'commandTimeoutMs',
    'operationTimeoutMs',
    'launchTimeoutMs',
    'maximumReportBytes',
    'maximumScratchBytes',
    'minimumFreeBytes',
    'browserVersion',
    'playwright',
  ])
    assert.equal(navigationPlan[key], plan[key]);
});
