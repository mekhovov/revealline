import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./write-main-pages-metadata.mjs', import.meta.url));
const workflow = await readFile(
  new URL('../.github/workflows/publish-main-pages.yml', import.meta.url),
  'utf8',
);
const step = workflow
  .split('      - name: Add rolling-channel identity metadata\n')[1]
  .split('\n      - name:')[0];
const identity = {
  SOURCE_SHA: 'a'.repeat(40),
  SOURCE_COMMITTED_AT: '2026-10-16T02:00:00+02:00',
  BUILD_VERSION: 'main-aaaaaaaaaaaa',
};
// Deliberately fake public gate metadata, never a real password or verifier.
const dummyTags = ['id', 'salt', 'iterations', 'verifier'].map(
  (name) => `<meta name="revealline-access-${name}" content="test-only-${name}">`,
);
const expectedJSON = `{
  "format": "revealline-main-deployment.v1",
  "channel": "main",
  "sourceRevision": "${identity.SOURCE_SHA}",
  "sourceCommittedAt": "2026-10-16T02:00:00+02:00",
  "buildVersion": "main-aaaaaaaaaaaa",
  "play": "game/",
  "releases": "https://github.com/mekhovov/revealline/releases"
}
`;
// Complete frozen output from the pre-extraction implementation, not a call to
// the production helper under test. Its byte digest is independently anchored.
const expectedHTML = [
  '<!doctype html><html data-access-state="locked">',
  '<meta charset="utf-8">',
  '<!-- access-gate:start -->',
  ...dummyTags,
  '<style>html:not([data-access-state="unlocked"]) body > :not(#access-gate):not(script) { display: none !important; }</style>',
  '<link rel="stylesheet" href="../game/access-gate.css">',
  '<script src="../game/access-gate.mjs" defer></script>',
  '<!-- access-gate:end -->',
  '<title>RevealLine releases</title><p>Immutable downloads and release notes are available on <a href="https://github.com/mekhovov/revealline/releases">GitHub</a>.</html>',
].join('\n');

async function fixture(t, config = dummyTags.join('\n')) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages metadata parity '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'main-pages');
  await mkdir(path.join(root, 'game'), { recursive: true });
  if (config !== null) await writeFile(path.join(root, 'game/index.html'), config);
  return { directory, root, config };
}
const read = (f, name) => readFile(path.join(f.root, name), 'utf8');
function run(f) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, ...identity, RUNNER_TEMP: f.directory },
  });
}

test('metadata extraction preserves the frozen production body except one relative import', async () => {
  const text = await readFile(script, 'utf8');
  assert.ok(text.endsWith('\n'));
  assert.equal(text.split("from './access-pages.mjs'").length, 2);
  const normalized = text
    .slice(0, -1)
    .replace("from './access-pages.mjs'", "from './scripts/access-pages.mjs'");
  assert.equal(
    createHash('sha256').update(normalized).digest('hex'),
    'e859bca5b49c90d92ea23d0fdd2de06a0f0f7420dc1053b675ff5244d88cbf55',
  );
});

test('metadata invocation retains source/date inputs and final-staging order', () => {
  assert.match(step, /BUILD_VERSION: \$\{\{ steps.identity.outputs.build_version \}\}/);
  assert.match(step, /SOURCE_SHA: \$\{\{ steps.identity.outputs.source_sha \}\}/);
  assert.ok(
    step.includes(
      'SOURCE_COMMITTED_AT="$(git show -s --format=%cI "$SOURCE_SHA")" \\\n            node scripts/write-main-pages-metadata.mjs',
    ),
  );
  assert.doesNotMatch(step, /continue-on-error|if:|<<'NODE'/);
  const names = [
    'Build the rolling main snapshot',
    'Stage reviewed Flight practice releases (including an explicit empty directory)',
    'Add rolling-channel identity metadata',
    'Verify Pages capacity and record the exact inventory',
  ];
  const positions = names.map((name) => workflow.indexOf(`      - name: ${name}\n`));
  assert.ok(positions.every((position, i) => position >= 0 && (!i || position > positions[i - 1])));
});

for (const existingDirectory of [false, true])
  test(`exact JSON and protected HTML bytes with releases directory ${existingDirectory ? 'present' : 'absent'}`, async (t) => {
    const f = await fixture(t);
    assert.ok(f.directory.includes(' '));
    if (existingDirectory) await mkdir(path.join(f.root, 'releases'));
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(f, 'main-deployment.json'), expectedJSON);
    assert.equal(await read(f, 'release.json'), expectedJSON);
    const html = await read(f, 'releases/index.html');
    assert.equal(html, expectedHTML);
    assert.equal(
      createHash('sha256').update(html).digest('hex'),
      'c86dd1a7649f34e45cd336e46667a8a5573e777203b4965df70cc53ece848762',
    );
    assert.equal(html.split('<!-- access-gate:start -->').length, 2);
    assert.equal(await read(f, 'game/index.html'), f.config);
  });

for (const target of ['main-deployment.json', 'release.json', 'releases/index.html'])
  test(`exclusive creation preserves an existing ${target}`, async (t) => {
    const f = await fixture(t);
    const existing = 'existing output must survive exactly\n';
    await mkdir(path.dirname(path.join(f.root, target)), { recursive: true });
    await writeFile(path.join(f.root, target), existing);
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EEXIST/);
    assert.equal(await read(f, target), existing);
    if (target !== 'main-deployment.json')
      assert.equal(await read(f, 'main-deployment.json'), expectedJSON);
    if (target === 'releases/index.html') assert.equal(await read(f, 'release.json'), expectedJSON);
    else if (target === 'main-deployment.json')
      await assert.rejects(read(f, 'release.json'), { code: 'ENOENT' });
    if (target !== 'releases/index.html')
      await assert.rejects(read(f, 'releases/index.html'), { code: 'ENOENT' });
  });

for (const count of [0, 1, 3])
  test(`${count} gate fields fail without writing an unprotected releases page`, async (t) => {
    const f = await fixture(t, dummyTags.slice(0, count).join('\n'));
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /shared password configuration is incomplete/);
    await assert.rejects(read(f, 'releases/index.html'), { code: 'ENOENT' });
    // Original behavior is intentionally nontransactional: these writes precede
    // gate validation. Extraction must not silently change those semantics.
    assert.equal(await read(f, 'main-deployment.json'), expectedJSON);
    assert.equal(await read(f, 'release.json'), expectedJSON);
  });

test('missing built game entry fails without writing an unprotected releases page', async (t) => {
  const f = await fixture(t, null);
  const result = run(f);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
  await assert.rejects(read(f, 'releases/index.html'), { code: 'ENOENT' });
  assert.equal(await read(f, 'main-deployment.json'), expectedJSON);
  assert.equal(await read(f, 'release.json'), expectedJSON);
});
