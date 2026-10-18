import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test, { after } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  admissionPreflight,
  readAdmissionAPIResponse,
  completeChangedPaths,
  verifiedTreeLeaves,
} from './admission-preflight.mjs';

const oracleDirectory = mkdtempSync(path.join(tmpdir(), 'admission-tree-oracle-'));
after(() => rmSync(oracleDirectory, { recursive: true, force: true }));
const repository = 'owner/repository';
const oid = (value) => createHash('sha1').update(value).digest('hex');
const base = oid('base');
const head = oid('head');
const ancestor = oid('ancestor');
const file = (name, value = name, mode = '100644') => ({
  path: name,
  mode,
  type: mode === '160000' ? 'commit' : 'blob',
  sha: oid(value),
});
const pull = (count) => ({
  number: 7,
  head: { sha: head },
  base: { sha: base },
  changed_files: count,
  body: '',
});

// The test oracle uses Git itself to hash independently assembled tree bytes;
// no -w, clone, checkout, hooks, credentials or shared repository writes.
function tree(leaves) {
  const rows = new Map(leaves.map((row) => [row.path, { ...row }]));
  for (const row of leaves) {
    let directory = row.path.split('/').slice(0, -1);
    while (directory.length) {
      const name = directory.join('/');
      rows.set(name, { path: name, type: 'tree', mode: '040000' });
      directory.pop();
    }
  }
  const directories = [
    '',
    ...[...rows.values()].filter((row) => row.type === 'tree').map((row) => row.path),
  ].sort((a, b) => b.split('/').length - a.split('/').length || b.length - a.length);
  let root;
  for (const directory of directories) {
    const direct = [...rows.values()].filter(
      (row) => row.path.split('/').slice(0, -1).join('/') === directory,
    );
    direct.sort((a, b) =>
      Buffer.compare(
        Buffer.from(a.path.split('/').at(-1) + (a.type === 'tree' ? '/' : '')),
        Buffer.from(b.path.split('/').at(-1) + (b.type === 'tree' ? '/' : '')),
      ),
    );
    const body = Buffer.concat(
      direct.flatMap((row) => [
        Buffer.from(row.mode.replace(/^0+/u, '') + ' ' + row.path.split('/').at(-1) + '\0'),
        Buffer.from(row.sha, 'hex'),
      ]),
    );
    const oraclePath = path.join(oracleDirectory, 'tree');
    writeFileSync(oraclePath, body);
    const sha = execFileSync('git', ['hash-object', '-t', 'tree', oraclePath], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (directory) rows.get(directory).sha = sha;
    else root = sha;
  }
  return { sha: root, truncated: false, tree: [...rows.values()] };
}

function largeFixture(extraBefore = [], extraAfter = [], count = 3001) {
  const initial = Array.from({ length: 3000 }, (_, n) => file('files/f' + n, 'old' + n));
  const final = Array.from({ length: 3000 }, (_, n) => file('files/f' + n, 'new' + n));
  const before = tree([...initial, ...extraBefore]);
  const after = tree([...final, ...extraAfter]);
  const comparison = {
    url: 'https://api.github.com/repos/' + repository + '/compare/' + base + '...' + head,
    base_commit: { sha: base },
    merge_base_commit: { sha: base },
    status: 'ahead',
    ahead_by: 2,
    behind_by: 0,
    total_commits: 2,
  };
  const calls = [];
  const api = async (endpoint) => {
    calls.push(endpoint);
    if (endpoint.startsWith('compare/')) return comparison;
    if (endpoint === 'git/commits/' + comparison.merge_base_commit.sha)
      return { sha: comparison.merge_base_commit.sha, tree: { sha: before.sha } };
    if (endpoint === 'git/commits/' + head) return { sha: head, tree: { sha: after.sha } };
    if (endpoint === 'git/trees/' + before.sha + '?recursive=1') return before;
    if (endpoint === 'git/trees/' + after.sha + '?recursive=1') return after;
    throw new Error('Unexpected endpoint: ' + endpoint);
  };
  return { pull: pull(count), before, after, comparison, calls, api };
}
const collect = (f) => completeChangedPaths(f.pull, { api: f.api, repository });

test('ordinary complete inventories retain exact row-count equality at pagination boundaries', async () => {
  for (const count of [1, 99, 100, 101, 2999, 3000]) {
    const paths = Array.from({ length: count }, (_, n) => 'game/file-' + n + '.mjs');
    let calls = 0;
    const result = await completeChangedPaths(pull(count), {
      repository,
      api: async (endpoint) => {
        const page = Number(endpoint.match(/page=(\d+)$/u)[1]);
        calls++;
        return paths.slice((page - 1) * 100, page * 100).map((filename) => ({ filename }));
      },
    });
    assert.deepEqual(result, paths.sort());
    assert.equal(calls, Math.min(30, Math.floor(count / 100) + 1));
  }
});

test('ordinary inventories preserve both renamed paths and deleted paths', async () => {
  const paths = await completeChangedPaths(pull(2), {
    repository,
    api: async () => [
      { filename: 'new.mjs', previous_filename: 'old.mjs', status: 'renamed' },
      { filename: 'deleted.mjs', status: 'removed' },
    ],
  });
  assert.deepEqual(paths, ['deleted.mjs', 'new.mjs', 'old.mjs']);
});

test('ordinary incomplete, duplicate, unsafe and malformed inventory responses fail closed', async () => {
  for (const rows of [
    [],
    [{ filename: 'x' }, { filename: 'x' }],
    {},
    Array.from({ length: 101 }, (_, n) => ({ filename: 'x' + n })),
    [{ filename: '../escape' }],
    [{ filename: 'x\ninjected' }],
    [{ filename: 'x', status: 'renamed' }],
    [{ filename: 'x', previous_filename: '/unsafe' }],
  ]) {
    await assert.rejects(completeChangedPaths(pull(2), { repository, api: async () => rows }));
  }
});

test('recursive tree verification matches Git ordering, symlink and gitlink leaves', () => {
  const rows = [
    file('a.c'),
    file('a/file'),
    file('a0'),
    file('é'),
    file('link', 'symlink', '120000'),
    file('vendor/repo', 'commit', '160000'),
  ];
  const value = tree(rows);
  assert.deepEqual(
    [...verifiedTreeLeaves(value, value.sha).keys()].sort(),
    rows.map((row) => row.path).sort(),
  );
});

test('tree completeness is cryptographic, not just a truncated:false assertion', () => {
  const original = tree([file('a/nested'), file('b')]);
  const mutations = [
    (r) => {
      r.truncated = true;
    },
    (r) => {
      delete r.truncated;
    },
    (r) => {
      r.tree.pop();
    },
    (r) => {
      r.tree = r.tree.filter((row) => row.type !== 'tree');
    },
    (r) => {
      r.tree.push(r.tree[0]);
    },
    (r) => {
      r.tree[0].sha = oid('altered');
    },
    (r) => {
      r.tree[0].mode = '100755';
    },
    (r) => {
      r.tree[0].type = 'commit';
    },
    (r) => {
      r.tree[0].path = '../escape';
    },
    (r) => {
      r.tree[0].path = 'bad\ud800';
    },
    (r) => {
      r.tree[0].path = 'bad\\path';
    },
    (r) => {
      r.sha = oid('another tree');
    },
  ];
  for (const mutation of mutations) {
    const value = structuredClone(original);
    mutation(value);
    assert.throws(() => verifiedTreeLeaves(value, original.sha));
  }
});

test('large inventories retain rename endpoints without claiming equality with rename-paired rows', async () => {
  const f = largeFixture([file('old-name')], [file('new-name', 'old-name')]);
  const result = await collect(f);
  assert.equal(result.length, 3002);
  assert.ok(result.includes('old-name') && result.includes('new-name'));
  assert.equal(f.calls.length, 5);
  assert.ok(f.calls.every((call) => !call.startsWith('pulls/')));
  assert.ok(f.calls[0].endsWith('?per_page=1&page=2'));
});

test('large inventories cover deletions, file modes, symlinks and gitlinks', async () => {
  const f = largeFixture(
    [
      file('deleted'),
      file('executable', 'same'),
      file('link', 'old', '120000'),
      file('submodule', 'old', '160000'),
    ],
    [
      file('executable', 'same', '100755'),
      file('link', 'new', '120000'),
      file('submodule', 'new', '160000'),
    ],
    3004,
  );
  const result = await collect(f);
  for (const name of ['deleted', 'executable', 'link', 'submodule'])
    assert.ok(result.includes(name));
});

test('large count consistency is exact where rename pairing cannot occur', async () => {
  for (const count of [3001, 3003]) {
    const f = largeFixture([], [file('one'), file('two')], count);
    await assert.rejects(collect(f), /changed-file count/u);
  }
  const f = largeFixture([], [file('one'), file('two')], 3002);
  assert.equal((await collect(f)).length, 3002);
});

test('large count mismatches outside possible rename pairing fail closed', async () => {
  for (const count of [3002, 3005]) {
    const f = largeFixture([file('old')], [file('new'), file('added'), file('another')], count);
    await assert.rejects(collect(f), /changed-file count/u);
  }
});

test('merge-base and commit reads are bound to the exact base/head and reject stale metadata', async () => {
  const mutations = [
    (f) => {
      f.comparison.url = f.comparison.url.replace(head, oid('wrong head'));
    },
    (f) => {
      f.comparison.base_commit.sha = oid('wrong base');
    },
    (f) => {
      f.comparison.merge_base_commit.sha = head;
    },
    (f) => {
      f.comparison.merge_base_commit.sha = ancestor;
    },
    (f) => {
      f.comparison.status = 'identical';
    },
    (f) => {
      f.comparison.total_commits = 10;
    },
    (f) => {
      f.comparison.ahead_by = 0;
    },
    (f) => {
      const original = f.api;
      f.api = async (endpoint) =>
        endpoint.startsWith('git/commits/')
          ? { sha: ancestor, tree: { sha: f.before.sha } }
          : original(endpoint);
    },
  ];
  for (const mutation of mutations) {
    const f = largeFixture([], [file('added')]);
    mutation(f);
    await assert.rejects(collect(f), /exact PR|commit identity/u);
  }
});

test('a genuinely diverged PR compares its common ancestor rather than the newer base tip', async () => {
  const f = largeFixture([], [file('added')]);
  f.comparison.status = 'diverged';
  f.comparison.behind_by = 3;
  f.comparison.merge_base_commit.sha = ancestor;
  assert.equal((await collect(f)).length, 3001);
  assert.ok(f.calls.includes('git/commits/' + ancestor));
  assert.ok(!f.calls.includes('git/commits/' + base));
});

test('API failures, truncated trees and invalid inventory counts never return a partial result', async () => {
  const f = largeFixture([], [file('added')]);
  f.after.truncated = true;
  await assert.rejects(collect(f), /Git tree/u);
  for (const count of [0, -1, 1.5, 200001, undefined]) {
    await assert.rejects(
      completeChangedPaths(pull(count), {
        repository,
        api: async () => {
          throw new Error('No request expected');
        },
      }),
      /Invalid or oversized/u,
    );
  }
  await assert.rejects(
    completeChangedPaths(pull(1), {
      repository,
      api: async () => {
        throw new Error('API unavailable');
      },
    }),
    /API unavailable/u,
  );
});

test('preflight retains exact before and after source/dependency binding', async () => {
  for (const mutate of [
    (p) => {
      p.head.sha = ancestor;
    },
    (p) => {
      p.base.sha = ancestor;
    },
    (p) => {
      p.body = 'Depends on #8';
    },
    (p) => {
      p.changed_files = 2;
    },
  ]) {
    const initial = pull(1);
    let reads = 0;
    await assert.rejects(
      admissionPreflight({
        event: { pull_request: structuredClone(initial) },
        repository,
        workflowRevision: base,
        api: async (endpoint) => {
          if (endpoint.includes('/files?')) return [{ filename: 'game/app.mjs' }];
          const value = structuredClone(initial);
          if (++reads === 2) mutate(value);
          return value;
        },
      }),
      /changed during preflight/u,
    );
  }
  let calls = 0;
  await assert.rejects(
    admissionPreflight({
      event: { pull_request: pull(1) },
      repository,
      workflowRevision: base,
      api: async () => {
        calls++;
        return { ...pull(1), head: { sha: ancestor } };
      },
    }),
    /changed before preflight/u,
  );
  assert.equal(calls, 1);
});

test('successful preflight still produces the existing policy-bound receipt and focused plan', async () => {
  const initial = pull(1);
  const result = await admissionPreflight({
    event: { pull_request: structuredClone(initial) },
    repository,
    workflowRevision: base,
    api: async (endpoint) =>
      endpoint.includes('/files?') ? [{ filename: 'game/app.mjs' }] : structuredClone(initial),
  });
  assert.equal(result.receipt.format, 'revealline-admission.v1');
  assert.equal(result.receipt.headSha, head);
  assert.equal(result.receipt.baseSha, base);
  assert.deepEqual(result.receipt.paths, ['game/app.mjs']);
  assert.match(result.receipt.policyDigest, /^[a-f0-9]{64}$/u);
  assert.ok(result.plan.commands.length > 0);
});

test('a full ordinary page must not conceal undeclared files on its next page', async () => {
  const rows = Array.from({ length: 101 }, (_, n) => ({ filename: 'file-' + n }));
  await assert.rejects(
    completeChangedPaths(pull(100), {
      repository,
      api: async (endpoint) => {
        const page = Number(endpoint.match(/page=(\d+)$/u)[1]);
        return rows.slice((page - 1) * 100, page * 100);
      },
    }),
    /exceeds PR count/u,
  );
});

test('API transport is bounded and rejects failed, malformed and non-UTF8 responses', async () => {
  assert.deepEqual(await readAdmissionAPIResponse(new Response('{"ok":true}')), { ok: true });
  await assert.rejects(
    readAdmissionAPIResponse(new Response('forbidden', { status: 403 })),
    /API failed: 403/u,
  );
  await assert.rejects(readAdmissionAPIResponse(new Response('{broken')), SyntaxError);
  await assert.rejects(
    readAdmissionAPIResponse(new Response(new Uint8Array([255]))),
    /encoded data/u,
  );
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(9));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readAdmissionAPIResponse(new Response(body), 8), /byte limit/u);
  assert.equal(cancelled, true);
});

test('stream read failures propagate and release owned reader resources', async () => {
  let cancelled = 0;
  let released = 0;
  const failure = new Error('interrupted body');
  await assert.rejects(
    readAdmissionAPIResponse({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            throw failure;
          },
          cancel: async () => {
            cancelled++;
          },
          releaseLock: () => {
            released++;
          },
        }),
      },
    }),
    (error) => error === failure,
  );
  assert.equal(cancelled, 1);
  assert.equal(released, 1);
});

test('one-commit large PRs use page-two metadata even when its commits array is empty', async () => {
  const f = largeFixture([], [file('added')]);
  f.comparison.ahead_by = 1;
  f.comparison.total_commits = 1;
  f.comparison.commits = [];
  assert.equal((await collect(f)).length, 3001);
});
