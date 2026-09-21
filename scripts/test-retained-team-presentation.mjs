import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildProject } from './game-cli.mjs';
import {
  readRetainedTeamPresentation,
  verifyRetainedTeamPresentationEntries,
} from './retained-team-presentation.mjs';
import { inspectPresentationDependencies } from '../game/presentation/dependencies.mjs';
import { RETAINED_FPV38_PRESENTATION } from '../game/couch/coop-retained-presentation.mjs';

const prefix = 'game/presentation/compiled/';
const archive = `${prefix}runtime.${RETAINED_FPV38_PRESENTATION.sha256}.json`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
let source;
async function originals() {
  source ??= (async () => {
    const current = await fs.readFile(
      new URL('../game/presentation/compiled/runtime.json', import.meta.url),
    );
    const runtime =
      sha(current) === RETAINED_FPV38_PRESENTATION.sha256
        ? current
        : await fs.readFile(new URL('../' + archive, import.meta.url));
    assert.equal(
      sha(runtime),
      RETAINED_FPV38_PRESENTATION.sha256,
      'Fixture is the exact retained original, not a synthetic pin.',
    );
    const inventory = await inspectPresentationDependencies(runtime);
    const entries = new Map([[prefix + 'runtime.json', runtime]]);
    for (const file of inventory.files)
      entries.set(
        prefix + file.path,
        await fs.readFile(new URL('../game/presentation/compiled/' + file.path, import.meta.url)),
      );
    return { runtime, inventory, entries };
  })();
  return source;
}
async function fixture(t, { successor = false } = {}) {
  const original = await originals();
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'rl-retained-build-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const entries = new Map([...original.entries].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  entries.set(
    'game/couch/coop-owned-presentation.mjs',
    Buffer.from('// Build integration sentinel; runtime behavior is tested separately.\n'),
  );
  entries.set(
    'game/index.html',
    Buffer.from('<!doctype html><html><head></head><body>Build fixture</body></html>'),
  );
  entries.set('game/offline.mjs', Buffer.from('// Offline packaging sentinel.\n'));
  entries.set(
    'game/build-config.json',
    Buffer.from(JSON.stringify({ version: '0.76.1', entry: 'game/index.html', include: ['game'] })),
  );
  if (successor) {
    // Change only the default identity for transport testing; this does not create or approve production history.
    const next = JSON.parse(original.runtime);
    next.source.revision++;
    next.resolved.theme.revision++;
    entries.set(prefix + 'runtime.json', Buffer.from(JSON.stringify(next)));
    entries.set(archive, original.runtime);
  }
  const write = async (name, bytes) => {
    const target = path.join(directory, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  };
  for (const [name, bytes] of entries) await write(name, bytes);
  await write(
    'game/offline/service-worker.template.js',
    await fs.readFile(new URL('../game/offline/service-worker.template.js', import.meta.url)),
  );
  return { directory, entries, original, write, included: () => [...entries.keys()] };
}

test('exact current fpv38 satisfies its supported pin without demanding an archive', async (t) => {
  const f = await fixture(t);
  const result = await readRetainedTeamPresentation(f.directory, f.included());
  assert.equal(result.files.length, f.original.inventory.files.length + 1);
  assert(!result.files.some((file) => file.path === archive));
  assert(
    result.files.some(
      (file) =>
        file.path === prefix + 'runtime.json' && file.sha256 === RETAINED_FPV38_PRESENTATION.sha256,
    ),
  );
  assert(Object.isFrozen(result.files));
});

test('a successor authenticates the original archive and deduplicates all current/lazy dependencies', async (t) => {
  const f = await fixture(t, { successor: true });
  const result = await readRetainedTeamPresentation(f.directory, f.included());
  assert.equal(result.files.length, f.original.inventory.files.length + 2);
  assert(
    result.files.some(
      (file) => file.path === archive && file.sha256 === RETAINED_FPV38_PRESENTATION.sha256,
    ),
  );
  for (const original of f.original.inventory.files)
    assert(result.files.some((file) => file.path === prefix + original.path));
  verifyRetainedTeamPresentationEntries(
    result,
    [...f.entries].map(([name, bytes]) => ({ name, bytes })),
  );
});

for (const failure of [
  'missing archive',
  'wrong archive hash',
  'malformed archive',
  'malformed current',
  'missing lazy original',
  'corrupt lazy original',
  'excluded archive',
  'excluded lazy original',
]) {
  test(`retained build rejects ${failure} before creating the output parent`, async (t) => {
    const f = await fixture(t, { successor: true });
    const lazy =
      prefix +
      f.original.inventory.files.find((file) => file.slots.includes('scene.reveal.wide')).path;
    let excluded = [];
    if (failure === 'missing archive') {
      f.entries.delete(archive);
      await fs.rm(path.join(f.directory, archive));
    }
    if (failure === 'wrong archive hash')
      await f.write(archive, Buffer.concat([f.original.runtime, Buffer.from('\n')]));
    if (failure === 'malformed archive') await f.write(archive, Buffer.from('{}'));
    if (failure === 'malformed current') await f.write(prefix + 'runtime.json', Buffer.from('{}'));
    if (failure === 'missing lazy original') {
      f.entries.delete(lazy);
      await fs.rm(path.join(f.directory, lazy));
    }
    if (failure === 'corrupt lazy original') {
      const bytes = Buffer.from(f.entries.get(lazy));
      bytes[bytes.length - 1] ^= 1;
      await f.write(lazy, bytes);
    }
    if (failure === 'excluded archive') excluded = [archive];
    if (failure === 'excluded lazy original') excluded = [lazy];
    if (excluded.length)
      await assert.rejects(
        readRetainedTeamPresentation(f.directory, f.included(), { excluded }),
        /core offline file/,
      );
    else {
      const out = path.join(f.directory, 'not-created', 'distribution');
      await assert.rejects(
        buildProject({ root: f.directory, out }),
        /Team presentation|manifest pin|compiled|Presentation dependency|Missing/,
      );
      await assert.rejects(fs.access(path.dirname(out)), { code: 'ENOENT' });
      assert(!(await fs.readdir(f.directory)).some((name) => name.startsWith('.xonix-build-')));
    }
  });
}

