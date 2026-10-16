import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  freezeCandidateOverlay,
  recheckCandidateOverlay,
  trustedImportClosure,
} from './pages-candidate-overlay.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const empty = { format: 'revealline-optional-package-publication.v1', releases: [] };
const selected = {
  ...empty,
  releases: [
    {
      version: 'v1.2.3',
      envelopeSha256: 'a'.repeat(64),
      reviewSha256: 'b'.repeat(64),
      basePath: '/revealline/',
      packageIds: ['civilian-flight'],
      activePackageIds: ['civilian-flight'],
    },
  ],
};
function fixture() {
  const bytes = Buffer.from('tiny fixture');
  const release = {
    id: 17,
    tag_name: 'v1.2.3',
    draft: false,
    prerelease: false,
    assets: [{ id: 25, name: 'tiny.zip', size: bytes.length, state: 'uploaded' }],
  };
  const commit = { sha: 'c'.repeat(40), commit: { tree: { sha: 'd'.repeat(40) } } };
  const calls = [];
  const options = {
    api: async (endpoint) => {
      calls.push(endpoint);
      if (endpoint === 'repos/mekhovov/revealline/releases/tags/v1.2.3') return release;
      assert.equal(endpoint, 'repos/mekhovov/revealline/commits/tags/v1.2.3');
      return commit;
    },
    readAsset: async (asset) => {
      calls.push(asset);
      return bytes;
    },
    renderOverlay: async (selector, reader) => {
      assert.equal(selector.releases[0].version, 'v1.2.3');
      assert.equal(reader.targetBasePath, '/revealline/');
      assert.deepEqual(await reader.resolveReleaseIdentity('v1.2.3'), {
        sourceRevision: commit.sha,
        sourceTree: commit.commit.tree.sha,
      });
      const data = await reader.readReleaseAsset('v1.2.3', 'tiny.zip', 100);
      assert.deepEqual(await reader.readReleaseAsset('v1.2.3', 'tiny.zip', 100), data);
      return new Map([['practice/example.bin', data]]);
    },
  };
  return { bytes, release, commit, calls, options };
}

test('empty selector integrates the real production renderer without external requests', async () => {
  const deny = async () => assert.fail('Empty selector made an external request.');
  const result = await freezeCandidateOverlay(Buffer.from(JSON.stringify(empty) + '\n'), {
    api: deny,
    readAsset: deny,
  });
  assert.deepEqual([...result.overlay.keys()].sort(), [
    'practice/details.json',
    'practice/directory.mjs',
    'practice/index.html',
    'practice/index.json',
  ]);
  assert.deepEqual(result.identity.releases, []);
  assert.equal(result.identity.repository, 'mekhovov/revealline');
  assert.equal(result.identity.selectorSha256, digest(Buffer.from(JSON.stringify(empty) + '\n')));
  assert.equal(result.identity.files.length, 4);
});

test('freezes exact asset IDs, bytes, checksums and complete overlay closure', async () => {
  const f = fixture();
  const result = await freezeCandidateOverlay(selected, f.options);
  assert.deepEqual(result.identity.releases, [
    {
      version: 'v1.2.3',
      releaseId: 17,
      tag: 'v1.2.3',
      sourceRevision: 'c'.repeat(40),
      sourceTree: 'd'.repeat(40),
      assets: [{ name: 'tiny.zip', assetId: 25, bytes: f.bytes.length, sha256: digest(f.bytes) }],
    },
  ]);
  assert.deepEqual(result.identity.files, [
    { path: 'practice/example.bin', bytes: f.bytes.length, sha256: digest(f.bytes) },
  ]);
  assert.equal(f.calls.filter((call) => typeof call === 'object').length, 1);
  assert.deepEqual(f.calls[2], {
    repository: 'mekhovov/revealline',
    version: 'v1.2.3',
    name: 'tiny.zip',
    id: 25,
    size: f.bytes.length,
    limit: 100,
    releaseId: 17,
  });
});

test('rechecking redownloads and rejects changed bytes even at the same size and ID', async () => {
  const f = fixture();
  const first = await freezeCandidateOverlay(selected, f.options);
  await recheckCandidateOverlay(selected, first.identity, f.options);
  assert.equal(f.calls.filter((call) => typeof call === 'object').length, 2);
  f.options.readAsset = async () => Buffer.from('Tiny fixture');
  await assert.rejects(recheckCandidateOverlay(selected, first.identity, f.options), /changed/);
});

for (const field of ['id', 'tag_name', 'draft', 'prerelease']) {
  test(`rejects changed/nonstable release ${field}`, async () => {
    const f = fixture();
    const first = await freezeCandidateOverlay(selected, f.options);
    f.release[field] = { id: 18, tag_name: 'v9.9.9', draft: true, prerelease: true }[field];
    await assert.rejects(recheckCandidateOverlay(selected, first.identity, f.options));
  });
}

test('rejects duplicate asset names and IDs', async () => {
  for (const duplicate of [{ id: 26 }, { name: 'other.zip' }]) {
    const f = fixture();
    f.release.assets.push({ ...f.release.assets[0], ...duplicate });
    await assert.rejects(freezeCandidateOverlay(selected, f.options), /ambiguous/);
  }
});

