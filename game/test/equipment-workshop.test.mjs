import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import { resolvePackCampaign, scenarioFromPack } from '../packs.mjs';
import { loadWorkshopArtInputs } from '../../scripts/create-workshop-art-fixtures.mjs';
import { campaignKey } from '../library.mjs';
import { masteryDefinitionIdentity } from '../mastery.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';

const read = (name) => readFileSync(new URL(name, import.meta.url));
const homeward = JSON.parse(read('../content/packs/homeward-skies.json'));
const proofBytes = read('../replays/homeward-routes.json');
const proof = JSON.parse(proofBytes);
// Known-source/header adapter only; browser tests establish actual image decoding.
const { current: pack } = await loadWorkshopArtInputs();
const { campaign } = resolvePackCampaign(pack, 'equipment-workshop');
const key = campaignKey(campaign);
const levelFor = (oldId) => campaign.levels[Number(oldId.slice(-2)) - 1];
const goalFor = (oldId) => pack.masteries.find((goal) => goal.levelId === levelFor(oldId).id);
const request = (definition) => ({
  definition,
  campaignId: campaign.id,
  campaignKey: key,
  runId: `workshop-${definition.id}`,
});
function recording(level, options, segments) {
  const run = createRun(level, options);
  const recorder = createRecorder(level, options, 'equipment-workshop-legal-route-test');
  for (const segment of segments) {
    if (segment.releaseBefore) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  }
  return exportReplay(recorder, run);
}

test('workshop retains proven geometry and equipment with three independent themes and original illustrated rewards', () => {
  assert.equal(
    createHash('sha256').update(proofBytes).digest('hex'),
    '63a77908b1ce98b480f9fd0431894e4f1d58ad56e4266ae0860206de564d8c1a',
  );
  assert.equal(pack.format, 'xonix-pack.v2');
  assert.ok(read('../content/packs/equipment-workshop.json').length < 24 * 1024 * 1024);
  assert.equal(JSON.stringify(pack).includes('data:image/png'), true);
  assert.deepEqual(pack.visualOverrides, {});
  assert.deepEqual(
    pack.levelVisuals.map((entry) => entry.levelId),
    ['workshop-01', 'workshop-02', 'workshop-03'],
  );
  assert.deepEqual(pack.classRecipes, homeward.classRecipes);
  assert.deepEqual(
    campaign.levels.map((level) => level.themeId),
    ['ukraine', 'retro', 'coupa'],
  );
  for (let i = 0; i < campaign.levels.length; i++) {
    const current = normalizedLevel(campaign.levels[i]);
    const old = normalizedLevel(homeward.campaigns[0].levels[i]);
    assert.deepEqual(
      {
        ...current,
        id: old.id,
        name: old.name,
        themeId: old.themeId,
        musicId: old.musicId,
        metadata: old.metadata,
      },
      old,
    );
    assert.equal(pack.masteries[i].campaignId, campaign.id);
    assert.equal(pack.masteries[i].levelId, campaign.levels[i].id);
  }
});

test('prepared practice scenarios select the actual per-map theme, music and authored goal', () => {
  for (const level of campaign.levels) {
    const scenario = scenarioFromPack(pack, campaign.id, level.id);
    assert.equal(scenario.format, 'xonix-playground.v2');
    assert.equal(scenario.theme.id, level.themeId);
    assert.equal(scenario.level.musicId, level.musicId);
    assert.equal(scenario.masteryDefinition.levelId, level.id);
    assert.ok(pack.music.some((track) => track.id === level.musicId));
    assert.ok(Object.values(scenario.theme.classBodies).every((body) => !body.includes('fpv')));
  }
});

for (const route of proof.routes.filter(
  (value) => value.variant === 'specialty' || value.classId === 'interceptor',
))
  test(`${levelFor(route.levelId).id}/${route.turnPolicy}/${route.classId}: legal ${route.variant} route`, async () => {
    const level = levelFor(route.levelId),
      definition = goalFor(route.levelId);
    const replay = recording(
      level,
      {
        seed: route.seed,
        turnPolicy: route.turnPolicy,
        classId: route.classId,
        classRecipes: campaign.classRecipes,
      },
      route.segments,
    );
    assert.deepEqual(replay.summary, { ...route.expected, levelId: level.id });
    assert.notDeepEqual(replay.checkpoint, route.checkpoint);
    const checked = await verifyReplayAsync(replay, { mastery: request(definition) });
    assert.equal(checked.match, true);
    assert.deepEqual(checked.actual.checkpoint, replay.checkpoint);
    const qualifies = route.variant === 'specialty';
    assert.equal(checked.masteryPreview.qualified, qualifies);
    assert.equal(checked.masteryPreview.definitionIdentity, masteryDefinitionIdentity(definition));
    if (qualifies) {
      const preview = checked.masteryPreview;
      if (level.id === 'workshop-01') assert.equal(preview.bestClosedCutCells, 22);
      if (level.id === 'workshop-02') {
        assert.deepEqual(preview.predicates[0].collectedPadIds, ['south-supply', 'west-supply']);
        assert.deepEqual(
          preview.predicates[1].regions.map((r) => r.bestClosedCells),
          [3, 4],
        );
        assert.equal(preview.predicates[2].satisfied, true);
      }
      if (level.id === 'workshop-03') assert.equal(preview.predicates[1].phase, 'returned');
    }
    const verified = await verifyMasteryRun({
      replay,
      campaign,
      definition,
      runId: `workshop-${route.id}`,
      earnedAt: '2026-09-12T12:00:00.000Z',
    });
    const record = verifiedMasteryRecord(verified);
    assert.equal(record !== null, qualifies);
    if (record) {
      assert.equal(record.campaignKey, key);
      assert.equal(record.levelId, level.id);
      assert.equal(record.definitionHash, masteryDefinitionIdentity(definition));
    }
  });

for (const comparison of proof.comparisons)
  test(`${levelFor(comparison.levelId).id}/${comparison.turnPolicy}: omitted equipment stays unqualified`, async () => {
    const level = levelFor(comparison.levelId),
      definition = goalFor(comparison.levelId);
    const replay = recording(level, comparison.replay.options, comparison.replay.segments);
    assert.deepEqual(replay.summary, { ...comparison.replay.summary, levelId: level.id });
    const checked = await verifyReplayAsync(replay, { mastery: request(definition) });
    assert.equal(checked.match, true);
    assert.equal(checked.masteryPreview.qualified, false);
    if (level.id === 'workshop-02') assert.equal(checked.state.status, 'running');
    else {
      assert.equal(checked.state.status, 'won');
      assert.equal(checked.state.lives, 2);
    }
  });
