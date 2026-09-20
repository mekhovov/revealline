import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { createContentDraftBackend } from '../content-design/drafts.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

test('Studio and CLI resolve exactly the same candidate across all three difficulty presets', async () => {
  const source = createStarterProject();
  const theme = JSON.parse(
    await readFile(new URL('../content/themes.json', import.meta.url)),
  ).themes.find((t) => t.id === 'retro');
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const preview = prepareContentPreview(source, 'nearby-shore', { difficulty, theme });
    const direct = resolveMission(compileContentProject(source), 'nearby-shore', { difficulty });
    assert.deepEqual(preview.manifest, direct);
    assert.deepEqual(preview.scenario.level, direct.level);
    assert.equal(preview.geometry.foundationCount, 25);
    assert.match(preview.capture.assumption, /moving enemies/);
    const cli = spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        '--mission',
        'nearby-shore',
        '--difficulty',
        difficulty,
      ],
      { input: JSON.stringify(source), encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), direct);
  }
});

test('CLI rejects contradictory or duplicate options and never claims release qualification', () => {
  const cli = (args) =>
    spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        ...args,
      ],
      { input: JSON.stringify(createStarterProject()), encoding: 'utf8' },
    );
  for (const args of [
    ['--check', '--mission', 'nearby-shore'],
    ['--check', '--check'],
    ['--mode', 'solo'],
    ['--unknown'],
    ['--mission'],
  ])
    assert.equal(cli(args).status, 1);
  const check = cli(['--check']);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).readyForRelease, false);
});

test('Versus-only geometry can be inspected without silently launching a Solo practice game', () => {
  const source = createStarterProject();
  source.missions[0].modes = ['versus'];
  const preview = prepareContentPreview(source, 'nearby-shore', { mode: 'versus' });
  assert.equal(preview.manifest.mode, 'versus');
  assert.equal(preview.scenario, null);
  assert.throws(() => prepareContentPreview(source, 'nearby-shore'), /mode/);
  assert.throws(
    () => prepareContentPreview(source, 'nearby-shore', { mode: 'versus', theme: {} }),
    /Only Solo/,
  );
});

test('autosave coalesces edits during an in-flight checkpoint without falsely marking them saved', async () => {
  let release;
  const gate = new Promise((resolve) => {
      release = resolve;
    }),
    writes = [];
  const session = createContentDraftSession(createStarterProject(), {
    backend: {
      async save(source, expected) {
        writes.push({ source, expected });
        if (writes.length === 1) await gate;
        return { revision: (expected ?? 0) + 1 };
      },
    },
  });
  const saving = session.save();
  await Promise.resolve();
  session.replace({ ...session.current(), name: 'A newer edit' });
  assert.equal(session.status().dirty, true);
  assert.equal(session.save(), saving);
  release();
  await saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].expected, 1);
  assert.equal(writes[1].source.name, 'A newer edit');
  assert.equal(session.status().dirty, false);
  assert.equal(session.status().revision, 2);
});

test('failed or conflicting autosave keeps editable/exportable work and never blindly overwrites', async () => {
  const memory = managedIndexedDB(),
    backend = createContentDraftBackend(memory);
  const initial = await backend.save(createStarterProject(), null);
  const first = createContentDraftSession(initial.project, { backend, revision: 1 });
  const stale = createContentDraftSession(initial.project, { backend, revision: 1 });
  first.replace({ ...first.current(), name: 'Accepted edit' });
  await first.save();
  stale.replace({ ...stale.current(), name: 'Still mine' });
  await assert.rejects(stale.save(), { code: 'draft-conflict' });
  assert.equal(stale.status().dirty, true);
  assert.equal(JSON.parse(stale.export()).name, 'Still mine');
  await assert.rejects(stale.save(), { code: 'draft-conflict' });
  assert.equal((await backend.read('my-journey')).project.name, 'Accepted edit');
});

test('unavailable and hung storage settle truthfully and can be retried', async () => {
  await assert.rejects(
    createContentDraftBackend({ indexedDB: null }).save(createStarterProject(), null),
    /unavailable/,
  );
  let attempts = 0;
  const backend = createContentDraftBackend({
    indexedDB: {
      open() {
        attempts++;
        return {};
      },
    },
    timeoutMs: 5,
  });
  await assert.rejects(backend.read('my-journey'), /in time/);
  await assert.rejects(backend.read('my-journey'), /in time/);
  assert.equal(attempts, 2);
});
