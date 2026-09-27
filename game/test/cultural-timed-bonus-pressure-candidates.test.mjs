import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS,
  CULTURAL_TIMED_BONUS_PRESSURE_REVISION,
  createCulturalTimedBonusPressureCandidates,
} from '../content-design/cultural-timed-bonus-pressure-candidates.mjs';
import { createBorderFrontierPocketCandidates } from '../content-design/border-frontier-pocket-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
} from '../content-design/mode-href.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const source = createCulturalTimedBonusPressureCandidates({ artwork: true });
const before = createBorderFrontierPocketCandidates({ artwork: true });
const project = compileContentProject(source);
const selected = new Set(CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS);
const presets = ['gentle', 'standard', 'expert'];

const prepared = (id, difficulty, mode = 'solo') =>
  applyGameplayTuning(
    resolveMission(project, id, { difficulty, mode }).level,
    resolveGameplayTuning(difficulty),
  );

function idle(level, ticks, { seed = 1 } = {}) {
  const options = { seed, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const events = [];
  for (let tick = 0; tick < ticks && run.classic.livesLost === 0; tick++) {
    const input = { direction: null };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    events.push(...run.events);
  }
  return { run, events, replay: exportReplay(recorder, run) };
}

test('three optional opportunity successors preserve maps, actors, goals, pictures and order', () => {
  assert.deepEqual(source.maps, before.maps);
  assert.deepEqual(source.assets, before.assets);
  assert.equal(source.policyId, before.policyId);
  assert.equal(source.actorCatalogId, before.actorCatalogId);
  assert.equal(source.difficultyCatalogId, before.difficultyCatalogId);
  assert.deepEqual(
    source.missions.map((mission) => mission.id),
    before.missions.map((mission) => mission.id),
  );

  for (const prior of before.missions) {
    const current = source.missions.find((mission) => mission.id === prior.id);
    if (!selected.has(prior.id)) {
      assert.deepEqual(current, prior);
      continue;
    }
    const { revision, design, timedBonuses, bonuses, ...unchanged } = current;
    const {
      revision: priorRevision,
      design: priorDesign,
      timedBonuses: priorTimedBonuses,
      bonuses: priorBonuses,
      ...priorUnchanged
    } = prior;
    assert.equal(revision, CULTURAL_TIMED_BONUS_PRESSURE_REVISION);
    assert.notEqual(revision, priorRevision);
    assert.deepEqual(unchanged, priorUnchanged);
    assert.equal(priorTimedBonuses, undefined);
    assert.equal(timedBonuses.version, 'timed-bonuses.v2');
    assert.equal(timedBonuses.schedules.length, 1);
    assert.equal(timedBonuses.schedules[0].anchors.length, 3);
    assert.equal(timedBonuses.schedules[0].maxAppearances, 3);
    assert.equal(timedBonuses.schedules[0].maxCollections, 1);
    assert.deepEqual(design.difficulty, priorDesign.difficulty);
    assert.deepEqual(design.introduces, priorDesign.introduces);
    assert(design.practices.includes('timed-bonus-window'));
    assert(design.combines.includes('timed-bonus-window'));
    assert.deepEqual(bonuses, prior.id === 'returning-light' ? [] : priorBonuses);
  }

  const affectedCampaigns = new Set(['phaseworks', 'livewire-foundry', 'apex-aurora']);
  for (const prior of before.campaigns) {
    const current = source.campaigns.find((campaign) => campaign.id === prior.id);
    if (affectedCampaigns.has(prior.id)) {
      assert.deepEqual({ ...current, revision: prior.revision }, prior);
      assert.equal(current.revision, CULTURAL_TIMED_BONUS_PRESSURE_REVISION);
    } else assert.deepEqual(current, prior);
  }
  const affectedPacks = new Set(['journey-phase', 'journey-livewire', 'journey-apex']);
  for (const prior of before.packs) {
    const current = source.packs.find((pack) => pack.id === prior.id);
    if (affectedPacks.has(prior.id)) {
      assert.deepEqual({ ...current, revision: prior.revision }, prior);
      assert.equal(current.revision, CULTURAL_TIMED_BONUS_PRESSURE_REVISION);
    } else assert.deepEqual(current, prior);
  }
});

test('all presets and advertised modes prepare the same finite optional schedules', () => {
  const historical = compileContentProject(before);
  for (const id of CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS)
    for (const difficulty of presets)
      for (const mode of ['solo', 'versus']) {
        const level = prepared(id, difficulty, mode);
        const prior = applyGameplayTuning(
          resolveMission(historical, id, { difficulty, mode }).level,
          resolveGameplayTuning(difficulty),
        );
        assert.equal(level.classic.timedBonuses.version, 'timed-bonuses.v2');
        assert.deepEqual(level.goal, prior.goal);
        assert.deepEqual(level.objectives, prior.objectives);
        assert.deepEqual(level.enemies, prior.enemies);
        assert.deepEqual(level.rules, prior.rules);
        assert.deepEqual(level.classic.lineImpact, prior.classic.lineImpact);
      }
});

test('a missed opportunity visibly expires and relocates without becoming a completion gate', () => {
  const observed = idle(prepared('returning-light', 'standard'), 2800);
  assert.equal(observed.run.classic.livesLost, 0);
  const announced = observed.events.filter((event) => event.type === 'bonus.announced');
  const appeared = observed.events.filter((event) => event.type === 'bonus.appeared');
  const expired = observed.events.filter((event) => event.type === 'bonus.expired');
  assert.equal(announced.length, 2);
  assert.equal(appeared.length, 2);
  assert.equal(expired.length, 1);
  assert.notDeepEqual([appeared[0].x, appeared[0].y], [appeared[1].x, appeared[1].y]);
  assert.equal(observed.run.classic.timedBonuses.schedules[0].collections, 0);
  assert.equal(verifyReplay(observed.replay).match, true);
});

test('the three first windows announce and appear before stationary opening safety ends', () => {
  for (const id of CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS) {
    const observed = idle(prepared(id, 'standard'), 900);
    assert.equal(observed.run.classic.livesLost, 0, id);
    assert.equal(observed.events.filter((event) => event.type === 'bonus.announced').length, 1);
    assert.equal(observed.events.filter((event) => event.type === 'bonus.appeared').length, 1);
    assert.equal(verifyReplay(observed.replay).match, true);
  }
});

test('paired Standard boards keep independent states and identical timed histories', () => {
  for (const id of CULTURAL_TIMED_BONUS_PRESSURE_MISSIONS) {
    const level = prepared(id, 'standard', 'versus');
    const duel = createDuel(
      level,
      { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    assert.notEqual(duel.runs[0].classic.timedBonuses, duel.runs[1].classic.timedBonuses);
    resumeDuel(duel);
    for (let tick = 0; tick < 900; tick++)
      stepDuel(duel, [{ direction: null }, { direction: null }]);
    assert(duel.runs.every((run) => run.classic.livesLost === 0));
    assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
  }
});

test('v33 is an immutable opt-in route and preserves v32', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v33');
  const previous = createAuthoredJourneyRoute('whole-spatial-v32');
  const loaded = await loadAuthoredJourneyRoute('whole-spatial-v33');
  assert.equal(current.profileKey, 'journey-whole-spatial-v33');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v33');
  assert.equal(current.source.revision, CULTURAL_TIMED_BONUS_PRESSURE_REVISION);
  assert.equal(previous.source.revision, before.revision);
  assert.deepEqual(loaded, current);
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert(Object.isFrozen(current));
  assert(Object.isFrozen(current.source));
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v33');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v33&return=solo',
  );
});
