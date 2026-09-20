import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack, preparePack, scenarioFromPack } from '../packs.mjs';
import { validateScenario } from '../content.mjs';
import { createRun } from '../core/index.mjs';
import { foundationCompatibleView as classicView } from '../ui/foundation-view.mjs';
import { classicView as historicalView } from '../ui/classic-view.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import {
  entryScenario,
  expansionFromScenario,
  prepareDocument,
  paintLevel,
  withScenarioMastery,
} from '../playground/model.mjs';
import { resolvePackCampaign } from '../packs.mjs';

const source = () => {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  pack.id = 'foundation-transport';
  pack.format = 'xonix-pack.v6';
  pack.engine = 'xonix-core.v6';
  pack.version = '1.0.0';
  pack.masteries = [];
  pack.levelVisuals = [];
  pack.campaigns = [
    {
      ...pack.campaigns[0],
      id: 'islands',
      levels: [
        {
          version: 'xonix-level.v5',
          id: 'nearby-shore',
          revision: '1',
          name: 'Nearby shore',
          width: 72,
          height: 36,
          spawn: { x: 32.5, y: 17.5 },
          foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
          walls: [],
          goal: { coverage: 0.6 },
          encounter: null,
          classic: {
            version: 'classic.v1',
            terrain: [{ id: 'mud', kind: 'slow', x: 10, y: 10, w: 2, h: 2 }],
            powerups: [],
          },
          enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 18.5, vx: 2, vy: 2 }],
          objectives: [],
          supplies: [],
          rules: { lives: 3, moveSpeed: 10, stopOnCapture: true },
        },
      ],
    },
  ];
  return pack;
};

test('foundation packs and scenarios retain their explicit version and geometry through import', async () => {
  const pack = source();
  assert.deepEqual(validatePack(pack).errors, []);
  const prepared = await preparePack(pack, { decodeImage: async () => ({ width: 1, height: 1 }) });
  const scenario = scenarioFromPack(prepared.pack, 'islands', 'nearby-shore');
  assert.equal(scenario.format, 'xonix-playground.v6');
  assert.equal(validateScenario(scenario).valid, true);
  assert.deepEqual(scenario.level.foundations, pack.campaigns[0].levels[0].foundations);
  assert.equal(validateScenario({ ...scenario, format: 'xonix-playground.v5' }).valid, false);
  assert.equal(validatePack({ ...pack, format: 'xonix-pack.v5' }).valid, false);
  const entry = resolvePackCampaign(prepared.pack, 'islands');
  const edited = entryScenario(entry, 'nearby-shore');
  assert.equal(edited.format, 'xonix-playground.v6');
  assert.deepEqual(
    expansionFromScenario(edited).campaigns[0].levels[0].foundations,
    scenario.level.foundations,
  );
  assert.equal(withScenarioMastery(edited, null).format, 'xonix-playground.v6');
  const moved = paintLevel(edited.level, 'spawn', 31, 16);
  assert.deepEqual(moved.spawn, { x: 31.5, y: 16.5 });
  assert.throws(() => paintLevel(edited.level, 'spawn', 10, 10), /permanent/);
  const imported = await prepareDocument(moved, {
    current: edited,
    decodeImage: async () => ({ width: 1, height: 1 }),
  });
  assert.deepEqual(imported.scenario.level.spawn, moved.spawn);
  assert.equal(imported.scenario.format, 'xonix-playground.v6');
});

test('new runtime keeps terrain and flight information visible', () => {
  const run = createRun(source().campaigns[0].levels[0]);
  const view = classicView(run);
  assert(view);
  assert.equal(view.terrain.length, 4);
  const snapshot = flightInformationSnapshot(run, { started: true, paused: false });
  assert(snapshot);
  assert.deepEqual(snapshot.issues, []);
});

test('foundation visual adapter preserves runtime identity, authority and hostile-accessor refusal', () => {
  const run = createRun(source().campaigns[0].levels[0]);
  const before = authoritativeCheckpoint(run);
  assert.equal(historicalView(run), null, 'Historical renderer still refuses future core versions');
  assert(classicView(run));
  assert.equal(run.ruleset, 'xonix-core.v6');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  let reads = 0;
  const descriptors = Object.getOwnPropertyDescriptors(run);
  descriptors.tick = {
    enumerable: true,
    get() {
      reads++;
      throw new Error('Not data');
    },
  };
  assert.equal(classicView(Object.create(null, descriptors)), null);
  assert.equal(reads, 0);
  descriptors.ruleset = {
    enumerable: true,
    get() {
      reads++;
      return 'xonix-core.v6';
    },
  };
  assert.equal(classicView(Object.create(null, descriptors)), null);
  assert.equal(reads, 0);
  const old = source().campaigns[0].levels[0];
  old.version = 'xonix-level.v4';
  old.spawn = { x: 32.5, y: 0.5 };
  delete old.foundations;
  const oldRun = createRun(old);
  assert.deepEqual(classicView(oldRun), historicalView(oldRun));
});