test('wrong archived identity cannot be authorized by rehashing the current file or its filename', async (t) => {
  const f = await fixture(t, { successor: true });
  const wrong = JSON.parse(f.original.runtime);
  wrong.resolved.theme.id = 'retro';
  const bytes = Buffer.from(JSON.stringify(wrong));
  await f.write(archive, bytes);
  await assert.rejects(
    readRetainedTeamPresentation(f.directory, f.included()),
    /exact manifest pin/,
  );
  const arbitrary = `${prefix}runtime.${sha(bytes)}.json`;
  await f.write(arbitrary, bytes);
  f.entries.set(arbitrary, bytes);
  await fs.rm(path.join(f.directory, archive));
  f.entries.delete(archive);
  await assert.rejects(
    readRetainedTeamPresentation(f.directory, f.included()),
    /core offline file/,
  );
});

test('a missing original used only by the retained runtime cannot escape current-runtime verification', async (t) => {
  const f = await fixture(t, { successor: true });
  const file = f.original.inventory.files.find((file) => file.slots.includes('scene.reveal.wide'));
  const current = JSON.parse(f.entries.get(prefix + 'runtime.json'));
  for (const [slot, asset] of Object.entries(current.resolved.assets)) {
    if (asset.file?.sha256 !== file.sha256) continue;
    delete current.resolved.assets[slot];
    delete current.resolved.bindings[slot];
  }
  delete current.urls[file.sha256];
  const bytes = Buffer.from(JSON.stringify(current));
  assert(
    !(await inspectPresentationDependencies(bytes)).files.some(
      (entry) => entry.sha256 === file.sha256,
    ),
  );
  await f.write(prefix + 'runtime.json', bytes);
  f.entries.set(prefix + 'runtime.json', bytes);
  f.entries.delete(prefix + file.path);
  await fs.rm(path.join(f.directory, prefix + file.path));
  const out = path.join(f.directory, 'not-created', 'distribution');
  await assert.rejects(buildProject({ root: f.directory, out }), /core offline file/);
  await assert.rejects(fs.access(path.dirname(out)), { code: 'ENOENT' });
});

test('a symlink cannot supply a retained manifest even with identical target bytes', async (t) => {
  const f = await fixture(t, { successor: true });
  await f.write('outside-runtime.json', f.original.runtime);
  await fs.rm(path.join(f.directory, archive));
  await fs.symlink(path.join(f.directory, 'outside-runtime.json'), path.join(f.directory, archive));
  await assert.rejects(readRetainedTeamPresentation(f.directory, f.included()), /symbolic links/);
});

test('packaged rereads must still contain every verified byte exactly once', async (t) => {
  const f = await fixture(t, { successor: true });
  const result = await readRetainedTeamPresentation(f.directory, f.included());
  const entries = [...f.entries].map(([name, bytes]) => ({ name, bytes }));
  const original = entries.find((entry) => entry.name === archive);
  for (const changed of [
    entries.filter((entry) => entry !== original),
    [...entries, original],
    entries.map((entry) =>
      entry === original ? { name: archive, bytes: Buffer.from('{}') } : entry,
    ),
  ])
    assert.throws(
      () => verifyRetainedTeamPresentationEntries(result, changed),
      /changed between validation and packaging/,
    );
});

test('actual packaging carries both manifests and the complete dependency set into offline config', async (t) => {
  const f = await fixture(t, { successor: true });
  const expected = await readRetainedTeamPresentation(f.directory, f.included());
  const out = path.join(f.directory, 'built');
  await buildProject({ root: f.directory, out });
  const offline = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json')));
  const distribution = JSON.parse(await fs.readFile(path.join(out, 'manifest.json')));
  for (const file of expected.files) {
    assert.deepEqual(
      offline.files.find((entry) => entry.path === file.path),
      file,
    );
    assert.deepEqual(
      distribution.files.find((entry) => entry.path === file.path),
      file,
    );
    assert.equal(sha(await fs.readFile(path.join(out, file.path))), file.sha256);
  }
  assert.deepEqual(await fs.readFile(path.join(out, archive)), f.original.runtime);
});

test('builds without the owned Team host preserve their existing opt-in boundary', async () => {
  assert.equal(await readRetainedTeamPresentation('/nonexistent', ['game/index.html']), null);
  verifyRetainedTeamPresentationEntries(null, []);
});
