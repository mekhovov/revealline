import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  demoPackagingRequirements,
  demoPackagingEmissionSources,
  isOfflineDiagnosticArtifact,
  qualifyDemoPackaging,
} from './qualify-demo-packaging.mjs';

const inputs = () => ({
  soloCatalogs: [
    {
      clips: [
        { id: 'reviewed', replayURL: './demo-data/reviewed.replay.json' },
        {
          id: 'solo-qualified-example',
          replayURL: './demo-data/example.replay.json',
          replayVariants: ['./demo-data/example.replay.json'],
          runtimePerformances: [{ replayURL: './demo-data/example.webkit.replay.json' }],
        },
      ],
    },
  ],
  simIndex: { entries: [{ file: 'course-self-level.json' }, { file: 'course-acro.json' }] },
  snakeCatalog: { entries: [{ levelId: 'loop' }] },
  survivalCatalog: { entries: [{ levelId: 'crossing' }] },
  survivalVariants: ['chromium', 'firefox', 'webkit'],
});

test('packaging enumerates all four modes and every body variant once, with only qualified Solo diagnostics', () => {
  assert.deepEqual(demoPackagingRequirements(inputs()), [
    'game/demo-data/example.diagnostics.json',
    'game/demo-data/example.replay.json',
    'game/demo-data/example.webkit.diagnostics.json',
    'game/demo-data/example.webkit.replay.json',
    'game/demo-data/reviewed.replay.json',
    'game/demo-data/snake/loop.replay.json',
    'game/demo-data/survival/crossing.chromium.replay.json',
    'game/demo-data/survival/crossing.firefox.replay.json',
    'game/demo-data/survival/crossing.replay.json',
    'game/demo-data/survival/crossing.webkit.replay.json',
    'optional-practice/civilian-fpv/demo-data/course-acro.json',
    'optional-practice/civilian-fpv/demo-data/course-self-level.json',
  ]);
});

test('packaging rejects URL escapes, remote recordings and invalid native filenames', () => {
  for (const url of [
    'https://example.com/trace.replay.json',
    './demo-data/../other.replay.json',
    './demo-data/example.replay.json?revision=1',
  ]) {
    const input = inputs();
    input.soloCatalogs[0].clips[0].replayURL = url;
    assert.throws(() => demoPackagingRequirements(input));
  }
  for (const field of ['simIndex', 'snakeCatalog', 'survivalCatalog']) {
    const input = inputs();
    input[field].entries[0][field === 'simIndex' ? 'file' : 'levelId'] = '../escape.json';
    assert.throws(() => demoPackagingRequirements(input));
  }
});

test('offline trace tools and reference bodies are distinguished from shipped sparse diagnostics', () => {
  for (const name of [
    'scripts/demo-tick-trace.mjs',
    'scripts/demo-tick-adapters/sim.mjs',
    'scripts/diagnose-demo-ticks.mjs',
    'game/unexpected.trace.json',
    'optional-practice/reference.receipt.json',
  ])
    assert.equal(isOfflineDiagnosticArtifact(name), true);
  for (const name of [
    'game/demo-data/qualified.diagnostics.json',
    'optional-practice/civilian-fpv/demo-data/course-self-level.json',
    'game/demo-modes/sim.mjs',
  ])
    assert.equal(isOfflineDiagnosticArtifact(name), false);
});

test('existing packaging evidence is preserved before any expensive build starts', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'demo-packaging-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, 'prior.json');
  await writeFile(reportPath, 'retained prior qualification');
  await assert.rejects(qualifyDemoPackaging({ reportPath }), /Refusing to overwrite/);
  assert.equal(await readFile(reportPath, 'utf8'), 'retained prior qualification');
});

test('emitted source comparison excludes coverage summaries without losing native replay bodies', () => {
  const names = [
    'game/ui/owned-phaser-game.mjs',
    'game/demo-data/snake/loop.replay.json',
    'game/demo-data/example.diagnostics.json',
    'optional-practice/civilian-fpv/demo-data/course-acro.json',
    'optional-practice/civilian-fpv/demo-data/index.json',
    'optional-practice/civilian-fpv/demo-data/coverage.json',
    'game/demo-data/snake/coverage.json',
    'game/test/demo-host.test.mjs',
    'scripts/demo-tick-trace.mjs',
  ];
  const entries = names.map((name) => ({ name, bytes: Buffer.from(name) }));
  assert.deepEqual(demoPackagingEmissionSources(entries), entries.slice(0, 5));
});
