import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

const missionId = 'nearby-shore';
function fixture(catalog = 'journey-actors-v9') {
  const source = createStarterProject('combined-pressure-draft');
  source.actorCatalogId = catalog;
  source.difficultyCatalogId = 'journey-difficulty-v2';
  source.missions[0].actors[0].role = 'trail-pursuer';
  source.missions.push({
    ...structuredClone(source.missions[0]),
    id: 'sibling-pressure',
    actors: [{ ...source.missions[0].actors[0], role: 'heading-interceptor' }],
  });
  source.campaigns.push({
    ...structuredClone(source.campaigns[0]),
    id: 'sibling-campaign',
    missionIds: ['sibling-pressure'],
  });
  source.packs.push({
    ...structuredClone(source.packs[0]),
    id: 'sibling-pack',
    campaignIds: ['sibling-campaign'],
  });
  return source;
}
const manifest = (source, id = missionId, options = {}) =>
  resolveMission(compileContentProject(source), id, options);
const npc = (role) => ({
  id: role,
  role,
  tier: 'measured',
  x: role === 'optional-sentry' ? 44.5 : 12.5,
  y: 10.5,
  heading: [-1, 0],
});
function add(source, role) {
  const actor = npc(role);
  return editContentActor(source, missionId, { action: 'add', id: actor.id, actor });
}

test('optional preparation preserves current pressure catalogue and every unrelated edition', () => {
  for (const catalog of ['journey-actors-v7', 'journey-actors-v8', 'journey-actors-v9']) {
    const source = fixture(catalog),
      before = structuredClone(source);
    const prepared = prepareCombatAuthoring(source, missionId);
    assert.equal(
      prepared.actorCatalogId,
      catalog === 'journey-actors-v7' ? 'journey-actors-v8' : catalog,
    );
    assert.deepEqual(source, before);
    assert.deepEqual(prepared.missions[1], before.missions[1]);
    assert.deepEqual(prepared.maps, before.maps);
    assert.deepEqual(prepared.campaigns[1], before.campaigns[1]);
    assert.deepEqual(prepared.packs[1], before.packs[1]);
    assert.deepEqual(prepared.missions[0].combat, { version: 'mission-combat.v1', enabled: false });
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const options = { difficulty, mode };
        const old = manifest(source, missionId, options),
          next = manifest(prepared, missionId, options);
        assert.deepEqual(next.level.classic.enemyPressure, old.level.classic.enemyPressure);
        assert.deepEqual(next.level.enemies, old.level.enemies);
        const sibling = manifest(source, 'sibling-pressure', options);
        const siblingAfter = manifest(prepared, 'sibling-pressure', options);
        assert.deepEqual(
          siblingAfter,
          sibling,
          'Preparing another mission cannot change an existing resolved edition.',
        );
      }
  }
});

test('v9 optional scout/sentry edits keep pressure recipes, independent populations and explicit on/off identities', async () => {
  const source = fixture(),
    original = structuredClone(source);
  const prepared = prepareCombatAuthoring(source, missionId);
  const off = add(add(prepared, 'optional-scout'), 'optional-sentry');
  const on = setMissionCombatEnabled(off, missionId, true);
  for (const candidate of [prepared, off, on]) {
    assert.equal(candidate.actorCatalogId, 'journey-actors-v9');
    assert.deepEqual(candidate.maps, source.maps);
    assert.deepEqual(candidate.missions[0].presentation, source.missions[0].presentation);
    assert.deepEqual(manifest(candidate, 'sibling-pressure'), manifest(source, 'sibling-pressure'));
  }
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const originalLevel = manifest(source, missionId, { difficulty }).level;
    const enabled = manifest(on, missionId, { difficulty });
    const disabled = manifest(off, missionId, { difficulty });
    assert.deepEqual(enabled.level.classic.enemyPressure, originalLevel.classic.enemyPressure);
    assert.deepEqual(enabled.level.enemies, originalLevel.enemies);
    assert.deepEqual(
      enabled.level.classic.combatPatrols.actors.map((actor) => actor.id),
      ['optional-scout', 'optional-sentry'],
    );
    assert.deepEqual(
      disabled.level.classic.combatPatrols.actors,
      enabled.level.classic.combatPatrols.actors,
    );
    assert.equal(disabled.level.classic.combatPatrols.enabled, false);
    assert.equal(enabled.level.classic.combatPatrols.enabled, true);
    assert.notEqual(disabled.simulationIdentity, enabled.simulationIdentity);
    assert.equal(enabled.officialProgressEligible, false);
    assert.deepEqual(manifest(on, missionId, { difficulty, mode: 'versus' }).level, enabled.level);
  }
  assert.deepEqual(source, original);
  const history = createDraftHistory(source);
  history.replace(on);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), on);
  assert.deepEqual(compileContentProject(JSON.parse(history.export())).source, on);
  const before = structuredClone(off);
  assert.throws(() =>
    editContentActor(off, missionId, {
      action: 'replace',
      id: 'optional-sentry',
      actor: { ...npc('optional-sentry'), warningTicks: 1 },
    }),
  );
  assert.deepEqual(off, before);
  for (const catalog of ['journey-actors-v7', 'journey-actors-v99'])
    assert.throws(() => compileContentProject({ ...off, actorCatalogId: catalog }));
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const theme = themes.themes.find((candidate) => candidate.id === 'horizon');
  const preview = prepareContentPreview(on, missionId, { theme });
  assert.deepEqual(preview.scenario.level, manifest(on, missionId).level);
  assert.equal(preview.scenario.level.classic.combatPatrols.enabled, true);
  assert.match(preview.scenario.metadata.description, /No campaign awards/);
  for (const enabled of [false, true]) {
    const team = createTeamOpeningCandidates();
    team.actorCatalogId = 'journey-actors-v9';
    team.missions[0].combat = { version: 'mission-combat.v1', enabled };
    assert.throws(() => compileContentProject(team), /not qualified for Team/);
  }
});

