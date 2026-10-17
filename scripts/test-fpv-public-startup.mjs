import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { observeFPVStartup } from './smoke-fpv-public-fresh-install.mjs';

const state = {
  access: 'unlocked',
  documentReady: 'complete',
  shellPending: true,
  settingsPresent: false,
  passwordFormPresent: false,
  inertScriptCount: 2,
  serviceWorkerControlled: false,
};
const page = (read = async () => ({ ...state })) =>
  Object.assign(new EventEmitter(), { evaluate: read });
const request = (url, failure = 'net::ERR_CONNECTION_RESET') => ({
  url: () => url,
  resourceType: () => 'script',
  failure: () => ({ errorText: failure }),
  headers: () => assert.fail('Do not read request headers'),
  postData: () => assert.fail('Do not read request bodies'),
});

test('startup failure retains pending scripts and request outcomes without replacing the original error', async () => {
  const host = page(),
    evidence = {},
    expected = new Error('original readiness timeout');
  let clock = 0;
  const options = { now: () => clock };
  const done = request('https://example.test/boot.mjs');
  const failed = request('https://example.test/worker.mjs');
  const pending = request('https://example.test/world.mjs');
  await assert.rejects(
    observeFPVStartup(
      host,
      evidence,
      'fresh-password',
      async () => {
        host.emit('request', done);
        host.emit('request', failed);
        host.emit('request', pending);
        clock = 10;
        host.emit('response', { request: () => done, status: () => 200 });
        host.emit('requestfinished', done);
        host.emit('requestfailed', failed);
        clock = 60;
        throw expected;
      },
      options,
    ),
    (error) => error === expected,
  );
  const report = evidence.startups[0];
  assert.equal(report.passed, false);
  assert.equal(report.elapsedMs, 60);
  assert.deepEqual(report.state, state);
  assert.equal(report.pendingRequests, 1);
  assert.equal(report.requests[0].status, 200);
  assert.equal(report.requests[0].finishedMs, 10);
  assert.equal(report.requests[1].failure, 'net::ERR_CONNECTION_RESET');
  assert.deepEqual(host.eventNames(), []);
});

test('successful startup returns the action result and reports explicit request truncation', async () => {
  const host = page(),
    evidence = {};
  assert.equal(
    await observeFPVStartup(host, evidence, 'reload', async () => {
      for (let i = 0; i < 300; i++) host.emit('request', request(`https://example.test/${i}.mjs`));
      return 42;
    }),
    42,
  );
  const report = evidence.startups[0];
  assert.equal(report.passed, true);
  assert.equal(report.requestsSeen, 300);
  assert.equal(report.requestsOmitted, 44);
  assert.equal(report.requests.length, 256);
  assert.equal(report.pendingRequests, 256);
  assert.deepEqual(host.eventNames(), []);
});

test('startup report excludes URL credentials, query, fragment, data bodies and redacts retained strings', async () => {
  const host = page(),
    evidence = {};
  const secret = 'fixture-secret';
  await observeFPVStartup(
    host,
    evidence,
    'reload',
    async () => {
      for (const url of [
        `https://user:${secret}@example.test/${secret}.mjs?token=query-secret#fragment-secret`,
        `data:text/javascript,body-secret`,
        'invalid-secret',
      ])
        host.emit('request', request(url));
    },
    { redact: (value) => String(value).split(secret).join('[redacted]') },
  );
  const serialized = JSON.stringify(evidence);
  for (const excluded of [
    'fixture-secret',
    'query-secret',
    'fragment-secret',
    'body-secret',
    'invalid-secret',
    'user:',
  ])
    assert.equal(serialized.includes(excluded), false);
  assert.equal(evidence.startups[0].requests[0].resource, '/[redacted].mjs');
});

test('failed and hung state capture stays bounded and never masks the startup result', async () => {
  const expected = new Error('original navigation failure');
  const failedEvidence = {},
    hungEvidence = {};
  const failedPage = page(async () => {
    throw new Error('page closed');
  });
  await assert.rejects(
    observeFPVStartup(failedPage, failedEvidence, 'reload', async () => {
      throw expected;
    }),
    (error) => error === expected,
  );
  assert.equal(failedEvidence.startups[0].captureFailure, 'state-unavailable');
  const hungPage = page(() => new Promise(() => {}));
  assert.equal(
    await observeFPVStartup(hungPage, hungEvidence, 'reload', async () => 'ok', {
      captureTimeoutMs: 10,
    }),
    'ok',
  );
  assert.equal(hungEvidence.startups[0].captureFailure, 'state-timeout');
  assert.deepEqual(hungPage.eventNames(), []);
});

test('arbitrary network and capture errors cannot retain URL secrets in diagnostic metadata', async () => {
  const sensitive =
    'https://user:synthetic-userinfo@example.test/start.mjs?token=synthetic-query-secret#synthetic-fragment';
  const expected = new Error('original readiness failure');
  const host = page(async () => {
    throw new Error(`capture failed at ${sensitive}`);
  });
  const evidence = {};
  await assert.rejects(
    observeFPVStartup(host, evidence, 'reload', async () => {
      const item = request('https://example.test/start.mjs', `request failed for ${sensitive}`);
      host.emit('request', item);
      host.emit('response', { request: () => item, status: () => 503 });
      host.emit('requestfailed', item);
      throw expected;
    }),
    (error) => error === expected,
  );
  const row = evidence.startups[0];
  assert.equal(row.requests[0].failure, 'request-failed');
  assert.equal(row.captureFailure, 'state-unavailable');
  assert.equal(row.requests[0].status, 503);
  assert.equal(row.pendingRequests, 0);
  assert.equal(typeof row.requests[0].failedMs, 'number');
  for (const marker of ['synthetic-userinfo', 'synthetic-query-secret', 'synthetic-fragment'])
    assert.equal(JSON.stringify(evidence).includes(marker), false);
  assert.deepEqual(host.eventNames(), []);
});
