import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import vm from 'node:vm';
import { writeDemoRecordings } from './build-demo-recordings.mjs';
import { importDemoRuntimeVariants } from './import-demo-runtime-variants.mjs';

const execute = promisify(execFile);
const game = new URL('../game/', import.meta.url);
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const json = async (url) => JSON.parse(await fs.readFile(url, 'utf8'));
const catalog = await json(new URL('demo-data/catalog.json', game));
const manifest = await json(new URL('demo-data/variant-provenance.json', game));
const oldClip = catalog.clips[0];
const newClip = catalog.clips.find((clip) => clip.id === 'stone-lanes-detour');
const sourceFor = async (clip) => ({
  replay: await json(new URL(clip.replayURL, game)),
  browser: await json(new URL(clip.replayVariants[0], game)),
});
const old = await sourceFor(oldClip);
const added = await sourceFor(newClip);

async function fixture(t, mode) {
  const directory = await fs.realpath(
    await fs.mkdtemp(join(tmpdir(), 'revealline-demo-authoring-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = pathToFileURL(`${directory}/game/`);
  await fs.mkdir(new URL('demo-data/', root), { recursive: true });
  const descriptor = { ...newClip, replayVariants: [] };
  const generated = [
    { replay: old.replay, descriptor: oldClip },
    { replay: added.replay, descriptor },
  ];
  const previous = { ...manifest, variants: [manifest.variants[0]] };
  const put = async (path, value) => fs.writeFile(new URL(path, root), jsonText(value));
  await put(oldClip.replayURL, old.replay);
  await put(oldClip.replayVariants[0], old.browser);
  await put('demo-data/catalog.json', {
    format: catalog.format,
    clips: mode === 'extend' ? [oldClip] : [oldClip, descriptor],
  });
  await put('demo-data/variant-provenance.json', previous);
  if (mode === 'append') await put(newClip.replayURL, added.replay);
  const bundle = {
    format: 'revealline-demo-browser-authoring.v1',
    createdAt: '2026-09-29T15:01:27.852Z',
    userAgent: 'fixture browser (existing frozen recordings)',
    platform: 'fixture',
    mathWitness: { sin: 0.5 },
    clips: [
      [oldClip, old],
      [newClip, added],
    ].map(([clip, data]) => ({
      id: clip.id,
      sourceURL: clip.replayURL,
      sourceCheckpoint: data.replay.checkpoint,
      originalDiagnostics: [{ code: 'state-mismatch', section: 'enemies' }],
      replay: data.browser,
    })),
  };
  const bytes = async (path) => fs.readFile(new URL(path, root), 'utf8');
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        (await fs.readdir(new URL('demo-data/', root)))
          .sort()
          .map(async (name) => [name, await bytes(`demo-data/${name}`)]),
      ),
    );
  return { directory, root, generated, previous, bundle, put, bytes, snapshot };
}

test('extension rejects missing historical evidence before adding files', async (t) => {
  const f = await fixture(t, 'extend');
  await fs.unlink(new URL(oldClip.replayURL, f.root));
  const before = await f.snapshot();
  await assert.rejects(
    writeDemoRecordings(f.generated, { mode: 'extend', gameRoot: f.root }),
    /Missing historical recording/,
  );
  assert.deepEqual(await f.snapshot(), before);
});

test('extension atomically preserves its old catalogue on rename failure and resumes exact additions', async (t) => {
  const f = await fixture(t, 'extend');
  const oldCatalog = await f.bytes('demo-data/catalog.json');
  const oldReplay = await f.bytes(oldClip.replayURL);
  const io = {
    ...fs,
    rename: async () => {
      throw Object.assign(Error('Disk full'), { code: 'ENOSPC' });
    },
  };
  await assert.rejects(
    writeDemoRecordings(f.generated, { mode: 'extend', gameRoot: f.root, io }),
    /Disk full/,
  );
  assert.equal(await f.bytes('demo-data/catalog.json'), oldCatalog);
  assert.equal(await f.bytes(oldClip.replayURL), oldReplay);
  assert.equal(await f.bytes(newClip.replayURL), jsonText(added.replay));
  assert.ok(
    (await fs.readdir(new URL('demo-data/', f.root))).every((name) => !name.includes('.tmp-')),
  );
  await writeDemoRecordings(f.generated, { mode: 'extend', gameRoot: f.root });
  assert.equal((await json(new URL('demo-data/catalog.json', f.root))).clips.length, 2);
  assert.equal(await f.bytes(oldClip.replayURL), oldReplay);
  const completed = await f.snapshot();
  await writeDemoRecordings(f.generated, { mode: 'extend', gameRoot: f.root });
  assert.deepEqual(await f.snapshot(), completed);
});

test('extension rejects a conflicting orphan instead of accepting only its matching input trace', async (t) => {
  const f = await fixture(t, 'extend');
  await f.put(newClip.replayURL, { ...added.replay, build: 'unreviewed replacement' });
  const before = await f.snapshot();
  await assert.rejects(
    writeDemoRecordings(f.generated, { mode: 'extend', gameRoot: f.root }),
    /unregistered recording/,
  );
  assert.deepEqual(await f.snapshot(), before);
});

test('append preserves its old manifest on a partial temporary write and resumes exact orphan files', async (t) => {
  const f = await fixture(t, 'append');
  f.previous.reviewNote = 'Preserve this historical review context.';
  await f.put('demo-data/variant-provenance.json', f.previous);
  const oldManifest = await f.bytes('demo-data/variant-provenance.json');
  const oldBrowser = await f.bytes(oldClip.replayVariants[0]);
  const io = {
    ...fs,
    async writeFile(url, text, options) {
      if (url.href.includes('.tmp-')) {
        await fs.writeFile(url, text.slice(0, 32), options);
        throw Object.assign(Error('Partial metadata write'), { code: 'ENOSPC' });
      }
      return fs.writeFile(url, text, options);
    },
  };
  await assert.rejects(
    importDemoRuntimeVariants(f.bundle, { root: f.root, append: true, io }),
    /Partial metadata write/,
  );
  assert.equal(await f.bytes('demo-data/variant-provenance.json'), oldManifest);
  assert.equal(await f.bytes(newClip.replayVariants[0]), jsonText(added.browser));
  assert.ok(
    (await fs.readdir(new URL('demo-data/', f.root))).every((name) => !name.includes('.tmp-')),
  );
  assert.equal(await importDemoRuntimeVariants(f.bundle, { root: f.root, append: true }), 1);
  const result = await json(new URL('demo-data/variant-provenance.json', f.root));
  assert.deepEqual(result.variants[0], f.previous.variants[0]);
  assert.equal(result.createdAt, f.previous.createdAt);
  assert.equal(result.userAgent, f.previous.userAgent);
  assert.equal(result.reviewNote, f.previous.reviewNote);
  assert.equal(result.variants[1].recordedIn.createdAt, f.bundle.createdAt);
  assert.equal(await f.bytes(oldClip.replayVariants[0]), oldBrowser);
  const completed = await f.snapshot();
  assert.equal(await importDemoRuntimeVariants(f.bundle, { root: f.root, append: true }), 0);
  assert.deepEqual(await f.snapshot(), completed);
});

test('append rejects conflicting historical and orphan recordings without changing any file', async (t) => {
  for (const path of [oldClip.replayVariants[0], newClip.replayVariants[0]]) {
    const f = await fixture(t, 'append');
    const value = path === oldClip.replayVariants[0] ? old.browser : added.browser;
    await f.put(path, { ...value, build: 'unreviewed replacement' });
    const before = await f.snapshot();
    await assert.rejects(
      importDemoRuntimeVariants(f.bundle, { root: f.root, append: true }),
      /cannot replace|unregistered browser recording/,
    );
    assert.deepEqual(await f.snapshot(), before);
  }
});

async function commandFixture(f) {
  await fs.mkdir(join(f.directory, 'scripts'));
  for (const name of ['build-demo-recordings.mjs', 'import-demo-runtime-variants.mjs'])
    await fs.copyFile(new URL(name, import.meta.url), join(f.directory, 'scripts', name));
  // Only two scripts and tiny mutable JSON fixtures are copied. Imports/content
  // point to read-only source files; demo-data is always the private fixture.
  for (const name of [
    'core',
    'content',
    ...(await fs.readdir(game)).filter((name) => name.endsWith('.mjs')),
  ])
    await fs.symlink(fileURLToPath(new URL(name, game)), new URL(name, f.root));
}

test('actual CLI entry points reject a missing historical source and append only inside their temporary root', async (t) => {
  const f = await fixture(t, 'append');
  await commandFixture(f);
  const bundlePath = join(f.directory, 'browser-bundle.json');
  await fs.writeFile(bundlePath, jsonText(f.bundle));
  const result = await execute(process.execPath, [
    join(f.directory, 'scripts/import-demo-runtime-variants.mjs'),
    bundlePath,
    '--append',
  ]);
  assert.match(result.stdout, /Imported 1 frozen browser recording/);
  assert.equal(
    (await json(new URL('demo-data/variant-provenance.json', f.root))).variants.length,
    2,
  );
  await f.put('demo-data/catalog.json', { format: catalog.format, clips: [oldClip] });
  await fs.unlink(new URL(oldClip.replayURL, f.root));
  const before = await f.snapshot();
  await assert.rejects(
    execute(process.execPath, [join(f.directory, 'scripts/build-demo-recordings.mjs'), '--extend']),
    (error) => {
      assert.match(error.stderr, /Missing historical recording/);
      return true;
    },
  );
  assert.deepEqual(await f.snapshot(), before);
});

test('browser authoring and verification never claim success for an empty catalogue', async () => {
  const nodes = new Map();
  const document = {
    querySelector(id) {
      if (!nodes.has(id))
        nodes.set(id, {
          disabled: false,
          textContent: '',
          value: '',
          handlers: new Map(),
          addEventListener(type, handler) {
            this.handlers.set(type, handler);
          },
        });
      return nodes.get(id);
    },
  };
  const source = (
    await fs.readFile(new URL('../authoring/demo-recording-variants.mjs', import.meta.url), 'utf8')
  )
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replaceAll(
      'import.meta.url',
      JSON.stringify(new URL('../authoring/demo-recording-variants.mjs', import.meta.url).href),
    );
  vm.runInNewContext(source, {
    document,
    fetch: async () => ({ json: async () => ({ clips: [] }) }),
    loadDemoSources: async () => [],
  });
  await nodes.get('#verify').handlers.get('click')();
  assert.match(nodes.get('#status').textContent, /contains no recordings to verify/);
  assert.doesNotMatch(nodes.get('#status').textContent, /PASS/);
  await nodes.get('#run').handlers.get('click')();
  assert.match(nodes.get('#status').textContent, /contains no recordings to author/);
  assert.equal(nodes.get('#export').disabled, true);
});
