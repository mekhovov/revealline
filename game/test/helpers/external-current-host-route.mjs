import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scenarioFromPack } from '../../packs.mjs';
import { dataIdentity } from '../../data-json.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/external-current-host-routes.json', import.meta.url)),
);
const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

function scenarioFor(edition, index) {
  const pack = edition.prepared.pack;
  const campaign = pack.campaigns[0];
  return {
    pack,
    campaign,
    scenario: scenarioFromPack(pack, campaign.id, campaign.levels[index].id),
  };
}
function optionsFor(scenario) {
  return {
    seed: 1,
    classId: 'scout',
    turnPolicy: 'immediate',
    classRecipes: scenario.classRecipes,
  };
}

/** Keep the old authored-speed proof distinct from fresh, approved tuning.
 * This reference never enters the player host and never changes the old fixture. */
export function proveHistoricalExternalRoute(edition, route, index = 0) {
  assert.ok(route, 'The unchanged authored route exists.');
  const { scenario } = scenarioFor(edition, index);
  const run = createRun(scenario.level, optionsFor(scenario));
  for (const { input, ticks } of route.segments)
    for (let tick = 0; tick < ticks; tick++) stepRun(run, input, FIXED_DT);
  assert.equal(run.status, 'won');
  for (const key of ['tick', 'score', 'lives', 'coverage'])
    assert.equal(run[key], route.expected[key], `Historical authored ${key}`);
  assert.equal(run.classic.livesLost, route.expected.livesLost);
}

/** Exercise current commands, accepted original and exact host/reference state.
 * Fixed evidence records discrete outcomes; raw checkpoints compare independent
 * runs on the same runtime, without blessing cross-platform floating spellings. */
export function playCurrentExternalRoute(p, edition, index = 0) {
  assert.equal(fixture.format, 'revealline-external-current-host-routes.v1');
  assert.equal(fixture.ruleset, 'gameplay-pressure.v4');
  assert.equal(fixture.seed, 1);
  assert.equal(fixture.classId, 'scout');
  assert.equal(fixture.turnPolicy, 'immediate');
  assert.equal(fixture.difficulty, 'standard');
  const { pack, campaign, scenario } = scenarioFor(edition, index);
  const binding = fixture.bindings.find(
    (row) =>
      row.packId === pack.id &&
      row.campaignId === campaign.id &&
      row.levelId === scenario.level.id &&
      row.index === index,
  );
  assert.ok(binding, 'Exact pack/campaign/map current-route binding');
  assert.equal(dataIdentity(scenario.level), binding.authoredIdentity);
  assert.equal(dataIdentity(scenario.classRecipes), binding.classIdentity);
  const level = applyGameplayTuning(scenario.level, resolveGameplayTuning(fixture.difficulty));
  assert.equal(dataIdentity(level), binding.tunedIdentity);
  const options = optionsFor(scenario);
  const reference = createRun(level, options);
  const recorder = createRecorder(level, options);
  assert.deepEqual(p.rendered.run.level, level);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), authoritativeCheckpoint(reference));
  const pin = structuredClone(p.rendered.backdrop.pin);
  assert.ok(pin?.sha256, 'An authenticated original is already prepared.');
  const captures = [];
  const objectives = [];
  let previous = null;
  for (const { direction, ticks, action = false } of fixture.routes[binding.routeId]) {
    assert.ok(direction === null || Object.hasOwn(keys, direction));
    assert.ok(Number.isSafeInteger(ticks) && ticks > 0);
    if (action) assert.equal(ticks, 1, 'A Scout action is one fresh gesture.');
    const neutralPosition = !direction ? { x: reference.player.x, y: reference.player.y } : null;
    const end = Math.min(reference.tick + ticks, binding.expected.tick);
    while (reference.tick < end) {
      if (previous) p.key(keys[previous], false);
      if (direction) p.key(keys[direction]);
      if (action) p.key('KeyE');
      let stopped = false;
      do {
        assert.equal(reference.status, 'running');
        const input = { direction, action };
        recordInput(recorder, input);
        stepRun(reference, input, FIXED_DT);
        assert.equal(reference.classic.livesLost, 0);
        for (const event of reference.events) {
          if (event.type === 'cells.claimed')
            captures.push({ tick: reference.tick, count: event.indices.length });
          if (event.type === 'objective.captured')
            objectives.push({ tick: reference.tick, id: event.objectiveId ?? event.id });
        }
        stopped = reference.events.some((event) => event.type === 'capture.stopped');
      } while (reference.tick < end && !stopped);
      const target = reference.tick;
      const remaining = target - p.rendered.run.tick;
      for (let frames = 0; p.rendered.run.tick < target && frames <= remaining; frames++)
        p.frame(Math.min(6, target - p.rendered.run.tick) * FIXED_DT * 1000);
      if (action) p.key('KeyE', false);
      assert.deepEqual(
        authoritativeCheckpoint(p.rendered.run),
        authoritativeCheckpoint(reference),
        `Actual host/reference ${pack.id}/${index} at ${target}`,
      );
      assert.deepEqual(p.rendered.backdrop.pin, pin, 'The accepted original remains pinned.');
      if (stopped) {
        assert.equal(p.rendered.run.player.speed, 0);
        assert.equal(p.rendered.run.player.queuedDirection, null);
        assert.equal(p.rendered.run.player.cutting, false);
      }
      previous = direction;
    }
    if (neutralPosition)
      assert.deepEqual(
        { x: p.rendered.run.player.x, y: p.rendered.run.player.y },
        neutralPosition,
        'Neutral waiting does not resume steering.',
      );
    if (reference.tick === binding.expected.tick) break;
  }
  if (previous) p.key(keys[previous], false);
  p.frame(0);
  const run = p.rendered.run;
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
  for (const key of ['status', 'tick', 'score', 'lives', 'coverage'])
    assert.equal(run[key], binding.expected[key], `Current ${pack.id}/${index} ${key}`);
  assert.equal(run.classic.livesLost, binding.expected.livesLost);
  assert.equal(run.trail.length, binding.expected.trailCells);
  assert.deepEqual(captures, binding.captures);
  assert.deepEqual(objectives, binding.objectives);
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true, 'Exact public replay');
  return { binding, captures, objectives };
}
