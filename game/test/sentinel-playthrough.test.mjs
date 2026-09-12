import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, releaseInputs, FIXED_DT, CELL } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const source = await readJSON('../../authoring/library/sentinel-relay/proposedpack-source.json');
const inputPack = await readJSON('../content/packs/sentinel-relay.json');
const proof = await readJSON('../replays/sentinel-routes.json');
const noImage = async () => {
  throw new Error('This pack has no imported images.');
};
const { pack } = await preparePack(inputPack, { decodeImage: noImage });
const { campaign } = resolvePackCampaign(pack, 'sentinel-relay');
const level = campaign.levels[0];
const optionsFor = (route) => ({
  classId: route.classId,
  turnPolicy: route.turnPolicy,
  seed: route.seed,
  classRecipes: pack.classRecipes,
});
const fieldCount = (run) =>
  run.cells.reduce((count, cell) => count + Number(cell === CELL.FIELD), 0);
const caches = new Map();

function feed(route, run, recorder, { from = 0, until = Infinity, observe = () => {} } = {}) {
  let offset = 0;
  for (const segment of route.segments) {
    const end = offset + segment.ticks;
    if (end <= from) {
      offset = end;
      continue;
    }
    if (offset >= until) break;
    if (offset >= from && segment.releaseBefore) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    const first = Math.max(0, from - offset),
      last = Math.min(segment.ticks, until - offset);
    for (let tick = first; tick < last; tick++) {
      assert.ok(
        ['running', 'respawning'].includes(run.status),
        'Recorded input cannot continue after a terminal result.',
      );
      const before = {
        trailFieldCells: new Set(
          run.trail
            .filter((cell) => run.cells[cell.index] === CELL.FIELD)
            .map((cell) => cell.index),
        ).size,
        stage: run.encounter.stage,
        phase: run.encounter.phase,
        fieldCells: fieldCount(run),
      };
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
      observe(run, before);
    }
    offset = end;
  }
}
function replayRoute(route) {
  if (caches.has(route.id)) return caches.get(route.id);
  const options = optionsFor(route),
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'sentinel-playthrough-test');
  const events = [],
    cuts = [],
    failures = [];
  feed(route, run, recorder, {
    observe(state, before) {
      events.push(...state.events.map((event) => structuredClone(event)));
      for (const event of state.events) {
        if (event.type === 'cut.closed')
          cuts.push({
            ...event,
            ...before,
            remainingField: fieldCount(state),
            afterStage: state.encounter.stage,
          });
        if (event.type === 'player.failed')
          failures.push({
            ...event,
            relayCaptured: state.objectives.find((o) => o.id === 'shield-relay').captured,
            stage: state.encounter.stage,
            claimedCount: state.claimedCount,
          });
      }
    },
  });
  if (route.releaseAfter) {
    releaseInputs(run);
    recordRelease(recorder);
  }
  const replay = exportReplay(recorder, run),
    result = { run, recorder, replay, events, cuts, failures };
  caches.set(route.id, result);
  return result;
}

test('Sentinel source, runtime and exact proof identity agree without generated expectations', () => {
  assert.deepEqual(inputPack, source);
  assert.equal(pack.format, 'xonix-pack.v3');
  assert.equal(pack.engine, 'xonix-core.v3');
  assert.deepEqual(pack.masteries, []);
  assert.deepEqual(pack.visualOverrides, {});
  assert.deepEqual(pack.levelVisuals, []);
  assert.equal(campaign.levels.length, 1);
  assert.equal(level.version, 'xonix-level.v2');
  assert.deepEqual(
    pack.themes.map((theme) => theme.id),
    ['fpv', 'ukraine', 'retro', 'coupa'],
  );
  assert.equal(proof.format, 'xonix-sentinel-proof.v1');
  assert.equal(proof.packSha256, digest(pack));
  assert.equal(proof.levelSha256, digest(level));
  assert.equal(proof.classesSha256, digest(pack.classRecipes));
  assert.equal(proof.campaignKey, campaignKey(campaign));
  assert.equal(proof.routes.length, 20);
  assert.equal(new Set(proof.routes.map((route) => route.id)).size, 20);
  for (const policy of ['immediate', 'grid-center']) {
    const ordinary = proof.routes.filter(
      (route) => route.turnPolicy === policy && route.variant === 'ordinary',
    );
    assert.deepEqual(
      ordinary.map((route) => route.classId),
      pack.classRecipes.map((recipe) => recipe.id),
    );
  }
});

