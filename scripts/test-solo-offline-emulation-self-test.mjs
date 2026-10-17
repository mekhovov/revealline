import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  OFFLINE_SELF_TEST as plan,
  observeOfflineBranch,
  selfTestComplete,
} from './solo-offline-emulation-self-test.mjs';

function fake(initial = false, failStage = null) {
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
      url = value;
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

test('the one-shot diagnostic keeps native controls bounded and cannot enter gameplay', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-offline-emulation-self-test-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /github.event.before == '1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f'/);
  assert.match(workflow, /github.event.pull_request.number == 1544/);
  assert.match(workflow, /github.event.action == 'synchronize'/);
  assert.match(workflow, /playwright@1\.62\.1/);
  assert.match(workflow, /--with-deps chromium/);
  assert.match(workflow, /if: always\(\)/);
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
});
