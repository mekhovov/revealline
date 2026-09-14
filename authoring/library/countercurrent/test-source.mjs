import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { buildCountercurrent, exportCountercurrentScenarios, IDS, CLASS_IDS } from './build.mjs';
import { ownCommands, routeCommands, CONTROLS } from './controls.mjs';
import { verifyCountercurrent } from './verify.mjs';
import { inspectTopology } from '../fracture-lines/build.mjs';
import { ROOT, digest } from '../sentinel-circuit/files.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { arcadeActionCapabilities } from '../../../game/core/arcade-actions.mjs';

// Metadata-only checks: this file never creates or advances a core run.
const source = await buildCountercurrent();
test('three connected new masks refuse a reflected duplicate and retain the explicit Arcade roster', () => {
  assert.deepEqual(
    source.scenarios.map((s) => s.level.id),
    IDS,
  );
  assert.deepEqual(source.pack.campaigns[0].classIds, CLASS_IDS);
  for (const facts of source.topologyFacts) assert.equal(facts.traversableComponents.length, 1);
  const level = source.scenarios[0].level;
  const reflected = {
    ...structuredClone(level),
    id: 'repeated-docks',
    walls: level.walls.map((r) => ({ ...r, x: level.width - r.x - r.w })),
  };
  assert.throws(() => inspectTopology(level, [reflected]), /Repeated\/reflected wall mask/);
  const catalog = createExecutionCatalog([resolvePackCampaign(source.pack, 'countercurrent')]);
  assert.deepEqual(
    catalog.entries.map((e) => e.difficulty),
    ['standard', 'gentle'],
  );
  assert.notEqual(catalog.entries[0].executionKey, catalog.entries[1].executionKey);
  assert.equal(catalog.entries[0].baseCampaignKey, catalog.entries[1].baseCampaignKey);
  for (const scenario of source.scenarios) {
    assert.deepEqual(arcadeActionCapabilities(scenario.level), {
      manualAbility: false,
      manualPickup: false,
      manualBoost: false,
    });
    assert.equal(scenario.level.rules.stopOnCapture, true);
    assert.equal(scenario.masteryDefinition, null);
    assert.deepEqual(scenario.visualOverrides, {});
    assert.equal(scenario.level.encounter, null);
  }
  assert.deepEqual(source.pack.levelVisuals, []);
  assert.deepEqual(source.pack.music, []);
});

test('controller owns bounded data and rejects executable, extra, unknown or unbounded commands', () => {
  const candidate = [{ to: ['up', 3.5] }, { ticks: 30, direction: null }];
  const owned = ownCommands(candidate);
  candidate[0].to[1] = 33.5;
  assert.equal(owned[0].to[1], 3.5);
  for (const commands of [
    [],
    [{ ticks: 0, direction: null }],
    [{ ticks: 3601, direction: 'up' }],
    [{ to: ['warp', 8.5] }],
    [{ to: ['down', 71.5] }],
    [{ to: ['right', 8.5], action: true }],
    [{ recover: false }],
    [{ run: () => true }],
    [{ ticks: Infinity, direction: null }],
  ])
    assert.throws(() => ownCommands(commands));
  let reads = 0;
  assert.throws(() =>
    ownCommands([
      {
        get to() {
          reads++;
          return ['right', 2.5];
        },
      },
    ]),
  );
  assert.equal(reads, 0, 'No input getter may execute.');
  for (const id of IDS) {
    assert.notDeepEqual(CONTROLS[id].north, CONTROLS[id].south);
    for (const difficulty of ['standard', 'gentle'])
      for (const which of ['north', 'south', 'loss', 'recovered'])
        assert.ok(routeCommands(id, which, difficulty).length > 0);
  }
  assert.throws(() => routeCommands(IDS[0], 'gameover', 'gentle'));
  assert.throws(() => routeCommands('foreign-map', 'north', 'standard'));
  assert.throws(() => routeCommands(IDS[0], 'north', 'expert'));
});

test('source export writes only scenarios and refuses overwrite without changing the previous candidate', async (t) => {
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const parent = await mkdtemp(path.join(ROOT, '.cache/countercurrent-export-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const output = path.relative(ROOT, path.join(parent, 'candidate'));
  const result = await exportCountercurrentScenarios(output);
  assert.equal(result.files.length, 3);
  assert.deepEqual((await readdir(result.directory)).sort(), IDS.map((id) => id + '.json').sort());
  const before = [];
  for (const pin of result.files) {
    const bytes = await readFile(path.join(result.directory, pin.name));
    assert.equal(bytes.length, pin.bytes);
    assert.equal(digest(bytes), pin.sha256);
    assert.deepEqual(
      JSON.parse(bytes),
      source.scenarios.find((s) => s.level.id + '.json' === pin.name),
    );
    before.push(bytes);
  }
  await assert.rejects(exportCountercurrentScenarios(output), /EEXIST/);
  for (const [i, pin] of result.files.entries())
    assert.deepEqual(await readFile(path.join(result.directory, pin.name)), before[i]);
});

test('invalid or foreign source requests refuse before replay or recording', async () => {
  for (const candidate of [
    null,
    false,
    [],
    {},
    { pack: source.pack },
    { pack: source.pack, proof: {}, extra: true },
  ])
    await assert.rejects(verifyCountercurrent({ candidate }));
  await assert.rejects(
    verifyCountercurrent({ record: true, candidate: { pack: source.pack, proof: {} } }),
    /cannot record/,
  );
  const foreign = structuredClone(source.pack);
  foreign.campaigns[0].levels[0].walls[0].x++;
  await assert.rejects(
    verifyCountercurrent({ candidate: { pack: foreign, proof: {} } }),
    /Exact Countercurrent source/,
  );
});
