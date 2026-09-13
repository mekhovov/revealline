import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { readBuildConfig, collectBuildFiles, buildProject } from '../../scripts/game-cli.mjs';
import { planCurrentEntries } from '../../scripts/pages-current-entry.mjs';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const workshopEntries = [
  'authoring/still-media/index.html',
  'authoring/still-media/launch.js',
  'authoring/still-media/workshop.mjs',
];
const requiredRuntime = [
  'game/ui/still-media-host.mjs',
  'game/ui/still-media-panel.mjs',
  'game/ui/still-media-panel.css',
  'game/ui/still-media-catalog.mjs',
  'game/ui/still-media-preview.mjs',
  'game/media-bundle.mjs',
  'game/media-store.mjs',
  'game/managed-media-store.mjs',
  'game/content/campaign.json',
  'game/content/classes.json',
  'game/content/themes.json',
  'authoring/motion-lab/presets.json',
];

test('actual release allowlist ships the standalone still entry and exact existing runtime/content dependencies', async () => {
  const config = await readBuildConfig(sourceRoot),
    files = await collectBuildFiles(sourceRoot, config);
  for (const name of [...workshopEntries, ...requiredRuntime])
    assert.ok(files.includes(name), `Missing workshop distribution dependency: ${name}`);
  assert.equal(config.include.filter((entry) => entry === 'authoring/still-media').length, 1);
  assert.equal(
    files.some((name) => name.startsWith('game/test/')),
    false,
  );
  assert.equal(
    files.some((name) => name.startsWith('authoring/library/')),
    false,
    'Generated originals are not implicitly distributed.',
  );
});

async function fixture(t) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'still-workshop-build-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source'),
    originals = new Map();
  const put = async (name, bytes) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), bytes);
  };
  const copy = async (name) => {
    if (originals.has(name)) return;
    const bytes = await fs.readFile(path.join(sourceRoot, name));
    originals.set(name, bytes);
    await put(name, bytes);
    if (!/\.m?js$/.test(name)) return;
    for (const match of bytes
      .toString()
      .matchAll(
        /(?:^|[;\r\n])\s*(?:import\b\s*(?:[^;"']*?\bfrom\s*)?|export\b[^;"']*?\bfrom\s*)["']([^"']+)["']/g,
      )) {
      assert.ok(
        match[1].startsWith('.'),
        `Workshop graph has an unexpected external import: ${match[1]}`,
      );
      await copy(path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1])));
    }
  };
  // Exact workshop modules and their transitive literal import graph. Include the
  // launcher's known dynamic workshop import explicitly. No game/app or earned
  // state is run; the unrelated game HTML below is a declared fixture entry.
  for (const name of [
    ...workshopEntries,
    'game/ui/still-media-panel.css',
    'game/offline.mjs',
    'game/offline/service-worker.template.js',
  ])
    await copy(name);
  await put(
    'game/index.html',
    '<!doctype html><html><head></head><body>Inert build fixture</body></html>',
  );
  await put(
    'game/build-config.json',
    JSON.stringify({
      version: '0.32.0',
      entry: 'game/index.html',
      include: ['game', 'authoring/still-media', 'authoring/motion-lab'],
    }),
  );
  return { directory, root, originals };
}
function zipEntries(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(
      bytes.readUInt16LE(offset + 8),
      0,
      'Fixture verifies original uncompressed payload bytes.',
    );
    const length = bytes.readUInt32LE(offset + 18),
      nameLength = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extra,
      name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    assert.equal(files.has(name), false);
    files.set(name, bytes.subarray(start, start + length));
    offset = start + length;
  }
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
  return files;
}

