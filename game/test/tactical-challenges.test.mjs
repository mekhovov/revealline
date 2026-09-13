import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildTacticalChallenges,
  CHALLENGE_IDS,
  sha256,
} from '../../authoring/library/tactical-challenges/build.mjs';
import {
  verifyTacticalChallenges,
  campaignForScenario,
} from '../../scripts/verify-tactical-challenges.mjs';
import { prepareScenario } from '../imports.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES, loadoutHash } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { CLASSIC_VERSIONS, versionsForLevel } from '../core/versions.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';

const folder = new URL('../../authoring/library/tactical-challenges/', import.meta.url);
const scenarios = await Promise.all(
  CHALLENGE_IDS.map(async (id) =>
    JSON.parse(await readFile(new URL(`scenarios/${id}.json`, folder), 'utf8')),
  ),
);
const proof = JSON.parse(await readFile(new URL('routes.json', folder), 'utf8'));
const policies = ['immediate', 'grid-center'];
const find = (name, policy = 'immediate') =>
  proof.routes.find((r) => r.id.endsWith(`/${policy}/${name}`));
const options = (s, turnPolicy) => ({ ...s.settings, turnPolicy, classRecipes: s.classRecipes });
const raster = (level) => {
  const cells = Array(level.width * level.height).fill(0);
  for (const wall of level.walls)
    for (let y = wall.y; y < wall.y + wall.h; y++)
      for (let x = wall.x; x < wall.x + wall.w; x++) cells[y * level.width + x] = 1;
  return cells;
};

