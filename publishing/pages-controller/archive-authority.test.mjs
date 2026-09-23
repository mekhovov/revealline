import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import {
  ARCHIVE_CONCURRENCY,
  githubJSON,
  observeArchiveAuthorities,
} from './archive-authority.mjs';

const admissions = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `archive-${index + 1}`,
    infrastructureCommit: `sha-${index + 1}`,
    deploymentId: 100 + index,
  }));
const identify = (endpoint) => Number(endpoint.match(/revealline-archive-(\d+)\//)[1]);
const authority = (endpoint) => {
  const id = identify(endpoint);
  if (endpoint.endsWith('/commits/main')) return { sha: `sha-${id}` };
  if (endpoint.endsWith('/statuses')) return [{ state: 'success' }];
  return { id: 99 + id, sha: `sha-${id}`, environment: 'github-pages' };
};

test('four workers cap actual API calls, preserve per-archive order and deterministic receipts', async () => {
  let active = 0,
    peak = 0;
  const calls = [],
    completed = [];
  const api = async (endpoint) => {
    calls.push(endpoint);
    peak = Math.max(peak, ++active);
    await delay(identify(endpoint) === 1 ? 8 : 1);
    active--;
    completed.push(endpoint);
    return authority(endpoint);
  };
  const records = await observeArchiveAuthorities(admissions(9), { api });
  assert.equal(peak, ARCHIVE_CONCURRENCY);
  assert.equal(active, 0);
  assert.equal(calls.length, 27);
  assert.notEqual(identify(completed[0]), 1);
  assert.deepEqual(
    records,
    admissions(9).map((row) => ({
      archiveId: row.id,
      infrastructureCommit: row.infrastructureCommit,
      deploymentId: row.deploymentId,
      deploymentState: 'success',
    })),
  );
  for (const row of admissions(9)) {
    const prefix = `repos/mekhovov/revealline-${row.id}/`;
    assert.deepEqual(
      calls.filter((call) => call.startsWith(prefix)),
      [
        `${prefix}commits/main`,
        `${prefix}deployments/${row.deploymentId}`,
        `${prefix}deployments/${row.deploymentId}/statuses`,
      ],
    );
  }
});

test('each invocation makes a fresh complete observation, including all three publishing phases', async () => {
  let calls = 0;
  const api = async (endpoint) => {
    calls++;
    return authority(endpoint);
  };
  for (const phase of ['verify', 'build', 'verify-artifact']) {
    assert.equal((await observeArchiveAuthorities(admissions(2), { api })).length, 2, phase);
  }
  assert.equal(calls, 18);
  const source = readFileSync(new URL('./publish.mjs', import.meta.url), 'utf8');
  assert.ok(
    source.indexOf('const identity = await verify(') < source.indexOf("if (command === 'verify')"),
  );
  assert.ok(source.includes('releaseDecision({'));
  assert.ok(source.includes('Published source qualification does not match the reviewed pin.'));
  assert.ok(source.includes('const rows = await directoryInventory('));
  assert.ok(source.includes('Prepared artifact inventory changed.'));
});

test('first failure stops scheduling, aborts peers and waits for every active transport to settle', async () => {
  const calls = [];
  let settled = 0;
  const api = (endpoint, { signal }) => {
    calls.push(endpoint);
    if (identify(endpoint) === 2) return Promise.reject(new Error('rate limited'));
    return new Promise((resolve, reject) => {
      signal.addEventListener(
        'abort',
        async () => {
          await delay(5);
          settled++;
          reject(signal.reason);
        },
        { once: true },
      );
    });
  };
  await assert.rejects(observeArchiveAuthorities(admissions(8), { api }), /rate limited/);
  assert.equal(calls.length, 4);
  assert.equal(settled, 3);
});

test('phase deadline aborts pending calls and no incomplete observations are returned', async () => {
  let settled = 0;
  const api = (_, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          settled++;
          reject(signal.reason);
        },
        { once: true },
      );
    });
  await assert.rejects(
    observeArchiveAuthorities(admissions(5), { api, timeoutMs: 5 }),
    /phase deadline/,
  );
  assert.equal(settled, 4);
});

test('authority mismatch, latest failed status and incomplete authority fail closed', async () => {
  for (const alter of [
    (url, value) => (url.endsWith('/commits/main') ? { sha: 'changed' } : value),
    (url, value) => (/deployments\/100$/.test(url) ? { ...value, sha: 'changed' } : value),
    (url, value) => (/deployments\/100$/.test(url) ? { ...value, environment: 'preview' } : value),
    (url, value) =>
      url.endsWith('/statuses') ? [{ state: 'failure' }, { state: 'success' }] : value,
    (url, value) => (url.endsWith('/statuses') ? [] : value),
    (url, value) => (url.endsWith('/commits/main') ? {} : value),
    (url, value) => (/deployments\/100$/.test(url) ? {} : value),
  ]) {
    await assert.rejects(
      observeArchiveAuthorities(admissions(1), {
        api: async (url) => alter(url, authority(url)),
      }),
      /Admitted archive changed/,
    );
  }
  await assert.rejects(
    observeArchiveAuthorities(admissions(1), {
      api: async () => {
        throw null;
      },
    }),
    /Archive observation failed/,
  );
});