function combinedFixture(role) {
  const source = fixture();
  source.missions[0].actors[0] = {
    id: 'keeper',
    role,
    tier: 'measured',
    x: 40.5,
    y: 12.5,
    heading: [-1, -1],
  };
  return setMissionCombatEnabled(
    add(prepareCombatAuthoring(source, missionId), 'optional-sentry'),
    missionId,
    true,
  );
}
function play(run, recorder, route) {
  const events = [];
  for (const [ticks, direction] of route)
    for (let n = 0; n < ticks; n++) {
      const input = { direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      events.push(...structuredClone(run.events));
    }
  return events;
}

// Optional imported combinations, not current default missions or human balance
// qualification. These use authored catalogue values, not fresh-play tuning.
for (const role of ['trail-pursuer', 'heading-interceptor'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${role}/${turnPolicy}: independent locked attacks replay, restore and cancel on a real return`, async () => {
      const source = combinedFixture(role),
        before = structuredClone(source);
      const level = manifest(source).level;
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(level, options),
        recorder = createRecorder(level, options);
      const events = play(run, recorder, [
        [480, null],
        [140, 'right'],
        [240, 'down'],
      ]);
      const warning = events.find((event) => event.type === 'pressure.warning');
      const commit = events.find((event) => event.type === 'pressure.committed');
      const lock = events.find((event) => event.type === 'combat.locked');
      const fired = events.find((event) => event.type === 'combat.fired');
      assert.equal(warning.id, 'keeper');
      assert.equal(commit.tick - warning.tick, 90);
      assert.deepEqual(commit.target, warning.target);
      assert.equal(lock.id, 'optional-sentry');
      assert.equal(fired.actorId, 'optional-sentry');
      assert.equal(fired.tick - lock.tick, 180);
      assert.deepEqual(fired.aim, lock.aim);
      assert.equal(run.enemies[0].classic.pressure.phase, 'committed');
      assert.equal(run.classic.combatPatrols.actors[0].phase, 'recovery');
      assert.equal(run.classic.combatPatrols.projectiles.length, 1);
      assert.equal(run.lives, 3);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      const campaign = {
        version: 'xonix-campaign.v1',
        id: 'combined-authoring-check',
        revision: '1',
        levels: [level],
        classRecipes: CLASSES,
      };
      const key = campaignKey(campaign),
        checkpoint = authoritativeCheckpoint(run);
      const saved = suspendSession({
        run,
        recorder,
        campaignKey: key,
        themeId: 'horizon',
        bodyId: 'quad',
        runId: `${role}-${turnPolicy}`,
        continuation: { direction: 'down' },
      });
      const restored = await restoreSession(saved, { campaign, campaignKey: key });
      assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
      play(run, recorder, [[30, 'down']]);
      play(restored.run, restored.recorder, [[30, 'down']]);
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);

      const safe = createRun(level, options),
        safeRecorder = createRecorder(level, options);
      const safeEvents = play(safe, safeRecorder, [
        [480, null],
        [300, 'down'],
      ]);
      assert(safeEvents.some((event) => event.type === 'pressure.committed'));
      assert(safeEvents.some((event) => event.type === 'combat.locked'));
      const capture = safeEvents.find((event) => event.type === 'cells.claimed');
      assert(capture.indices.length > 0);
      assert(
        safeEvents.some(
          (event) =>
            event.type === 'pressure.cancelled' &&
            event.reason === 'trail-closed' &&
            event.tick === capture.tick,
        ),
      );
      assert(
        safeEvents.some(
          (event) =>
            event.type === 'combat.cancelled' &&
            event.reason === 'capture' &&
            event.tick === capture.tick,
        ),
      );
      assert.equal(
        safeEvents.some((event) => event.type === 'combat.fired'),
        false,
      );
      assert.equal(safe.lives, 3);
      assert.equal(verifyReplay(exportReplay(safeRecorder, safe)).match, true);
      assert.deepEqual(source, before);
    });