for (const route of proof.routes)
  test(`${route.id}: legal core inputs reproduce the complete encounter`, async () => {
    for (const segment of route.segments) {
      assert.equal(segment.input.boost, false);
      assert.equal(segment.input.action, false);
      assert.equal(segment.input.pickup, false);
      assert.equal(segment.input.switchClass, null);
    }
    const { run, replay, events, cuts, failures } = replayRoute(route);
    assert.equal(replay.version, 'xonix-replay.v4');
    assert.equal(replay.checkpoint.algorithm, 'fnv1a64-state-v3');
    assert.match(replay.checkpoint.sections.encounter, /^[0-9a-f]{16}$/);
    assert.deepEqual(replay.summary, route.expected);
    assert.deepEqual(replay.checkpoint, route.checkpoint);
    assert.deepEqual(
      events.filter((event) => !['cells.claimed', 'run.completed'].includes(event.type)),
      route.events,
    );
    assert.equal((await verifyReplayAsync(replay)).match, true);
    assert.equal(run.status, 'won');
    assert.equal(run.coverage, 1, 'Sole-seed release actually claims the full board.');
    assert.equal(run.objectives.filter((o) => o.required && o.captured).length, 2);
    assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
    assert.equal(events.filter((event) => event.type === 'encounter.defeated').length, 1);
    assert.equal(
      events.filter(
        (event) =>
          event.type === 'ability.used' ||
          event.type === 'pickup.collected' ||
          event.type === 'class.switched',
      ).length,
      0,
    );
    const relay = events.findIndex(
      (event) => event.type === 'objective.captured' && event.id === 'shield-relay',
    );
    const transition = events.findIndex(
      (event) => event.type === 'encounter.stageChanged' && event.stage === 'transition',
    );
    const exposed = events.findIndex(
      (event) => event.type === 'encounter.stageChanged' && event.stage === 'exposed',
    );
    const firstActive = events.findIndex(
      (event) =>
        event.type === 'encounter.phaseChanged' &&
        event.stage === 'exposed' &&
        event.phase === 'active',
    );
    const firstOpen = events.findIndex(
      (event) => event.type === 'encounter.phaseChanged' && event.phase === 'open',
    );
    const core = events.findIndex(
      (event) => event.type === 'objective.captured' && event.id === 'sentinel-core',
    );
    const defeated = events.findIndex((event) => event.type === 'encounter.defeated');
    assert.ok(
      relay < transition &&
        transition < exposed &&
        exposed < firstActive &&
        firstActive < firstOpen &&
        firstOpen < core &&
        core < defeated,
    );
    assert.equal(events[transition].tick, 1084);
    assert.equal(events[exposed].tick, 1265);
    assert.equal(events[firstActive].tick, 1505);
    assert.equal(events[firstOpen].tick, 1589);
    assert.equal(
      events.filter(
        (event) => event.type === 'encounter.stageChanged' && event.stage === 'transition',
      ).length,
      1,
    );
    const openings = events.filter(
      (event) => event.type === 'encounter.phaseChanged' && event.phase === 'open',
    );
    if (route.variant === 'isolation') {
      assert.equal(run.tick, 4084);
      assert.equal(run.lives, 3);
      assert.equal(run.encounter.defeatCause, 'isolated');
      assert.equal(run.encounter.qualifyingCutCells, 0);
      assert.equal(cuts.length, 5, 'The release does not fabricate a sixth cut.');
      assert.deepEqual(
        cuts.slice(-2).map((cut) => cut.trailFieldCells),
        [1, 1],
      );
      assert.equal(
        cuts.at(-2).remainingField,
        17,
        'A one-cell cut cannot trigger either release while too much field remains.',
      );
      assert.equal(cuts[1].phase, 'warning');
      assert.equal(cuts[2].phase, 'warning');
      const claims = events.filter((event) => event.type === 'cells.claimed');
      assert.equal(claims.length, 6);
      assert.equal(
        claims.at(-1).indices.length,
        1,
        'The isolated occupied core is the final automatic reveal.',
      );
    } else {
      assert.equal(run.encounter.defeatCause, 'cut-release');
      assert.equal(run.encounter.qualifyingCutCells, 13);
      assert.equal(cuts.length, 2);
      assert.equal(cuts.at(-1).phase, 'open');
      assert.ok(cuts.at(-1).trailFieldCells >= 8);
      if (route.variant === 'missed-windows') {
        assert.equal(run.tick, 3400);
        assert.equal(run.lives, 3);
        assert.deepEqual(
          openings.map((event) => event.tick),
          [1589, 2393, 3197],
        );
      } else if (route.variant === 'recovered') {
        assert.equal(run.tick, 2596);
        assert.equal(run.lives, 2);
        assert.equal(failures.length, 1);
        assert.equal(failures[0].cause, 'boss-lane');
        assert.equal(failures[0].tick, 1505);
        assert.equal(failures[0].relayCaptured, true);
        assert.equal(failures[0].stage, 'exposed');
        assert.equal(failures[0].claimedCount, 408);
        assert.ok(
          events.some(
            (event) => event.type === 'player.respawned' && event.tick > failures[0].tick,
          ),
        );
      } else {
        assert.equal(run.tick, 1792);
        assert.equal(run.lives, 3);
        assert.equal(failures.length, 0);
      }
    }
  });

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: portable saved flights resume the actual phase and live cut`, async () => {
    const route = proof.routes.find(
      (item) =>
        item.turnPolicy === policy && item.variant === 'ordinary' && item.classId === 'scout',
    );
    for (const boundary of [1085, 1265, 1505, 1589, 1780]) {
      const options = optionsFor(route),
        run = createRun(level, options),
        recorder = createRecorder(level, options, 'sentinel-restored-proof');
      feed(route, run, recorder, { until: boundary });
      assert.equal(run.tick, boundary);
      if (boundary === 1780) assert.ok(run.player.cutting && run.trail.length >= 8);
      const expectedPhase = structuredClone(run.encounter);
      const session = suspendSession({
        run,
        recorder,
        campaignKey: campaignKey(campaign),
        themeId: 'fpv',
        bodyId: 'fpv-body',
        runId: `sentinel-suspended-${policy}-${boundary}`,
        savedAt: '2026-09-12T12:00:00.000Z',
      });
      const original = structuredClone(session);
      const restored = await restoreSession(session, {
        campaign,
        campaignKey: campaignKey(campaign),
      });
      assert.deepEqual(restored.run.encounter, expectedPhase);
      feed(route, restored.run, restored.recorder, { from: boundary });
      const replay = exportReplay(restored.recorder, restored.run);
      assert.deepEqual(replay.summary, route.expected);
      assert.deepEqual(replay.checkpoint, route.checkpoint);
      assert.equal((await verifyReplayAsync(replay)).match, true);
      assert.deepEqual(session, original, 'Restoring cannot mutate the imported document.');
    }
  });
