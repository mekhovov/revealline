import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createRun,
  stepRun,
  releaseInputs,
  getSummary,
  FIXED_DT,
  CLASSES,
  loadoutHash,
  rosterHash,
} from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import { campaignKey, boardIdentity } from '../library.mjs';
import { completionVariantKey } from '../progress.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

// Expectations came from frozen v0.6.0, never from the implementation under test.
// Do not refresh these values when adding mastery/version dispatch. See the guide.
const fixtureBytes = await readFile(new URL('./fixtures/compatibility-v060.json', import.meta.url));
const fixture = JSON.parse(fixtureBytes);
const canonical = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`;
const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex');
const json = async (path) =>
  JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const currentRecipes = await json('game/content/classes.json');
const campaigns = new Map();
for (const reference of fixture.campaigns) {
  const input = await json(reference.path);
  const source = (input.campaigns ?? [input]).find((value) => value.id === reference.id);
  assert.ok(source, `Archived campaign ${reference.id} must remain available.`);
  campaigns.set(reference.id, { ...source, classRecipes: input.classRecipes ?? currentRecipes });
}

function oldReplay(entry, part = entry) {
  return structuredClone({
    version: fixture.contracts.replayVersion,
    build: fixture.contracts.build,
    ruleset: fixture.contracts.ruleset,
    level: entry.level,
    options: { ...entry.options, classRecipes: fixture.roster.recipes },
    segments: part.segments,
    ticks: part.ticks,
    releaseAfter: part.releaseAfter,
    summary: part.summary,
    checkpoint: part.checkpoint,
  });
}

function advanceRecorded(run, recorder, segments, { afterTick = 0, checkpoints = [] } = {}) {
  const events = [];
  let inputTick = 0;
  for (const segment of segments) {
    if (segment.releaseBefore && inputTick >= afterTick) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      if (inputTick++ < afterTick) continue;
      assert.ok(!['won', 'lost'].includes(run.status), 'No input may follow a terminal result.');
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
      events.push(...run.events);
      const expected = checkpoints.find((item) => item.tick === run.tick);
      if (expected)
        assert.deepEqual(authoritativeCheckpoint(run), expected.checkpoint, `tick ${run.tick}`);
    }
  }
  return events;
}

test('v0.6.0 baseline is pinned, bounded and independent of Git or an installed archive', () => {
  assert.equal(fixture.format, 'revealline-compatibility.v060.v1');
  assert.equal(fixture.source.tag, 'v0.6.0');
  assert.equal(fixture.source.revision, 'e88bab7e9677c82419aca35557c858c670425f16');
  assert.equal(fixture.contracts.ruleset, 'xonix-core.v2');
  assert.equal(fixture.contracts.replayVersion, 'xonix-replay.v3');
  assert.equal(fixture.contracts.checkpointAlgorithm, 'fnv1a64-state-v2');
  assert.ok(fixtureBytes.length < 128 * 1024);
  assert.equal(digest(fixture), '282ad38916136700745d4e71386ed9726ac5f99a02b94cd9a0ac307b8c944f31');
  assert.equal(fixture.cases.length, 9);
  assert.equal(fixture.cases.filter((entry) => entry.suspended).length, 4);
});

test('all seven production/default recipes retain their old loadout and roster identities', () => {
  for (const recipes of [currentRecipes, CLASSES]) {
    assert.equal(rosterHash(recipes), fixture.roster.hash);
    assert.deepEqual(
      recipes.map((recipe) => ({
        id: recipe.id,
        revision: recipe.revision,
        hash: loadoutHash(recipe),
      })),
      fixture.roster.loadouts,
    );
  }
});

for (const reference of fixture.campaigns)
  test(`${reference.id}: campaign and every normalized map/steering board retain v0.6.0 identity`, () => {
    const campaign = campaigns.get(reference.id);
    assert.equal(campaign.revision, reference.revision);
    assert.equal(campaignKey(campaign), reference.key);
    assert.deepEqual(
      campaign.levels.map((level) => level.id),
      reference.levels.map((level) => level.id),
    );
    for (const entry of reference.levels) {
      const level = campaign.levels.find((item) => item.id === entry.id);
      assert.equal(digest(normalizedLevel(level)), entry.normalizedSha256, entry.id);
      for (const [turnPolicy, expected] of Object.entries(entry.boards))
        assert.equal(
          boardIdentity({
            campaign,
            level,
            recipe: campaign.classRecipes.find((recipe) => recipe.id === 'scout'),
            turnPolicy,
            seed: 1,
          }),
          expected,
          `${entry.id}/${turnPolicy}`,
        );
    }
  });

for (const entry of fixture.cases) {
  test(`${entry.id}: current tick events, checkpoints and completion match the archived route`, () => {
    const campaign = campaigns.get(entry.campaignId);
    const level = campaign.levels.find((item) => item.id === entry.level.id);
    const options = { ...entry.options, classRecipes: campaign.classRecipes };
    const run = createRun(level, options);
    const recorder = createRecorder(level, options, fixture.contracts.build);
    const events = advanceRecorded(run, recorder, entry.segments, {
      checkpoints: entry.checkpoints,
    });
    assert.deepEqual(getSummary(run), entry.summary);
    assert.deepEqual(authoritativeCheckpoint(run), entry.checkpoint);
    assert.equal(digest(events), entry.eventsSha256);
    assert.deepEqual(exportReplay(recorder, run), oldReplay(entry));
    assert.equal(completionVariantKey(getSummary(run)), entry.variantKey);
    assert.equal(
      boardIdentity({
        campaign,
        level,
        recipe: campaign.classRecipes.find((recipe) => recipe.id === entry.options.classId),
        turnPolicy: entry.options.turnPolicy,
        seed: entry.options.seed,
        classRoute: run.classHistory.map((item) => item.classId),
      }),
      entry.boardId,
    );
  });

  test(`${entry.id}: both public verifiers accept the immutable old replay v3 envelope`, async () => {
    const recorded = oldReplay(entry),
      before = JSON.stringify(recorded);
    const sync = verifyReplay(recorded);
    const async = await verifyReplayAsync(recorded, { chunkTicks: 600 });
    for (const result of [sync, async]) {
      assert.equal(result.match, true);
      assert.deepEqual(authoritativeCheckpoint(result.state), entry.checkpoint);
      assert.deepEqual(getSummary(result.state), entry.summary);
    }
    assert.equal(JSON.stringify(recorded), before);
  });

  if (entry.suspended)
    test(`${entry.id}: a frozen live-cut session restores and continues to its old win`, async () => {
      const part = entry.suspended;
      const candidate = { ...part.metadata, replay: oldReplay(entry, part) };
      const before = JSON.stringify(candidate);
      const campaign = campaigns.get(entry.campaignId);
      const currentKey = campaignKey(campaign);
      const restored = await restoreSession(candidate, { campaign, campaignKey: currentKey });
      assert.ok(restored.run.player.cutting);
      assert.equal(restored.run.trail.length, part.trailCells);
      assert.equal(restored.run.player.speed, 0);
      assert.equal(restored.run.player.queuedDirection, null);
      assert.deepEqual(authoritativeCheckpoint(restored.run), part.checkpoint);
      assert.deepEqual(
        suspendSession({
          ...part.metadata,
          run: restored.run,
          recorder: restored.recorder,
        }),
        candidate,
      );
      advanceRecorded(restored.run, restored.recorder, entry.segments, { afterTick: part.ticks });
      assert.equal(restored.run.status, 'won');
      assert.deepEqual(
        exportReplay(restored.recorder, restored.run),
        oldReplay(entry, part.continued),
      );
      assert.deepEqual(authoritativeCheckpoint(restored.run), entry.checkpoint);
      assert.equal(JSON.stringify(candidate), before);
    });
}
