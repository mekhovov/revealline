import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNeonReferencePack } from '../../scripts/build-neon-reference-pack.mjs';
import { inspectGoals } from '../../scripts/game-cli.mjs';
import { preparePack, scenarioFromPack } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { preparePackCatalog, resolvePackLaunch } from '../content-launch.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import {
  CLASSIC_RULES_CURRENT,
  projectClassicCurrentRulesLevel,
} from '../mission-library/classic-current-rules.mjs';
import { officialLevelNumber } from '../level-numbering.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const source = await json('../content/packs/neon-reference-pack.json');
const { pack } = await preparePack(source, {
  decodeImage: async (url) => {
    const image = inspectImageDataUrl(url);
    assert.equal(image.valid, true);
    return { naturalWidth: image.width, naturalHeight: image.height };
  },
});

test('CLI inspection preserves explicit empty masteries for the foundation pack family', async () => {
  const report = await inspectGoals({
    packPath: new URL('../content/packs/neon-reference-pack.json', import.meta.url).pathname,
  });
  assert.equal(report.checks.structure, 'valid');
  assert.equal(report.campaigns[0].maps.length, 4);
  assert.ok(report.campaigns[0].maps.every((map) => map.goalSource === 'none'));
});

test('bundled pack reproduces four ordered references and preserves geometry and actors', async () => {
  assert.deepEqual(source, await buildNeonReferencePack());
  assert.equal(pack.campaigns[0].levels.length, 4);
  for (const name of ['channels', 'crossroads', 'hearts', 'labyrinth']) {
    const standalone = await json(`../../authoring/library/neon-${name}/scenario.json`);
    const scenario = scenarioFromPack(pack, 'neon-reference', `neon-${name}-pack`);
    assert.deepEqual(scenario.level, {
      ...standalone.level,
      version: 'xonix-level.v5',
      id: `neon-${name}-pack`,
      foundations: standalone.level.foundations ?? [],
    });
    assert.deepEqual(scenario.visualOverrides, standalone.visualOverrides);
  }
});

test('main catalog discovers four numbered levels and resolves bundled launch routes', async () => {
  const catalog = preparePackCatalog(await json('../content/packs/catalog.json'));
  const index = await json('../content/mission-library-index.json');
  const library = createMissionLibrary(
    classicLibrarySources(index, { availability: () => ({ state: 'ready' }), launch: () => true }),
  );
  const rows = library.search('Neon Reference Pack', { lifecycle: 'current' });
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(JSON.parse(row.ownerId)[2], pack.id);
    assert.equal(JSON.parse(row.ownerId)[3], CLASSIC_RULES_CURRENT);
    assert.ok(officialLevelNumber(row.canonicalLevelKey) > 0);
    const launch = resolvePackLaunch(
      new URLSearchParams({
        pack: pack.id,
        campaign: 'neon-reference',
        level: row.runtimeId,
        play: '1',
      }),
      catalog,
    );
    assert.equal(launch.levelId, row.runtimeId);
    assert.equal(library.launch(row, { mode: 'solo' }), true);
  }
  assert.equal(library.search('Neon Reference Pack', { lifecycle: 'archive' }).length, 4);
});

test('catalog admits sixteen unique packs but rejects a seventeenth', () => {
  const summary = {
    name: 'Pack',
    campaigns: [
      {
        id: 'campaign',
        revision: '1',
        title: 'Campaign',
        levels: [{ id: 'level', name: 'Level' }],
      },
    ],
  };
  const catalog = {
    format: 'xonix-pack-catalog.v1',
    packs: Array.from({ length: 16 }, (_, i) => ({
      ...summary,
      id: `pack-${i}`,
      path: `pack-${i}.json`,
    })),
  };
  assert.equal(preparePackCatalog(catalog).packs.length, 16);
  catalog.packs.push({ ...summary, id: 'pack-16', path: 'pack-16.json' });
  assert.throws(() => preparePackCatalog(catalog), /size/);
});

const openings = [
  [
    'channels',
    [
      ['right', 252],
      ['up', 500],
      ['right', 264],
      ['down', 500],
    ],
    68,
  ],
  [
    'crossroads',
    [
      ['right', 72],
      ['up', 144],
      ['right', 342],
    ],
    348,
  ],
  [
    'hearts',
    [
      ['left', 72],
      ['up', 36],
      ['left', 354],
    ],
    140,
  ],
  [
    'labyrinth',
    [
      ['left', 60],
      ['up', 24],
      ['right', 12],
      ['down', 36],
    ],
    36,
  ],
];
for (const [name, route, expected] of openings)
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`bundled ${name} Current rules capture and replay: ${turnPolicy}`, () => {
      const scenario = scenarioFromPack(pack, 'neon-reference', `neon-${name}-pack`, {
        turnPolicy,
      });
      const level = projectClassicCurrentRulesLevel(scenario.level, CLASSIC_RULES_CURRENT);
      const options = { ...scenario.settings, classRecipes: scenario.classRecipes };
      const run = createRun(level, options),
        recorder = createRecorder(level, options, 'neon-pack-check');
      for (const [direction, ticks] of route)
        for (let tick = 0; tick < ticks; tick++) {
          recordInput(recorder, { direction });
          stepRun(run, { direction });
        }
      assert.equal(run.lives, 3);
      assert.equal(run.claimedCount, expected);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    });