test('rejects absent/incomplete/oversized assets and download length mismatches', async () => {
  for (const change of [
    (f) => {
      f.release.assets = [];
    },
    (f) => {
      f.release.assets[0].state = 'new';
    },
    (f) => {
      f.release.assets[0].size = 101;
    },
    (f) => {
      f.options.readAsset = async () => Buffer.from('short');
    },
  ]) {
    const f = fixture();
    change(f);
    await assert.rejects(freezeCandidateOverlay(selected, f.options));
  }
});

test('recheck rejects tag commit/tree and asset identity changes', async () => {
  for (const change of [
    (f) => {
      f.commit.sha = 'e'.repeat(40);
    },
    (f) => {
      f.commit.commit.tree.sha = 'f'.repeat(40);
    },
    (f) => {
      f.release.assets[0].id = 26;
    },
  ]) {
    const f = fixture();
    const first = await freezeCandidateOverlay(selected, f.options);
    change(f);
    await assert.rejects(recheckCandidateOverlay(selected, first.identity, f.options), /changed/);
  }
});

test('rejects a foreign deployment target and unsafe overlay paths', async () => {
  const f = fixture();
  await assert.rejects(
    freezeCandidateOverlay(
      {
        ...selected,
        releases: [{ ...selected.releases[0], basePath: '/other/' }],
      },
      f.options,
    ),
    /another deployment target/,
  );
  for (const name of ['practice/../escape', 'practice/.hidden', 'game/index.html', '/practice/a']) {
    await assert.rejects(
      freezeCandidateOverlay(empty, {
        ...f.options,
        renderOverlay: async () => new Map([[name, Buffer.from('x')]]),
      }),
      /unsafe/,
    );
  }
});

test('selector byte identity and unexpected overlay additions are included in recheck', async () => {
  const f = fixture();
  const original = Buffer.from(JSON.stringify(selected));
  const first = await freezeCandidateOverlay(original, f.options);
  await assert.rejects(
    recheckCandidateOverlay(Buffer.from(original.toString() + '\n'), first.identity, f.options),
    /changed/,
  );
  const render = f.options.renderOverlay;
  f.options.renderOverlay = async (...args) => {
    const overlay = await render(...args);
    overlay.set('practice/unexpected.bin', Buffer.from('extra'));
    return overlay;
  };
  await assert.rejects(recheckCandidateOverlay(original, first.identity, f.options), /changed/);
});

test('rejects malformed selectors, unselected downloads and malformed tag identities', async () => {
  const f = fixture();
  await assert.rejects(freezeCandidateOverlay(Buffer.from('{'), f.options));
  await assert.rejects(freezeCandidateOverlay(Buffer.alloc(1024 * 1024 + 1), f.options), /bound/);
  f.commit.sha = 'not-a-sha';
  await assert.rejects(freezeCandidateOverlay(selected, f.options), /commit\/tree/);
  f.commit.sha = 'c'.repeat(40);
  for (const [version, limit] of [
    ['v9.9.9', 100],
    ['v1.2.3', 0],
    ['v1.2.3', 950_000_001],
  ]) {
    f.options.renderOverlay = async (_selector, reader) => {
      await reader.readReleaseAsset(version, 'tiny.zip', limit);
      return new Map();
    };
    await assert.rejects(freezeCandidateOverlay(selected, f.options), /unselected or unbounded/);
  }
});

test('trusted import closure parses imports, reexports and literal dynamic imports with cycles', async () => {
  const source = new Map([
    [
      'publishing/main.mjs',
      `import './b.mjs'; export * from '../game/c.mjs';
      export { value } from './b.mjs'; const deferred = () => import('./d.mjs');
      import 'node:fs'; import 'pinned-package/subpath';
      // import './not-real.mjs';
      const text = "import './also-not-real.mjs'";`,
    ],
    ['publishing/b.mjs', `import './main.mjs'; export const value = 1;`],
    ['game/c.mjs', `export * from '../publishing/d.mjs';`],
    ['publishing/d.mjs', 'export const value = 2;'],
  ]);
  const reads = [];
  const closure = await trustedImportClosure('publishing/main.mjs', {
    readSource: async (file) => {
      reads.push(file);
      return source.get(file);
    },
  });
  assert.deepEqual(closure, {
    paths: ['game/c.mjs', 'publishing/b.mjs', 'publishing/d.mjs', 'publishing/main.mjs'],
    packages: ['pinned-package/subpath'],
  });
  assert.equal(reads.length, 4);
});

test('trusted import closure rejects nonliteral import and require even inside deferred code', async () => {
  for (const source of [
    'const later = (name) => import(name);',
    'const later = () => import(`./literal-looking.mjs`);',
    'const later = () => require("node:fs");',
  ]) {
    await assert.rejects(
      trustedImportClosure('main.mjs', {
        readSource: async () => source,
      }),
      /unsupported/,
    );
  }
});

test('trusted import closure rejects escaped, absent and remote source dependencies', async () => {
  for (const source of [
    `import '../escape.mjs';`,
    `import 'https://example.com/code.mjs';`,
    `import './missing.mjs';`,
  ]) {
    await assert.rejects(
      trustedImportClosure('main.mjs', {
        readSource: async (file) => (file === 'main.mjs' ? source : undefined),
      }),
    );
  }
});

test('trusted import closure includes JSON data without treating its strings as code', async () => {
  assert.deepEqual(
    await trustedImportClosure('data.json', {
      readSource: async () => '{"code":"import(name)"}',
    }),
    { paths: ['data.json'], packages: [] },
  );
});