test('three importable original wide layouts have distinct physical walls and explicit placeholder teaching', async () => {
  assert.deepEqual(scenarios, await buildTacticalChallenges());
  assert.equal(new Set(scenarios.map((s) => s.level.id)).size, 3);
  assert.equal(new Set(scenarios.map((s) => sha256(JSON.stringify(raster(s.level))))).size, 3);
  const former = JSON.parse(
    await readFile(
      new URL(
        '../../authoring/library/tactical-teaching/scenarios/tactical-read-clearing.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const [index, s] of scenarios.entries()) {
    const prepared = await prepareScenario(s, {
      decodeImage: () => assert.fail('No external image dependency'),
    });
    assert.deepEqual(prepared.scenario, s);
    assert.deepEqual(versionsForLevel(s.level), CLASSIC_VERSIONS);
    assert.equal(s.level.width, 72);
    assert.equal(s.level.height, 36);
    assert.equal(s.level.walls.length, 3);
    assert.notDeepEqual(raster(s.level), raster(former.level));
    assert.deepEqual(s.classRecipes.map(loadoutHash), CLASSES.map(loadoutHash));
    assert.deepEqual(s.visualOverrides, {});
    assert.equal(s.masteryDefinition, null);
    assert.match(s.level.metadata.description, /Procedural placeholder artwork/);
    const brief = missionBriefing(s.level, { classes: s.classRecipes, objectiveLabel: 'Relay' });
    assert.equal(brief.fullBrief, s.level.metadata.description);
    assert.match(brief.facts, /Recommended:/);
    assert.equal(arcadeActionCapabilities(s.level).manualAbility, index !== 0);
  }
  assert.deepEqual(
    scenarios.map((s) => s.level.goal.coverage),
    [0.3, 0.45, 0.48],
  );
});

test('24 bounded ordinary routes reproduce actual outcomes, checkpoints and saved suffixes under both turn modes', async () => {
  const before = JSON.stringify({ scenarios, proof });
  const checked = await verifyTacticalChallenges({ scenarios, proof });
  assert.equal(checked.routes.length, 24);
  assert.equal(checked.routes.filter((r) => r.expected.won).length, 14);
  assert.equal(checked.routes.filter((r) => !r.expected.won).length, 10);
  for (const r of checked.routes) {
    assert.ok(r.savedPrefix.tick < r.expected.tick);
    assert.equal(r.checkpoint.algorithm, CLASSIC_VERSIONS.checkpointAlgorithm);
  }
  assert.equal(JSON.stringify({ scenarios, proof }), before);
});

test('two real exits beat the locked warned interceptor while the blocked center receives a travelling line hit', () => {
  for (const policy of policies) {
    const west = find('west-exit-clear', policy),
      east = find('east-exit-clear', policy),
      failed = find('blocked-center-failure', policy);
    assert.equal(west.expected.won, true);
    assert.equal(east.expected.won, true);
    assert.ok(west.metrics.captures[0].player.x < 24);
    assert.ok(east.metrics.captures[0].player.x > 48);
    for (const route of [west, east, failed]) {
      const warning = route.events.find((e) => e.type === 'pressure.warning'),
        commit = route.events.find((e) => e.type === 'pressure.committed');
      assert.equal(commit.actorTick - warning.actorTick, 60);
      assert.deepEqual(commit.target, warning.target);
    }
    assert.equal(west.metrics.savedState.pressure[0].phase, 'warning');
    assert.equal(east.metrics.savedState.pressure[0].phase, 'committed');
    assert.equal(failed.metrics.savedState.pressure[0].phase, 'cooldown');
    assert.equal(failed.metrics.savedState.player.x, 36.5);
    assert.ok(failed.metrics.savedState.player.y < 14);
    assert.equal(failed.expected.failureCause, 'enemy-trail');
    const seeded = failed.events.find((e) => e.type === 'lineImpact.seeded'),
      arrived = failed.events.find((e) => e.type === 'lineImpact.arrived');
    assert.ok(arrived.tick > seeded.tick);
    assert.equal(arrived.tick, failed.expected.tick);
  }
});

test('direction-only Arcade ignores manual equipment and Boost attempts on this exact authored exit', () => {
  const s = scenarios[0];
  for (const policy of policies) {
    const plain = createRun(s.level, options(s, policy)),
      attempted = createRun(s.level, options(s, policy));
    for (const segment of find('west-exit-clear', policy).segments)
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(plain, segment.input, FIXED_DT);
        stepRun(attempted, { ...segment.input, action: true, pickup: true, boost: true }, FIXED_DT);
      }
    assert.deepEqual(authoritativeCheckpoint(attempted), authoritativeCheckpoint(plain));
    assert.equal(plain.status, 'won');
  }
});

test('supply timing enables a fast crossing but an equipment-free western gate still offers a two-cut win', () => {
  assert.equal(scenarios[1].level.objectives[0].hidden, false);
  for (const policy of policies) {
    const win = find('supply-field-clear', policy),
      empty = find('empty-failure', policy),
      omitted = find('no-field-failure', policy),
      detour = find('western-gate-clear', policy);
    assert.equal(win.metrics.stunnedEnemyTicks, 300);
    assert.equal(win.metrics.savedState.stunnedEnemies, 1);
    for (const failure of [empty, omitted]) {
      assert.equal(failure.expected.failureCause, 'enemy-trail');
      assert.equal(failure.expected.tick, 195);
      assert.equal(failure.metrics.stunnedEnemyTicks, 0);
    }
    assert.ok(empty.events.some((e) => e.type === 'ability.rejected' && e.reason === 'empty'));
    assert.equal(detour.expected.won, true);
    assert.ok(detour.expected.time > win.expected.time);
    assert.equal(detour.metrics.captures.length, 2);
    assert.ok(detour.metrics.captures[0].coverage < 0.45);
    assert.equal(detour.metrics.savedState.player.speed, 0);
    assert.equal(detour.metrics.savedState.player.cutting, false);
    assert.ok(!detour.events.some((e) => ['ability.used', 'pickup.collected'].includes(e.type)));
  }
});

test('partial capture remains stopped while the world advances and survives a real saved-session round trip', async () => {
  const s = scenarios[1],
    campaign = campaignForScenario(s);
  for (const policy of policies) {
    const run = createRun(s.level, options(s, policy)),
      recorder = createRecorder(s.level, options(s, policy), 'challenge-pause-control');
    let tick = 0;
    for (const segment of find('western-gate-clear', policy).segments)
      for (let i = 0; i < segment.ticks && tick < 1278; i++, tick++) {
        recordInput(recorder, segment.input);
        stepRun(run, segment.input, FIXED_DT);
      }
    assert.equal(run.status, 'running');
    assert.equal(run.player.speed, 0);
    assert.equal(run.player.cutting, false);
    const session = suspendSession({
      run,
      recorder,
      campaignKey: campaignKey(campaign),
      themeId: s.theme.id,
      bodyId: s.theme.player,
      runId: `challenge-pause-${policy}`,
      savedAt: '2026-09-13T00:00:00.000Z',
      continuation: { direction: null },
    });
    const raw = JSON.stringify(session);
    const restored = await restoreSession(JSON.parse(raw), {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    const player = structuredClone(restored.run.player),
      enemies = structuredClone(restored.run.enemies),
      claimed = restored.run.claimedCount,
      actorTick = restored.run.classic.actorTick;
    for (let i = 0; i < 120; i++) {
      recordInput(restored.recorder, { direction: null });
      stepRun(restored.run, { direction: null }, FIXED_DT);
    }
    assert.equal(restored.run.status, 'running');
    assert.equal(restored.run.player.x, player.x);
    assert.equal(restored.run.player.y, player.y);
    assert.equal(restored.run.player.speed, 0);
    assert.equal(restored.run.claimedCount, claimed);
    assert.equal(restored.run.classic.actorTick, actorTick + 120);
    assert.notDeepEqual(restored.run.enemies, enemies);
    assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
    assert.equal(JSON.stringify(session), raw);
  }
});

test('Fiber keeps signal speed and Scan but cannot ignore cable length; the northern rim works for Scout', () => {
  for (const policy of policies) {
    const win = find('fiber-scan-clear', policy),
      noScan = find('fiber-no-scan-clear', policy),
      cable = find('cable-dogleg-failure', policy),
      ordinary = find('ordinary-band-failure', policy),
      rim = find('ordinary-rim-clear', policy);
    assert.ok(win.metrics.resistantTicks > 0);
    assert.equal(win.metrics.slowedTicks, 0);
    const fact = win.metrics.scanFacts[0];
    assert.equal(fact.revealed, 1);
    assert.equal(fact.claimedCount, 0);
    assert.equal(fact.captured, 0);
    assert.equal(fact.stunnedEnemies, 0);
    assert.equal(fact.signal.abilityBlocked, false);
    assert.equal(fact.signal.boostBlocked, false);
    for (const key of ['tick', 'time', 'lives', 'score', 'coverage', 'objectives'])
      assert.deepEqual(win.expected[key], noScan.expected[key]);
    assert.equal(noScan.metrics.scanFacts.length, 0);
    assert.equal(noScan.metrics.revealedBeforeCaptureTicks, 0);
    assert.equal(cable.expected.failureCause, 'cable-limit');
    assert.ok(cable.expected.time < scenarios[2].level.rules.cutTimeLimitSeconds);
    assert.equal(ordinary.expected.failureCause, 'cut-timeout');
    assert.ok(ordinary.metrics.slowedTicks > 0);
    assert.ok(
      ordinary.events.some(
        (e) => e.type === 'ability.rejected' && e.reason === 'signal-interference',
      ),
    );
    assert.equal(rim.expected.won, true);
    assert.equal(rim.metrics.signalTicks, 0);
    assert.ok(rim.expected.time > win.expected.time);
  }
});

test('proof rejects changed geometry, missing/duplicate routes and foreign context authority', async () => {
  const changed = structuredClone(scenarios);
  changed[0].level.walls[0].w--;
  await assert.rejects(
    verifyTacticalChallenges({ scenarios: changed, proof }),
    /Exact pinned challenge/,
  );
  for (const kind of ['missing', 'duplicate', 'identity']) {
    const edited = structuredClone(proof);
    if (kind === 'missing') edited.routes.pop();
    else if (kind === 'duplicate') edited.routes[1] = edited.routes[0];
    else edited.routes[0].campaignKey = 'foreign/1/unknown';
    await assert.rejects(verifyTacticalChallenges({ scenarios, proof: edited }));
  }
});

test('proof rejects manual Arcade commands, fabricated verdicts and altered saved continuation evidence', async () => {
  for (const kind of ['command', 'verdict', 'saved']) {
    const edited = structuredClone(proof);
    if (kind === 'command') edited.routes[0].segments[0].input.action = true;
    else if (kind === 'verdict') edited.routes[0].expected.score++;
    else edited.routes[0].savedPrefix.sessionSha256 = '0'.repeat(64);
    await assert.rejects(verifyTacticalChallenges({ scenarios, proof: edited }));
  }
});
