import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validatePack,
  preparePack,
  resolvePackCampaign,
  scenarioFromPack,
  exportPackLibrary,
  importPackLibrary,
  emptyPackLibrary,
  installPack,
  WIDE_PACK_VERSION,
} from '../packs.mjs';
import { validateScenario, WIDE_SCENARIO_VERSION } from '../content.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import {
  createDuel,
  resumeDuel,
  pauseDuel,
  stepDuel,
  validateDuelPacket,
  DUEL_PROTOCOL,
  neutralCommand,
} from '../multiplayer.mjs';

// This test edition is derived in memory; the shipped authored pack stays untouched.
function source() {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  pack.id = 'wide-test-pack';
  pack.version = '1.0.0';
  pack.format = WIDE_PACK_VERSION;
  pack.engine = 'xonix-core.v4';
  pack.masteries = [];
  pack.campaigns = [
    {
      ...pack.campaigns[0],
      id: 'wide-test-campaign',
      levels: [
        {
          version: 'xonix-level.v3',
          id: 'wide-test-map',
          name: 'Wide map',
          revision: '1',
          width: 72,
          height: 36,
          encounter: null,
          spawn: { x: 60.5, y: 0.5 },
          goal: { coverage: 0.15 },
          enemies: [{ id: 'seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 }],
          objectives: [{ id: 'east', x: 65.5, y: 12.5, required: true }],
        },
      ],
    },
  ];
  pack.levelVisuals = [];
  return pack;
}

test('wide pack v4 owns and roundtrips ordinary 72×36 scenarios with separate campaign identity', async () => {
  const raw = source(),
    before = structuredClone(raw),
    prepared = (await preparePack(raw)).pack;
  assert.equal(validatePack(raw).valid, true);
  assert.deepEqual(raw, before);
  const entry = resolvePackCampaign(prepared, prepared.campaigns[0].id);
  const scenario = scenarioFromPack(prepared, entry.campaign.id, entry.campaign.levels[0].id);
  assert.equal(scenario.format, WIDE_SCENARIO_VERSION);
  assert.equal(scenario.masteryDefinition, null);
  assert.equal(validateScenario(scenario).valid, true);
  assert.equal(createRun(scenario.level).width, 72);
  const legacy = {
    ...structuredClone(entry.campaign),
    levels: [
      {
        ...scenario.level,
        version: 'xonix-level.v1',
        width: 48,
        spawn: { x: 6.5, y: 0.5 },
        objectives: [],
      },
    ],
  };
  delete legacy.levels[0].encounter;
  assert.notEqual(campaignKey(entry.campaign), campaignKey(legacy));
  const installed = installPack(emptyPackLibrary(), prepared);
  assert.deepEqual(await importPackLibrary(exportPackLibrary(installed)), installed);
  assert.ok(Object.isFrozen(prepared));
  entry.campaign.levels[0].width = 48;
  assert.equal(prepared.campaigns[0].levels[0].width, 72);
});

test('wide pack/scenario gates reject mixed engines, old geometry, optional goals, unknown media and accessors', async () => {
  for (const mutate of [
    (p) => (p.format = 'xonix-pack.v3'),
    (p) => (p.engine = 'xonix-core.v3'),
    (p) => delete p.masteries,
    (p) => (p.masteries = [{}]),
    (p) => (p.campaigns[0].levels[0].width = 48),
    (p) => delete p.campaigns[0].levels[0].encounter,
    (p) =>
      p.campaigns[0].levels.push({
        ...p.campaigns[0].levels[0],
        id: 'mixed',
        version: 'xonix-level.v1',
      }),
    (p) => (p.media = { video: 'https://example.test/movie.mp4' }),
  ]) {
    const raw = source();
    mutate(raw);
    assert.equal(validatePack(raw).valid, false);
    await assert.rejects(preparePack(raw));
  }
  const raw = source();
  let reads = 0;
  Object.defineProperty(raw.campaigns[0].levels[0], 'encounter', {
    enumerable: true,
    get() {
      reads++;
      return null;
    },
  });
  assert.equal(validatePack(raw).valid, false);
  assert.equal(reads, 0);
  const prepared = (await preparePack(source())).pack,
    scenario = scenarioFromPack(prepared, prepared.campaigns[0].id, 'wide-test-map');
  for (const mutate of [
    (s) => (s.format = 'xonix-playground.v3'),
    (s) => (s.level.version = 'xonix-level.v2'),
    (s) => delete s.masteryDefinition,
    (s) => (s.masteryDefinition = {}),
    (s) => (s.video = {}),
  ]) {
    const bad = structuredClone(scenario);
    mutate(bad);
    assert.equal(validateScenario(bad).valid, false);
  }
});

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: imported wide recipe records a legal win and both duel boards finish tied with exact selected packet context`, async () => {
    const pack = (await preparePack(source())).pack,
      s = scenarioFromPack(pack, pack.campaigns[0].id, 'wide-test-map', {
        classId: 'scout',
        turnPolicy: policy,
      });
    const options = { classRecipes: s.classRecipes, ...s.settings },
      run = createRun(s.level, options),
      recorder = createRecorder(s.level, options, 'wide-content'),
      duel = createDuel(s.level, { ...options, seconds: 30 });
    const context = { matchId: 'wide', player: 0, nextTick: 0, ruleset: duel.ruleset },
      packet = {
        protocol: DUEL_PROTOCOL,
        matchId: 'wide',
        player: 0,
        tick: 0,
        ruleset: duel.ruleset,
        input: neutralCommand(),
      };
    assert.equal(duel.ruleset, 'xonix-core.v4');
    assert.equal(validateDuelPacket(packet, context), true);
    assert.equal(validateDuelPacket(packet, { ...context, ruleset: 'xonix-core.v3' }), false);
    assert.equal(validateDuelPacket(packet, { ...context, ruleset: undefined }), false);
    resumeDuel(duel);
    const command = { direction: 'down' };
    while (run.status === 'running') {
      assert.ok(run.tick < 600);
      stepRun(run, command, FIXED_DT);
      recordInput(recorder, command);
      stepDuel(duel, [command, command]);
    }
    assert.equal(run.status, 'won');
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    assert.equal(duel.reason, 'First clear');
    assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
    const paused = createDuel(s.level, options);
    resumeDuel(paused);
    stepDuel(paused, [command, command]);
    pauseDuel(paused);
    const before = paused.runs.map(authoritativeCheckpoint);
    stepDuel(paused, [command, command]);
    assert.deepEqual(paused.runs.map(authoritativeCheckpoint), before);
  });

test('wide pack v4 may mix ordinary and explicitly staged maps within the same wide campaign', async () => {
  const raw = source(),
    staged = structuredClone(raw.campaigns[0].levels[0]);
  staged.id = 'wide-staged-map';
  staged.enemies = [{ id: 'sentinel', type: 'relay-sentinel', x: 58.5, y: 18.5 }];
  staged.objectives = [
    { id: 'relay', x: 65.5, y: 12.5, required: true },
    { id: 'core', x: 58.5, y: 18.5, required: true },
  ];
  staged.encounter = {
    version: 'xonix-encounter.v1',
    kind: 'relay-sentinel',
    enemyId: 'sentinel',
    shieldObjectiveId: 'relay',
    coreObjectiveId: 'core',
    minReleaseCutCells: 8,
    initialDelayTicks: 240,
    transitionTicks: 180,
    shielded: { warningTicks: 240, activeTicks: 84, restTicks: 396 },
    exposed: { warningTicks: 240, activeTicks: 84, openTicks: 480 },
    laneWidth: 1.2,
  };
  raw.campaigns[0].levels.push(staged);
  const pack = (await preparePack(raw)).pack;
  const scenario = scenarioFromPack(pack, pack.campaigns[0].id, staged.id);
  assert.equal(validateScenario(scenario).valid, true);
  assert.equal(createRun(scenario.level).encounter.stage, 'shielded');
  assert.equal(createRun(scenario.level).ruleset, 'xonix-core.v4');
});