function fakeSpawn(action, { ignoreTerm = false } = {}) {
  const calls = [],
    children = [];
  const spawnChild = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.signals = [];
    child.closed = false;
    child.finish = (code = 0, signal = null) => {
      if (child.closed) return;
      child.closed = true;
      child.stdout.end();
      child.stderr.end();
      child.emit('close', code, signal);
    };
    child.kill = (signal) => {
      child.signals.push(signal);
      if (signal === 'SIGKILL' || !ignoreTerm) setImmediate(() => child.finish(null, signal));
      return true;
    };
    children.push(child);
    setImmediate(() => action(child));
    return child;
  };
  return { spawnChild, calls, children };
}

test('transport keeps exact command/endpoint/cwd and waits for close before accepting JSON', async () => {
  let closed = false;
  const fake = fakeSpawn((child) => {
    child.stdout.write('{"sha":');
    child.stdout.write('"expected"}');
    setTimeout(() => {
      closed = true;
      child.finish();
    }, 3);
  });
  assert.deepEqual(
    await githubJSON('repos/example/commits/main', {
      cwd: '/scoped',
      spawnChild: fake.spawnChild,
    }),
    { sha: 'expected' },
  );
  assert.equal(closed, true);
  assert.deepEqual(fake.calls, [
    {
      command: 'gh',
      args: ['api', 'repos/example/commits/main'],
      options: { cwd: '/scoped', stdio: ['ignore', 'pipe', 'pipe'] },
    },
  ]);
});

test('transport fails on invalid JSON, nonzero exit and spawn error', async () => {
  const invalid = fakeSpawn((child) => {
    child.stdout.write('not json');
    child.finish();
  });
  await assert.rejects(githubJSON('endpoint', { spawnChild: invalid.spawnChild }), /invalid JSON/);
  const failed = fakeSpawn((child) => {
    child.stderr.write('denied');
    child.finish(1);
  });
  await assert.rejects(
    githubJSON('endpoint', { spawnChild: failed.spawnChild }),
    /gh api failed.*denied/,
  );
  const error = fakeSpawn((child) => child.emit('error', new Error('spawn unavailable')));
  await assert.rejects(
    githubJSON('endpoint', { spawnChild: error.spawnChild }),
    /spawn unavailable/,
  );
  assert.equal(error.children[0].closed, true);
});

test('transport byte budgets fail closed and settle children for stdout and stderr', async () => {
  for (const stream of ['stdout', 'stderr']) {
    const fake = fakeSpawn((child) => child[stream].write('0123456789'));
    await assert.rejects(
      githubJSON('endpoint', { spawnChild: fake.spawnChild, maxBytes: 8 }),
      /byte budget/,
    );
    assert.equal(fake.children[0].closed, true);
    assert.deepEqual(fake.children[0].signals, ['SIGTERM']);
  }
});

test('timeout escalates ignored SIGTERM and only rejects after child close', async () => {
  const fake = fakeSpawn(() => {}, { ignoreTerm: true });
  await assert.rejects(
    githubJSON('endpoint', {
      spawnChild: fake.spawnChild,
      timeoutMs: 5,
      killGraceMs: 5,
    }),
    /deadline exceeded/,
  );
  assert.equal(fake.children[0].closed, true);
  assert.deepEqual(fake.children[0].signals, ['SIGTERM', 'SIGKILL']);
});

test('already-aborted transport never spawns; active cancellation settles the child', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  const fake = fakeSpawn(() => {});
  await assert.rejects(
    githubJSON('endpoint', { signal: controller.signal, spawnChild: fake.spawnChild }),
    /cancelled/,
  );
  assert.equal(fake.calls.length, 0);
  const active = new AbortController();
  const pending = githubJSON('endpoint', {
    signal: active.signal,
    spawnChild: fake.spawnChild,
  });
  active.abort(new Error('cancelled active'));
  await assert.rejects(pending, /cancelled active/);
  assert.equal(fake.children[0].closed, true);
});

test('empty admission set performs no API work and invalid bounds are rejected', async () => {
  assert.deepEqual(
    await observeArchiveAuthorities([], { api: () => assert.fail('unexpected API') }),
    [],
  );
  await assert.rejects(observeArchiveAuthorities([], { timeoutMs: 0 }), /Invalid/);
  assert.throws(() => githubJSON('endpoint', { maxBytes: Infinity }), /Invalid/);
});
