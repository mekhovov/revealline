import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  LEGACY_VERSIONS,
  ENCOUNTER_VERSIONS,
  WIDE_VERSIONS,
  CLASSIC_VERSIONS,
  resolveVersions,
  versionsForCampaign,
} from '../core/versions.mjs';
import {
  CLASSIC_PACK_VERSION,
  preparePack,
  validatePack,
  resolvePackCampaign,
  scenarioFromPack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
} from '../packs.mjs';
import {
  CLASSIC_SCENARIO_VERSION,
  CLASSIC_VISUAL_ROLES,
  VISUAL_ROLES,
  validateScenario,
} from '../content.mjs';
import { campaignKey } from '../library.mjs';
import { createMasteryCatalog, BUILTIN_MASTERY_REGISTRATIONS } from '../mastery-catalog.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  snapshotReplay,
  verifyReplay,
  verifyReplayAsync,
  authoritativeCheckpoint,
} from '../replay.mjs';

// Test-only edition: the shipped source and every historical proof remain untouched.
function source() {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  pack.id = 'classic-transport-test';
  pack.version = '1.0.0';
  pack.format = CLASSIC_PACK_VERSION;
  pack.engine = CLASSIC_VERSIONS.ruleset;
  pack.masteries = [];
  pack.campaigns = [
    {
      ...pack.campaigns[0],
      id: 'classic-transport-campaign',
      levels: [
        {
          version: CLASSIC_VERSIONS.levelVersion,
          id: 'classic-transport-map',
          name: 'Classic transport test',
          revision: '1',
          width: 72,
          height: 36,
          encounter: null,
          classic: { version: 'classic.v1', terrain: [], powerups: [] },
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
function map() {
  return source().campaigns[0].levels[0];
}
async function scenario(turnPolicy = 'immediate') {
  const pack = (await preparePack(source())).pack;
  return scenarioFromPack(pack, pack.campaigns[0].id, 'classic-transport-map', {
    classId: 'scout',
    turnPolicy,
  });
}

test('classic dispatch is a fourth exact pair; old defaults, partial selectors and ownership stay strict', () => {
  assert.deepEqual(resolveVersions(), LEGACY_VERSIONS);
  for (const pair of [LEGACY_VERSIONS, ENCOUNTER_VERSIONS, WIDE_VERSIONS, CLASSIC_VERSIONS]) {
    assert.deepEqual(resolveVersions(pair), pair);
    for (const [key, value] of Object.entries(pair))
      assert.deepEqual(resolveVersions({ [key]: value }), pair);
    const owned = resolveVersions(pair);
    owned.ruleset = 'changed';
    assert.notEqual(pair.ruleset, 'changed');
  }
  for (const pair of [LEGACY_VERSIONS, ENCOUNTER_VERSIONS, WIDE_VERSIONS])
    assert.throws(
      () => resolveVersions({ ...CLASSIC_VERSIONS, ruleset: pair.ruleset }),
      /mismatched/,
    );
  assert.throws(
    () => resolveVersions({ replayVersion: 'xonix-replay.unregistered' }),
    /unsupported/,
  );
  const first = map();
  assert.deepEqual(
    versionsForCampaign({ levels: [first, { ...map(), id: 'second' }] }),
    CLASSIC_VERSIONS,
  );
  assert.throws(
    () =>
      versionsForCampaign({ levels: [first, { ...map(), version: WIDE_VERSIONS.levelVersion }] }),
    /mix/,
  );
  assert.throws(() => versionsForCampaign({ levels: new Array(1) }), /dense/);
  let reads = 0;
  assert.throws(
    () =>
      resolveVersions({
        get ruleset() {
          reads++;
          return CLASSIC_VERSIONS.ruleset;
        },
      }),
    /accessor/,
  );
  assert.equal(reads, 0);
});

test('classic pack and scenario own new descriptors and roundtrip without changing wide identity', async () => {
  const raw = source(),
    before = structuredClone(raw);
  raw.campaigns[0].levels[0].classic = {
    version: 'classic.v1',
    terrain: [{ id: 'slow', kind: 'slow', x: 5, y: 5, w: 2, h: 2 }],
    powerups: [{ id: 'life', kind: 'extra-life', x: 60.5, y: 3.5 }],
  };
  before.campaigns[0].levels[0].classic = structuredClone(raw.campaigns[0].levels[0].classic);
  const prepared = (await preparePack(raw)).pack;
  assert.equal(validatePack(raw).valid, true);
  assert.deepEqual(raw, before);
  const entry = resolvePackCampaign(prepared, prepared.campaigns[0].id);
  const selected = scenarioFromPack(prepared, entry.campaign.id, entry.campaign.levels[0].id);
  assert.equal(selected.format, CLASSIC_SCENARIO_VERSION);
  assert.equal(selected.masteryDefinition, null);
  assert.equal(validateScenario(selected).valid, true);
  assert.deepEqual(selected.level.classic, raw.campaigns[0].levels[0].classic);
  const wide = structuredClone(entry.campaign);
  wide.levels[0].version = WIDE_VERSIONS.levelVersion;
  delete wide.levels[0].classic;
  assert.notEqual(campaignKey(entry.campaign), campaignKey(wide));
  const installed = installPack(emptyPackLibrary(), prepared);
  assert.deepEqual(await importPackLibrary(exportPackLibrary(installed)), installed);
  assert.ok(Object.isFrozen(prepared.campaigns[0].levels[0].classic.terrain));
  selected.level.classic.terrain[0].w = 1;
  entry.campaign.levels[0].classic.powerups.length = 0;
  raw.campaigns[0].levels[0].classic.terrain.length = 0;
  assert.equal(prepared.campaigns[0].levels[0].classic.terrain[0].w, 2);
  assert.equal(prepared.campaigns[0].levels[0].classic.powerups.length, 1);
});

test('classic transports reject mixed authority, omitted descriptors, optional goals and unrelated media', async () => {
  for (const mutate of [
    (p) => (p.format = 'xonix-pack.v4'),
    (p) => (p.engine = WIDE_VERSIONS.ruleset),
    (p) => delete p.masteries,
    (p) => (p.masteries = [{}]),
    (p) => (p.campaigns[0].levels[0].width = 48),
    (p) => delete p.campaigns[0].levels[0].encounter,
    (p) => delete p.campaigns[0].levels[0].classic,
    (p) => (p.campaigns[0].levels[0].classic.version = 'classic.v2'),
    (p) => (p.campaigns[0].levels[0].classic.unknown = true),
    (p) =>
      p.campaigns[0].levels.push({ ...map(), id: 'mixed', version: WIDE_VERSIONS.levelVersion }),
    (p) => (p.media = { audio: 'https://example.test/track.mp3' }),
  ]) {
    const bad = source();
    mutate(bad);
    assert.equal(validatePack(bad).valid, false);
    await assert.rejects(preparePack(bad));
  }
  const selected = await scenario();
  for (const mutate of [
    (s) => (s.format = 'xonix-playground.v4'),
    (s) => (s.level.version = WIDE_VERSIONS.levelVersion),
    (s) => delete s.masteryDefinition,
    (s) => (s.masteryDefinition = {}),
    (s) => (s.video = {}),
  ]) {
    const bad = structuredClone(selected);
    mutate(bad);
    assert.equal(validateScenario(bad).valid, false);
  }
  let reads = 0;
  const bad = source();
  Object.defineProperty(bad.campaigns[0].levels[0], 'classic', {
    enumerable: true,
    get() {
      reads++;
      return {};
    },
  });
  assert.equal(validatePack(bad).valid, false);
  await assert.rejects(preparePack(bad));
  assert.equal(reads, 0);
});

test('classic catalog entries remain goal-free beside unchanged exact legacy fallbacks', async () => {
  const original = JSON.parse(
    readFileSync(new URL('../content/packs/homeward-skies.json', import.meta.url), 'utf8'),
  );
  const oldEntry = {
    sourcePackId: original.id,
    campaign: { ...original.campaigns[0], classRecipes: original.classRecipes },
  };
  const prepared = (await preparePack(source())).pack;
  const entry = resolvePackCampaign(prepared, prepared.campaigns[0].id);
  const nextEntry = {
    sourcePackId: prepared.id,
    sourcePackFormat: CLASSIC_PACK_VERSION,
    campaign: entry.campaign,
    masteries: [],
  };
  const oldCatalog = createMasteryCatalog([oldEntry]);
  const combined = createMasteryCatalog([oldEntry, nextEntry]);
  assert.deepEqual(oldCatalog.registrations, BUILTIN_MASTERY_REGISTRATIONS);
  assert.deepEqual(combined.registrations, oldCatalog.registrations);
  for (const registration of oldCatalog.registrations)
    assert.equal(combined.get(registration.campaignKey, registration.levelId), registration);
  assert.equal(combined.get(campaignKey(entry.campaign), entry.campaign.levels[0].id), null);
  assert.throws(
    () =>
      createMasteryCatalog([{ ...nextEntry, masteries: [oldCatalog.registrations[0].definition] }]),
    /requires masteries: \[\]/,
  );
  assert.throws(
    () => createMasteryCatalog([{ ...nextEntry, sourcePackFormat: 'xonix-pack.v4' }]),
    /versions differ/,
  );
});

test('classic pack can retain an explicit staged encounter beside an ordinary map', async () => {
  const raw = source(),
    staged = map();
  staged.id = 'classic-staged-test';
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
  const selected = scenarioFromPack(pack, pack.campaigns[0].id, staged.id);
  assert.equal(validateScenario(selected).valid, true);
  assert.deepEqual(selected.level.encounter, staged.encounter);
  assert.equal(selected.level.version, CLASSIC_VERSIONS.levelVersion);
  assert.deepEqual(selected.level.classic, staged.classic);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: an imported classic map wins through real inputs and verifies its v6 checkpoint`, async () => {
    const selected = await scenario(turnPolicy),
      options = { ...selected.settings, classRecipes: selected.classRecipes },
      run = createRun(selected.level, options),
      recorder = createRecorder(selected.level, options, 'classic-transport');
    const events = [];
    while (run.status === 'running') {
      assert.ok(run.tick < 600);
      const command = { direction: 'down' };
      stepRun(run, command, FIXED_DT);
      recordInput(recorder, command);
      events.push(...run.events);
    }
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 3);
    assert.equal(run.objectives[0].captured, true);
    assert.ok(events.some((event) => event.type === 'cells.claimed'));
    releaseInputs(run);
    recordRelease(recorder);
    const replay = exportReplay(recorder, run),
      expected = authoritativeCheckpoint(run);
    assert.equal(replay.version, CLASSIC_VERSIONS.replayVersion);
    assert.equal(replay.checkpoint.algorithm, CLASSIC_VERSIONS.checkpointAlgorithm);
    assert.ok(Object.hasOwn(replay.checkpoint.sections, 'classic'));
    assert.ok(Object.hasOwn(replay.checkpoint.sections, 'encounter'));
    const checked = verifyReplay(replay);
    assert.equal(checked.match, true);
    assert.deepEqual(authoritativeCheckpoint(checked.state), expected);
    assert.equal((await verifyReplayAsync(replay, { chunkTicks: 120 })).match, true);
    for (const mutate of [
      (r) => (r.version = WIDE_VERSIONS.replayVersion),
      (r) => (r.ruleset = WIDE_VERSIONS.ruleset),
      (r) => (r.checkpoint.algorithm = WIDE_VERSIONS.checkpointAlgorithm),
      (r) => delete r.checkpoint.sections.classic,
      (r) => (r.checkpoint.sections.unknown = '0000000000000000'),
    ]) {
      const bad = structuredClone(replay);
      mutate(bad);
      assert.throws(() => snapshotReplay(bad));
    }
    const bad = structuredClone(replay);
    bad.checkpoint.sections.classic = '0000000000000000';
    assert.throws(() => snapshotReplay(bad), /root/);
    const changedDefinition = structuredClone(replay);
    changedDefinition.level.classic.powerups.push({
      id: 'unrecorded-life',
      kind: 'extra-life',
      x: 1.5,
      y: 1.5,
    });
    const mismatch = verifyReplay(changedDefinition);
    assert.equal(mismatch.match, false);
    assert.ok(mismatch.diagnostics.some((entry) => entry.section === 'classic'));
    const controller = new AbortController();
    await assert.rejects(
      verifyReplayAsync(replay, {
        signal: controller.signal,
        chunkTicks: 120,
        onProgress: () => controller.abort(),
      }),
      { name: 'AbortError' },
    );
  });

test('classic checkpoint covers owned descriptors, ledgers, clocks, effects and future actor continuation', () => {
  const run = createRun(map());
  const initial = authoritativeCheckpoint(run);
  // Hash-sensitivity checks are deliberately not gameplay or route proofs.
  for (const change of [
    (s) => (s.level.classic.powerups = [{ id: 'life', kind: 'extra-life', x: 1.5, y: 1.5 }]),
    (s) => (s.classic.eligible[100] = 0),
    (s) => (s.classic.everClaimed[100] = 1),
    (s) => (s.classic.terrain[100] = 1),
    (s) => s.classic.livesLost++,
    (s) => s.classic.actorTick++,
    (s) => s.classic.topologyRevision++,
    (s) => s.classic.effects['enemy-freeze'].until++,
    (s) => (s.classic.departure = { x: 60, y: 0 }),
    (s) => (s.enemies[0].classic = { route: [100, 101], warningUntil: 20 }),
    (s) => (s.level.enemies[0].vx = 1),
  ]) {
    const altered = structuredClone(run);
    change(altered);
    const checkpoint = authoritativeCheckpoint(altered);
    assert.notEqual(checkpoint.sections.classic, initial.sections.classic);
    assert.notEqual(checkpoint.hash, initial.hash);
  }
  assert.deepEqual(authoritativeCheckpoint(run), initial);
  const wide = map();
  wide.version = WIDE_VERSIONS.levelVersion;
  delete wide.classic;
  const oldRun = createRun(wide),
    oldCheckpoint = authoritativeCheckpoint(oldRun);
  oldRun.classic = { unrelated: true };
  assert.deepEqual(authoritativeCheckpoint(oldRun), oldCheckpoint);
  assert.equal(Object.hasOwn(oldCheckpoint.sections, 'classic'), false);
});

test('Classic-only image roles validate and decode at pack and map scope; every older format rejects them', async () => {
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  const descriptor = { dataUrl, name: 'Original test pixel', fit: 'contain' };
  assert.deepEqual(VISUAL_ROLES, [
    'background',
    'player',
    'enemy',
    'patrol',
    'boss',
    'objective',
    'supply',
    'wall',
  ]);
  assert.ok(Object.isFrozen(CLASSIC_VISUAL_ROLES));
  const raw = source();
  raw.visualOverrides = Object.fromEntries(CLASSIC_VISUAL_ROLES.map((role) => [role, descriptor]));
  raw.levelVisuals = [
    {
      levelId: 'classic-transport-map',
      visualOverrides: { rover: { ...descriptor, name: 'Map rover' } },
    },
  ];
  const before = structuredClone(raw),
    decoded = [];
  const { pack } = await preparePack(raw, {
    decodeImage: async (bytes, context) => {
      assert.equal(bytes, dataUrl);
      decoded.push(context);
      return { naturalWidth: 1, naturalHeight: 1 };
    },
  });
  assert.equal(decoded.length, 10, 'All bounded descriptors request the existing decode seam');
  const selected = scenarioFromPack(pack, pack.campaigns[0].id, 'classic-transport-map');
  assert.equal(validateScenario(selected).valid, true);
  assert.equal(selected.visualOverrides.rover.name, 'Map rover');
  assert.deepEqual(raw, before);
  for (const file of ['night-shift', 'homeward-skies', 'sentinel-relay', 'fpv-arcade']) {
    const legacy = JSON.parse(
      readFileSync(new URL(`../content/packs/${file}.json`, import.meta.url), 'utf8'),
    );
    legacy.visualOverrides = {};
    legacy.levelVisuals = [];
    const old = (await preparePack(legacy)).pack;
    const oldScenario = scenarioFromPack(old, old.campaigns[0].id, old.campaigns[0].levels[0].id);
    for (const role of CLASSIC_VISUAL_ROLES) {
      assert.equal(
        validateScenario({ ...oldScenario, visualOverrides: { [role]: descriptor } }).valid,
        false,
      );
      assert.equal(
        validatePack({ ...legacy, visualOverrides: { [role]: descriptor } }).valid,
        false,
      );
      assert.equal(
        validatePack({
          ...legacy,
          levelVisuals: [
            { levelId: oldScenario.level.id, visualOverrides: { [role]: descriptor } },
          ],
        }).valid,
        false,
      );
    }
  }
  assert.equal(
    validateScenario({ ...selected, visualOverrides: { unknownClassic: descriptor } }).valid,
    false,
  );
});