for (const version of ['0.32.0', 'v0.32.0'])
  test(`built workshop ${version} retains exact entry bytes in loose/ZIP/offline data and opens its generated channel`, async (t) => {
    const f = await fixture(t),
      out = path.join(f.directory, 'distribution');
    await buildProject({ root: f.root, out, version, sourceRevision: 'a'.repeat(40) });
    const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8')),
      offline = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json'), 'utf8')),
      zip = zipEntries(await fs.readFile(path.join(out, 'distribution.zip')));
    for (const name of [
      ...workshopEntries,
      'game/ui/still-media-host.mjs',
      'game/ui/still-media-panel.css',
      'game/media-bundle.mjs',
      'game/build-info.json',
    ]) {
      const bytes = await fs.readFile(path.join(out, name));
      if (f.originals.has(name)) assert.deepEqual(bytes, f.originals.get(name));
      for (const list of [manifest.files, offline.files]) {
        const entry = list.find((row) => row.path === name);
        assert.ok(entry, `${name} missing from inventory`);
        assert.equal(entry.sha256, digest(bytes));
        assert.equal(entry.bytes, bytes.length);
      }
      assert.deepEqual(zip.get(name), bytes);
    }
    assert.equal(offline.version, version);
    const { readStillWorkshopChannel } = await import(
      pathToFileURL(path.join(out, 'game/ui/still-media-host.mjs')).href
    );
    let calls = 0;
    assert.equal(
      await readStillWorkshopChannel({
        fetchImpl: async (url) => {
          ++calls;
          assert.equal(url.href, pathToFileURL(path.join(out, 'game/build-info.json')).href);
          return new Response(await fs.readFile(fileURLToPath(url)), { status: 200 });
        },
      }),
      `release-${version}`,
    );
    assert.equal(
      calls,
      1,
      'Build metadata is read once, without opening storage or starting the game.',
    );
  });

test('Pages automatically gives the shipped workshop an immutable same-edition HTML route, preserving query and fragment', async (t) => {
  const f = await fixture(t),
    out = path.join(f.directory, 'frozen-site'),
    version = 'v0.32.0';
  await buildProject({ root: f.root, out, version, sourceRevision: 'b'.repeat(40) });
  const manifest = await fs.readFile(path.join(out, 'manifest.json'));
  const plan = await planCurrentEntries({
    source: out,
    repository: 'owner/game',
    record: { version, sourceRevision: 'b'.repeat(40), manifestSha256: digest(manifest) },
  });
  const name = 'authoring/still-media/index.html',
    entry = plan.metadata.htmlEntries.find((row) => row.path === name);
  assert.ok(entry);
  assert.equal(entry.target, `https://owner.github.io/game/releases/${version}/site/${name}`);
  for (const prefix of ['https://owner.github.io/game/', 'http://localhost:8888/preview/']) {
    for (const suffix of ['authoring/still-media', 'authoring/still-media/', name]) {
      const current = new URL(`${prefix}${suffix}?restore=1#originals`),
        link = {};
      let destination;
      vm.runInNewContext(plan.files.get(name).match(/<script>([\s\S]*?)<\/script>/)[1], {
        URL,
        location: {
          href: current.href,
          search: current.search,
          hash: current.hash,
          replace: (url) => (destination = url),
        },
        document: { querySelector: () => link },
      });
      assert.equal(destination, `${prefix}releases/${version}/site/${name}?restore=1#originals`);
      const moduleURL = new URL('../../game/ui/still-media-host.mjs', destination);
      assert.equal(
        new URL('../build-info.json', moduleURL).href,
        `${prefix}releases/${version}/site/game/build-info.json`,
      );
      assert.equal(
        new URL('../../game/', destination).href,
        `${prefix}releases/${version}/site/game/`,
      );
    }
  }
  assert.ok(
    plan.metadata.navigationRoutes.some(
      (row) => row.from === 'authoring/still-media/' && row.to === 'authoring/still-media/',
    ),
  );
  assert.deepEqual(
    await fs.readFile(path.join(out, name)),
    f.originals.get(name),
    'Alias planning does not rewrite the frozen workshop.',
  );
});
