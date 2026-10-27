import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionPaths } from './admission-paths.mjs';

const id = (n) => n.toString(16).padStart(40, '0');
const pull = { number: 12, changed_files: 3001, base: { sha: id(1) }, head: { sha: id(2) } };
const leaf = (path, sha = id(10), mode = '100644') => ({ path, sha, mode, type: 'blob' });
function largeFixture({ nested = false, modify = () => {} } = {}) {
  const old = Array.from({ length: 3001 }, (_, i) => leaf(`archive/${i}.json`));
  const retained = [leaf('game/main.mjs')];
  const rows = new Map([
    [
      `compare/${id(1)}...${id(2)}?per_page=1`,
      { base_commit: { sha: id(1) }, merge_base_commit: { sha: id(3) } },
    ],
    [`git/commits/${id(3)}`, { sha: id(3), tree: { sha: id(4) } }],
    [`git/commits/${id(2)}`, { sha: id(2), tree: { sha: id(5) } }],
    [
      `git/trees/${id(4)}?recursive=1`,
      { sha: id(4), truncated: false, tree: [...old, ...retained] },
    ],
    [`git/trees/${id(5)}?recursive=1`, { sha: id(5), truncated: false, tree: retained }],
  ]);
  if (nested) {
    rows.set(`git/trees/${id(4)}?recursive=1`, {
      sha: id(4),
      truncated: true,
      tree: old.slice(0, 5),
    });
    rows.set(`git/trees/${id(4)}`, {
      sha: id(4),
      truncated: false,
      tree: [
        { path: 'archive', sha: id(6), mode: '040000', type: 'tree' },
        { path: 'game', sha: id(7), mode: '040000', type: 'tree' },
      ],
    });
    rows.set(`git/trees/${id(6)}?recursive=1`, {
      sha: id(6),
      truncated: false,
      tree: old.map((row) => ({ ...row, path: row.path.slice(8) })),
    });
    rows.set(`git/trees/${id(7)}?recursive=1`, {
      sha: id(7),
      truncated: false,
      tree: [leaf('main.mjs')],
    });
  }
  modify(rows);
  const calls = [];
  return {
    calls,
    api: async (name) => {
      calls.push(name);
      assert.ok(rows.has(name), `Unexpected request: ${name}`);
      return structuredClone(rows.get(name));
    },
  };
}

test('ordinary PRs retain both rename paths and require complete API pagination', async () => {
  const small = { ...pull, changed_files: 2 };
  assert.deepEqual(
    await admissionPaths(small, async () => [
      { filename: 'new.txt', previous_filename: 'old.txt' },
      { filename: 'changed.txt' },
    ]),
    ['changed.txt', 'new.txt', 'old.txt'],
  );
  await assert.rejects(
    admissionPaths(small, async () => [{ filename: 'new.txt' }]),
    /Incomplete/,
  );
  await assert.rejects(
    admissionPaths(small, async () => [{ filename: 'new.txt' }, { filename: 'new.txt' }]),
    /duplicate/,
  );
});

test('a retirement beyond 3,000 files includes every deleted path using the merge base', async () => {
  const { api, calls } = largeFixture();
  const paths = await admissionPaths(pull, api);
  assert.equal(paths.length, 3001);
  assert.ok(paths.includes('archive/3000.json'));
  assert.equal(paths.includes('game/main.mjs'), false);
  assert.ok(calls.includes(`git/commits/${id(3)}`));
  assert.equal(
    calls.some((name) => name.includes('/files?')),
    false,
  );
});

test('truncated recursive trees are discarded and rebuilt from complete subtrees', async () => {
  const { api, calls } = largeFixture({ nested: true });
  assert.equal((await admissionPaths(pull, api)).length, 3001);
  assert.ok(calls.includes(`git/trees/${id(4)}`));
  assert.ok(calls.includes(`git/trees/${id(6)}?recursive=1`));
});

test('large inventories include rename sources, executable changes, and submodules', async () => {
  const { api } = largeFixture({
    modify(rows) {
      const before = rows.get(`git/trees/${id(4)}?recursive=1`).tree;
      before.push(leaf('old-name'), leaf('tool.sh'), {
        path: 'module',
        sha: id(8),
        mode: '160000',
        type: 'commit',
      });
      const after = rows.get(`git/trees/${id(5)}?recursive=1`).tree;
      after.push(leaf('new-name'), leaf('tool.sh', id(10), '100755'), {
        path: 'module',
        sha: id(9),
        mode: '160000',
        type: 'commit',
      });
    },
  });
  const paths = await admissionPaths({ ...pull, changed_files: 3004 }, api);
  for (const name of ['old-name', 'new-name', 'tool.sh', 'module']) assert.ok(paths.includes(name));
  assert.equal(paths.length, 3005);
});

test('missing tree data, mismatched identities, unsafe paths and count drift fail closed', async () => {
  const cases = [
    (rows) => {
      rows.get(`git/commits/${id(2)}`).sha = id(9);
    },
    (rows) => {
      rows.get(`compare/${id(1)}...${id(2)}?per_page=1`).base_commit.sha = id(9);
    },
    (rows) => {
      rows.get(`git/trees/${id(4)}?recursive=1`).sha = id(9);
    },
    (rows) => {
      rows.get(`git/trees/${id(4)}?recursive=1`).tree[0].path = '../outside';
    },
    (rows) => {
      rows.get(`git/trees/${id(4)}?recursive=1`).tree.push(leaf('archive/0.json'));
    },
    (rows) => {
      rows.get(`git/trees/${id(4)}?recursive=1`).tree = [];
    },
  ];
  for (const modify of cases)
    await assert.rejects(admissionPaths(pull, largeFixture({ modify }).api));
  const { api } = largeFixture({
    nested: true,
    modify(rows) {
      rows.get(`git/trees/${id(4)}`).truncated = true;
    },
  });
  await assert.rejects(admissionPaths(pull, api), /Incomplete/);
});
